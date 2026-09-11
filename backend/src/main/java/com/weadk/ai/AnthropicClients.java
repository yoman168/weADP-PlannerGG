package com.weadk.ai;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.weadk.config.WeAdkProperties;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Whose Claude account a request runs on.
 *
 * <p>Normally the server's: {@code weadk.anthropic.api-key} is one credential for the whole
 * deployment, which is also what makes the DevAdmin usage screens addable up. A caller may
 * override it per request with an {@code X-Anthropic-Api-Key} header, which is how someone
 * spends their own quota instead of the organisation's.
 *
 * <p>One note on the change this represents. The workspace used to run each user's own
 * Claude Code subscription by shelling out to the local {@code claude} CLI with an OAuth
 * token from {@code claude setup-token}. A server-side SDK cannot do that: subscription
 * OAuth tokens are not API keys. Tokens shaped like one ({@code sk-ant-oat…}) are still
 * accepted and sent as a bearer token with the OAuth beta header, but an API key
 * ({@code sk-ant-api…}) is the supported path.
 *
 * <p>And the way back to the CLI: {@code weadk.anthropic.bridge-url} names the
 * {@code claude-bridge} service ({@code scripts/claude-bridge.mjs}), which answers the
 * Messages API by running {@code claude --print}. The SDK is simply pointed at it as its
 * base URL; the request, the response and the usage it records are the same as against the
 * real API. When a bridge is configured it is the path for <em>every</em> AI call — a
 * credential that is present, the caller's or the server's, travels with the request as its
 * key and the bridge hands it to the CLI, so someone spending their own quota still does.
 * Without a bridge, the key is used directly, which is what a deployment does.
 *
 * <p>Clients are cached per credential. Each one owns an OkHttp connection pool, so building
 * a fresh one per request would leak sockets under any real load.
 */
@Component
public class AnthropicClients implements AutoCloseable {

    private static final Logger log = LoggerFactory.getLogger(AnthropicClients.class);

    /** Subscription tokens from {@code claude setup-token}, as opposed to API keys. */
    private static final String OAUTH_PREFIX = "sk-ant-oat";
    private static final String OAUTH_BETA_HEADER = "oauth-2025-04-20";

    /** What goes in the key header when nobody has one; the bridge then uses its own. */
    private static final String BRIDGE_KEY = "local-claude-cli";

    private final WeAdkProperties props;
    private final Map<CacheKey, AnthropicClient> clients = new ConcurrentHashMap<>();

    public AnthropicClients(WeAdkProperties props) {
        this.props = props;
    }

    /** Whether a call can be made without the caller bringing a key: ours, or the bridge. */
    public boolean serverConfigured() {
        return props.anthropic().available();
    }

    /**
     * A client for this request, with the given deadline.
     *
     * @param callerKey the {@code X-Anthropic-Api-Key} header, or null to use the server's
     */
    public AnthropicClient forRequest(String callerKey, Duration timeout) {
        String credential = callerKey != null && !callerKey.isBlank()
                ? callerKey.trim()
                : props.anthropic().apiKey();
        boolean hasCredential = credential != null && !credential.isBlank();

        String bridge = props.anthropic().bridgeUrl();
        if (bridge != null && !bridge.isBlank()) {
            // One path when there is a bridge. A credential rides along as the request's
            // key — the bridge reads it and runs the CLI as that account — and its absence
            // is the placeholder, which the bridge knows to ignore in favour of its own.
            return clients.computeIfAbsent(
                    CacheKey.bridge(bridge.trim(), hasCredential ? credential : BRIDGE_KEY, timeout),
                    CacheKey::build);
        }
        if (hasCredential) {
            return clients.computeIfAbsent(CacheKey.direct(credential, timeout), CacheKey::build);
        }
        throw AiException.notConfigured();
    }

    /** Cached by credential and deadline together — the deadline is baked into the client. */
    private record CacheKey(String credential, String baseUrl, Duration timeout) {

        static CacheKey direct(String credential, Duration timeout) {
            return new CacheKey(credential, null, timeout);
        }

        static CacheKey bridge(String baseUrl, String credential, Duration timeout) {
            return new CacheKey(credential, baseUrl, timeout);
        }

        AnthropicClient build() {
            AnthropicOkHttpClient.Builder builder =
                    AnthropicOkHttpClient.builder().timeout(timeout);
            if (baseUrl != null) {
                // Whatever the credential is, it goes as the key header: the bridge tells a
                // subscription token from an API key itself. No retries — each attempt is a
                // whole model turn, and a failed one is not going to go better the third time.
                builder.baseUrl(baseUrl).apiKey(credential).maxRetries(0);
            } else if (credential.startsWith(OAUTH_PREFIX)) {
                builder.authToken(credential)
                        .putHeader("anthropic-beta", OAUTH_BETA_HEADER)
                        .maxRetries(2);
            } else {
                builder.apiKey(credential).maxRetries(2);
            }
            return builder.build();
        }
    }

    @Override
    public void close() {
        for (AnthropicClient client : clients.values()) {
            try {
                client.close();
            } catch (RuntimeException ex) {
                log.debug("Closing an Anthropic client failed", ex);
            }
        }
        clients.clear();
    }
}
