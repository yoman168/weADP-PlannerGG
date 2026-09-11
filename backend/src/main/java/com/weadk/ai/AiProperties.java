package com.weadk.ai;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * How the AI endpoints call Claude, under {@code weadk.ai}.
 *
 * <p>The credential itself is not here — that is {@code weadk.anthropic.api-key}, bound in
 * {@code com.weadk.config.WeAdkProperties} and shared with the rest of the service. These
 * are the knobs particular to these endpoints: which model each alias means, what a
 * million tokens costs, and how long each kind of call is allowed to take.
 *
 * <p>Every value has a default, so none of these keys need appear in a yml file. Overriding
 * one from the environment works the usual way — {@code WEADK_AI_TIMEOUT_CHAT=600s}.
 */
@ConfigurationProperties(prefix = "weadk.ai")
public record AiProperties(Map<String, String> models, Map<String, Price> pricing, Timeouts timeout, Tokens tokens) {

    /**
     * The three aliases the workspace's model picker sends.
     *
     * <p>The browser asks for "sonnet", not for a dated model id: a picker that names exact
     * model versions is a picker that goes stale in the client, where it cannot be fixed
     * without a deploy. So the alias is the contract and this map is the part that moves.
     */
    public static final Map<String, String> DEFAULT_MODELS = Map.of(
            "opus", "claude-opus-5",
            "sonnet", "claude-sonnet-5",
            "haiku", "claude-haiku-4-5");

    /** USD per million tokens, used to price {@code ai_usage} rows as they are written. */
    public static final Map<String, Price> DEFAULT_PRICING = Map.of(
            "claude-opus-5", new Price(new BigDecimal("5.00"), new BigDecimal("25.00")),
            "claude-sonnet-5", new Price(new BigDecimal("2.00"), new BigDecimal("10.00")),
            "claude-haiku-4-5", new Price(new BigDecimal("1.00"), new BigDecimal("5.00")));

    public AiProperties {
        models = merged(DEFAULT_MODELS, models);
        pricing = merged(DEFAULT_PRICING, pricing);
        timeout = timeout == null ? new Timeouts(null, null, null, null) : timeout;
        tokens = tokens == null ? new Tokens(0, 0) : tokens;
    }

    private static <V> Map<String, V> merged(Map<String, V> defaults, Map<String, V> overrides) {
        Map<String, V> all = new LinkedHashMap<>(defaults);
        if (overrides != null) {
            all.putAll(overrides);
        }
        return Map.copyOf(all);
    }

    public record Price(BigDecimal inputPerMillion, BigDecimal outputPerMillion) {
        public Price {
            inputPerMillion = inputPerMillion == null ? BigDecimal.ZERO : inputPerMillion;
            outputPerMillion = outputPerMillion == null ? BigDecimal.ZERO : outputPerMillion;
        }
    }

    /**
     * Per-endpoint deadlines. Generating a set of screens is a minutes-long call and the
     * folder chat is longer still, so one timeout for all of them would either cut the
     * long calls off or leave the short ones hanging.
     */
    public record Timeouts(Duration canvas, Duration generate, Duration frd, Duration chat) {
        public Timeouts {
            canvas = canvas == null ? Duration.ofSeconds(120) : canvas;
            generate = generate == null ? Duration.ofSeconds(300) : generate;
            frd = frd == null ? Duration.ofSeconds(120) : frd;
            chat = chat == null ? Duration.ofSeconds(600) : chat;
        }
    }

    /**
     * Output ceilings.
     *
     * <p>Streaming gets the larger one because the ceiling is what makes a long reply
     * possible, and streaming is what stops a long reply from timing out.
     */
    public record Tokens(long max, long chatMax) {
        public Tokens {
            max = max > 0 ? max : 16_000;
            chatMax = chatMax > 0 ? chatMax : 64_000;
        }
    }

    /** The model id an alias means; an id that is not an alias is passed through unchanged. */
    public String modelFor(String alias) {
        if (alias == null || alias.isBlank()) {
            return models.get("sonnet");
        }
        String resolved = models.get(alias.toLowerCase(java.util.Locale.ROOT));
        return resolved == null ? alias : resolved;
    }

    public Price priceFor(String model) {
        return pricing.getOrDefault(model, new Price(BigDecimal.ZERO, BigDecimal.ZERO));
    }
}
