package com.weadk.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Reading JSON out of a reply.
 *
 * <p>Every prompt here ends by asking for a bare JSON object, and the model usually obliges.
 * These are the cases where it does not — a markdown fence, a sentence of preamble, a
 * refusal in prose — because each one of them happened.
 */
class ModelTextTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @DisplayName("a bare object")
    void bare() {
        JsonNode node = ModelText.object(mapper, "{\"reply\":\"done\",\"operations\":[]}").orElseThrow();
        assertThat(node.get("reply").asText()).isEqualTo("done");
    }

    @Test
    @DisplayName("a fenced object, with and without the json tag")
    void fenced() {
        assertThat(ModelText.object(mapper, "```json\n{\"reply\":\"a\"}\n```").orElseThrow().get("reply").asText())
                .isEqualTo("a");
        assertThat(ModelText.object(mapper, "```\n{\"reply\":\"b\"}\n```").orElseThrow().get("reply").asText())
                .isEqualTo("b");
    }

    @Test
    @DisplayName("an object wrapped in prose the prompt asked for none of")
    void surroundedByProse() {
        String text = "Sure — here is the change you asked for:\n{\"reply\":\"c\",\"operations\":[]}\nHope that helps!";
        assertThat(ModelText.object(mapper, text).orElseThrow().get("reply").asText()).isEqualTo("c");
    }

    @Test
    @DisplayName("an array, for the requirements endpoint")
    void array() {
        JsonNode node = ModelText.array(mapper, "```json\n[{\"title\":\"Validate the amount\"}]\n```").orElseThrow();
        assertThat(node).hasSize(1);
        assertThat(node.get(0).get("title").asText()).isEqualTo("Validate the amount");
    }

    @Test
    @DisplayName("prose with no JSON in it at all is absent, not an exception")
    void prose() {
        assertThat(ModelText.object(mapper, "I can't do that because the notes don't say which screen."))
                .isEmpty();
        assertThat(ModelText.object(mapper, "")).isEmpty();
        assertThat(ModelText.object(mapper, null)).isEmpty();
    }

    @Test
    @DisplayName("something that looks like JSON but is not is absent, not a crash")
    void malformed() {
        Optional<JsonNode> read = ModelText.object(mapper, "{\"reply\": \"unterminated");
        assertThat(read).isEmpty();
    }
}
