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
 * <p>Clients are cached per credential. Each one owns an OkHttp connection pool, so building
 * a fresh one per request would leak sockets under any real load.
 */
@Component
public class AnthropicClients implements AutoCloseable {

    private static final Logger log = LoggerFactory.getLogger(AnthropicClients.class);

    /** Subscription tokens from {@code claude setup-token}, as opposed to API keys. */
    private static final String OAUTH_PREFIX = "sk-ant-oat";
    private static final String OAUTH_BETA_HEADER = "oauth-2025-04-20";

    private final WeAdkProperties props;
    private final Map<CacheKey, AnthropicClient> clients = new ConcurrentHashMap<>();

    public AnthropicClients(WeAdkProperties props) {
        this.props = props;
    }

    public boolean serverKeyConfigured() {
        return props.anthropic().configured();
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
        if (credential == null || credential.isBlank()) {
            throw AiException.notConfigured();
        }
        return clients.computeIfAbsent(new CacheKey(credential, timeout), CacheKey::build);
    }

    /** Cached by credential and deadline together — the deadline is baked into the client. */
    private record CacheKey(String credential, Duration timeout) {

        AnthropicClient build() {
            AnthropicOkHttpClient.Builder builder =
                    AnthropicOkHttpClient.builder().timeout(timeout).maxRetries(2);
            if (credential.startsWith(OAUTH_PREFIX)) {
                builder.authToken(credential).putHeader("anthropic-beta", OAUTH_BETA_HEADER);
            } else {
                builder.apiKey(credential);
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
