package com.weadk.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Defaults, alias resolution, and pricing. */
class AiPropertiesTest {

    private final AiProperties defaults = new AiProperties(null, null, null, null);

    @Test
    @DisplayName("the three aliases resolve, and an unknown name is passed through")
    void aliases() {
        assertThat(defaults.modelFor("opus")).isEqualTo("claude-opus-5");
        assertThat(defaults.modelFor("SONNET")).isEqualTo("claude-sonnet-5");
        assertThat(defaults.modelFor("haiku")).isEqualTo("claude-haiku-4-5");
        // A full model id sent instead of an alias is honoured rather than rewritten.
        assertThat(defaults.modelFor("claude-opus-4-8")).isEqualTo("claude-opus-4-8");
        assertThat(defaults.modelFor(null)).isEqualTo("claude-sonnet-5");
    }

    @Test
    @DisplayName("an override replaces one alias and leaves the others alone")
    void partialOverride() {
        AiProperties props = new AiProperties(Map.of("sonnet", "claude-sonnet-4-6"), null, null, null);
        assertThat(props.modelFor("sonnet")).isEqualTo("claude-sonnet-4-6");
        assertThat(props.modelFor("opus")).isEqualTo("claude-opus-5");
    }

    @Test
    @DisplayName("prices are per million tokens, and an unpriced model costs nothing rather than failing")
    void pricing() {
        assertThat(defaults.priceFor("claude-opus-5").inputPerMillion()).isEqualByComparingTo("5.00");
        assertThat(defaults.priceFor("claude-opus-5").outputPerMillion()).isEqualByComparingTo("25.00");
        assertThat(defaults.priceFor("something-else").inputPerMillion()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("timeouts and token ceilings have working defaults")
    void limits() {
        assertThat(defaults.timeout().generate()).isEqualTo(Duration.ofSeconds(300));
        assertThat(defaults.timeout().chat()).isEqualTo(Duration.ofSeconds(600));
        assertThat(defaults.tokens().max()).isEqualTo(16_000);
        // Streaming gets the larger ceiling; that is the whole reason it streams.
        assertThat(defaults.tokens().chatMax()).isEqualTo(64_000);
    }

    @Test
    @DisplayName("a usage row is priced from its token counts")
    void pricesAUsageRow() {
        AiUsage usage = new AiUsage("chat", "claude-sonnet-5")
                .withTokensRaw(1_000_000, 100_000, 0, 0)
                .priced(defaults.priceFor("claude-sonnet-5"));
        // 1M input at $2.00 plus 100k output at $10.00.
        assertThat(usage.getCostUsd()).isEqualByComparingTo("3.00");
    }
}
