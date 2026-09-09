package com.weadk.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The wire contract with the browser.
 *
 * <p>These assertions look pedantic — checking that a field is called {@code text} and not
 * {@code content} — and that is the point. The decoder on the other side is
 * {@code readChatEvent} in {@code src/components/we-adk/claude-chat.tsx}, used by six
 * different panels, and it silently ignores any envelope it does not recognise. A renamed
 * field would not throw anywhere; the chat would just stop showing replies. So the field
 * names are pinned here, where a change to them fails a build instead of a demo.
 */
class ChatEnvelopesTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private JsonNode json(Object value) {
        return mapper.valueToTree(value);
    }

    @Test
    @DisplayName("a text delta is nested exactly where the decoder looks for it")
    void delta() {
        JsonNode event = json(ChatEnvelopes.delta("Hello"));
        assertThat(event.get("type").asText()).isEqualTo("stream_event");
        assertThat(event.get("event").get("type").asText()).isEqualTo("content_block_delta");
        assertThat(event.get("event").get("delta").get("type").asText()).isEqualTo("text_delta");
        assertThat(event.get("event").get("delta").get("text").asText()).isEqualTo("Hello");
    }

    @Test
    @DisplayName("the closing envelope carries usage in the API's own snake_case")
    void success() {
        JsonNode event = json(ChatEnvelopes.success(1_200, 340, new BigDecimal("0.004200"), 8_500));
        assertThat(event.get("type").asText()).isEqualTo("result");
        assertThat(event.get("subtype").asText()).isEqualTo("success");
        assertThat(event.get("usage").get("input_tokens").asLong()).isEqualTo(1_200);
        assertThat(event.get("usage").get("output_tokens").asLong()).isEqualTo(340);
        assertThat(event.get("total_cost_usd").decimalValue()).isEqualByComparingTo("0.004200");
        assertThat(event.get("duration_ms").asLong()).isEqualTo(8_500);
    }

    @Test
    @DisplayName("a refusal is an unsuccessful result, with the reason where the decoder reads it")
    void refusal() {
        JsonNode event = json(ChatEnvelopes.unsuccessful("error_refusal", "Declined."));
        assertThat(event.get("type").asText()).isEqualTo("result");
        assertThat(event.get("subtype").asText()).isNotEqualTo("success");
        assertThat(event.get("result").asText()).isEqualTo("Declined.");
    }

    @Test
    @DisplayName("a bridge failure is its own envelope, and the message is in `error`")
    void bridgeError() {
        JsonNode event = json(ChatEnvelopes.bridgeError("No API key."));
        assertThat(event.get("type").asText()).isEqualTo("bridge_error");
        assertThat(event.get("error").asText()).isEqualTo("No API key.");
    }

    @Test
    @DisplayName("every envelope serialises to a single line, since the stream is newline-delimited")
    void oneLineEach() throws Exception {
        for (Object event : new Object[] {
            ChatEnvelopes.delta("a\nb"),
            ChatEnvelopes.success(1, 2, BigDecimal.ONE, 3),
            ChatEnvelopes.unsuccessful("error_max_turns", "stopped"),
            ChatEnvelopes.bridgeError("broke")
        }) {
            // A newline inside a value must be escaped by the encoder, not emitted raw:
            // a raw one would split one envelope into two unparseable lines.
            assertThat(mapper.writeValueAsString(event)).doesNotContain("\n");
        }
    }
}
