package com.weadk.ai;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Which knobs each model takes.
 *
 * <p>This matters more than its size suggests: the folder chat defaults to Haiku, and
 * sending Haiku an adaptive-thinking block or an effort level is a 400 from the API — so
 * getting this wrong breaks the most-used AI feature in the workspace and nothing else.
 */
class ModelCapabilitiesTest {

    @Test
    @DisplayName("the current large models take adaptive thinking and effort")
    void currentModels() {
        for (String model : new String[] {"claude-opus-5", "claude-sonnet-5", "claude-fable-5-1", "claude-opus-4-8"}) {
            assertThat(ModelCapabilities.adaptiveThinking(model)).as(model).isTrue();
            assertThat(ModelCapabilities.effort(model)).as(model).isTrue();
        }
    }

    @Test
    @DisplayName("Haiku takes neither")
    void haiku() {
        assertThat(ModelCapabilities.adaptiveThinking("claude-haiku-4-5")).isFalse();
        assertThat(ModelCapabilities.effort("claude-haiku-4-5")).isFalse();
    }

    @Test
    @DisplayName("the older generations take neither")
    void olderGenerations() {
        assertThat(ModelCapabilities.effort("claude-sonnet-4-5")).isFalse();
        assertThat(ModelCapabilities.effort("claude-opus-4-5")).isFalse();
    }

    @Test
    @DisplayName("an unknown model is treated as current, because that is the safe direction")
    void unknownModel() {
        assertThat(ModelCapabilities.adaptiveThinking("claude-something-6")).isTrue();
    }

    @Test
    @DisplayName("no model at all takes nothing")
    void nullModel() {
        assertThat(ModelCapabilities.adaptiveThinking(null)).isFalse();
        assertThat(ModelCapabilities.effort(null)).isFalse();
    }
}
