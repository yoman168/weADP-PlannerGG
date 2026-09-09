package com.weadk.ai;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.weadk.support.PostgresTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The AI endpoints without a credential.
 *
 * <p>No test here calls Anthropic — {@code weadk.anthropic.api-key} is pinned empty in the
 * base class precisely so none of them can. What is being checked is the behaviour around
 * the call: that the routes need a token, that they validate what they are sent, and that
 * a deployment with no key says so in a sentence a user can act on instead of failing
 * somewhere further in.
 */
class AiEndpointTest extends PostgresTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    private String token() throws Exception {
        String body = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(SEED_EMAIL, SEED_PASSWORD)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode json = mapper.readTree(body);
        return json.get("token").asText();
    }

    @Test
    @DisplayName("status reports no key, and which model each alias means")
    void statusReportsConfiguration() throws Exception {
        mvc.perform(get("/api/ai/status").header("Authorization", "Bearer " + token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configured").value(false))
                .andExpect(jsonPath("$.models.opus").value("claude-opus-5"))
                .andExpect(jsonPath("$.models.sonnet").value("claude-sonnet-5"))
                .andExpect(jsonPath("$.models.haiku").value("claude-haiku-4-5"));
    }

    @Test
    @DisplayName("with no key configured, a canvas edit explains that rather than failing obscurely")
    void canvasWithoutAKey() throws Exception {
        String body = """
                {"instruction":"add a save button","blocks":[],"catalog":"BLOCK KINDS:\\n- buttonBar"}
                """;
        mvc.perform(post("/api/ai/canvas")
                        .header("Authorization", "Bearer " + token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.type").value("https://we-adk.dev/problems/ai-not-configured"))
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("ANTHROPIC_API_KEY")));
    }

    @Test
    @DisplayName("the AI routes need a token like everything else")
    void requiresAToken() throws Exception {
        mvc.perform(get("/api/ai/status")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/ai/canvas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"instruction\":\"x\",\"blocks\":[],\"catalog\":\"y\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("notes too short to design from are refused before a model is called")
    void generateValidatesNotes() throws Exception {
        mvc.perform(post("/api/ai/generate")
                        .header("Authorization", "Bearer " + token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"notes\":\"too short\",\"catalog\":\"BLOCK KINDS:\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("notes")));
    }

    @Test
    @DisplayName("a canvas edit with no catalogue is refused — the model would have nothing to build from")
    void canvasNeedsACatalog() throws Exception {
        mvc.perform(post("/api/ai/canvas")
                        .header("Authorization", "Bearer " + token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"instruction\":\"add a button\",\"blocks\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("catalog")));
    }
}
