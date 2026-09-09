package com.weadk.state;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.weadk.support.PostgresTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * The state the workspace used to keep in the browser.
 *
 * <p>Ordered, because these tests describe a sequence rather than four independent facts:
 * a key is written, read back, seen not to be overwritten by an import, and then deleted.
 * Splitting that into isolated tests would need four fixtures to say one thing.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class StateEndpointTest extends PostgresTest {

    private static final String SHARED_KEY = "we-adk:business:versions:proj-test";
    private static final String PERSONAL_KEY = "we-adk:locale";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    private String token;

    private String token() throws Exception {
        if (token == null) {
            String body = mvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(SEED_EMAIL, SEED_PASSWORD)))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            token = mapper.readTree(body).get("token").asText();
        }
        return token;
    }

    private MockHttpServletRequestBuilder signedIn(MockHttpServletRequestBuilder request) throws Exception {
        return request.header("Authorization", "Bearer " + token());
    }

    @Test
    @Order(1)
    @DisplayName("a batch of writes comes back on the next read")
    void writeThenRead() throws Exception {
        mvc.perform(signedIn(put("/api/state"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                {"entries":[
                                  {"key":"%s","value":"4"},
                                  {"key":"%s","value":"\\"ko\\""}
                                ]}
                                """
                                        .formatted(SHARED_KEY, PERSONAL_KEY)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.written").value(2))
                .andExpect(jsonPath("$.rejected").isEmpty());

        mvc.perform(signedIn(get("/api/state")))
                .andExpect(status().isOk())
                // The value is handed back as the exact string that was stored. Some of these
                // are JSON and some are a bare number, and the browser parses its own.
                .andExpect(jsonPath("$.entries['" + SHARED_KEY + "']").value("4"))
                .andExpect(jsonPath("$.entries['" + PERSONAL_KEY + "']").value("\"ko\""))
                // A locale belongs to a person; a round belongs to the project.
                .andExpect(jsonPath("$.personalKeys").value(org.hamcrest.Matchers.hasItem(PERSONAL_KEY)))
                .andExpect(jsonPath("$.personalKeys").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem(SHARED_KEY))));
    }

    @Test
    @Order(2)
    @DisplayName("an import fills gaps and never overwrites")
    void importOnlyFillsGaps() throws Exception {
        mvc.perform(signedIn(post("/api/state/import"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                {"entries":[
                                  {"key":"%s","value":"999"},
                                  {"key":"we-adk:task-status:proj-test","value":"{}"}
                                ]}
                                """
                                        .formatted(SHARED_KEY)))
                .andExpect(status().isOk())
                // Only the key that did not exist. This is what stops the first browser to
                // reconnect after the upgrade from flattening work done from another.
                .andExpect(jsonPath("$.written").value(1));

        mvc.perform(signedIn(get("/api/state")))
                .andExpect(jsonPath("$.entries['" + SHARED_KEY + "']").value("4"));
    }

    @Test
    @Order(3)
    @DisplayName("a credential is refused without failing the rest of the batch")
    void credentialsAreRefused() throws Exception {
        mvc.perform(signedIn(put("/api/state"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                {"entries":[
                                  {"key":"we-adk:claude-token","value":"sk-ant-oat01-secret"},
                                  {"key":"we-adk:kept","value":"1"}
                                ]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rejected[0]").value("we-adk:claude-token"))
                // The one key it should not have sent must not lose the one it should.
                .andExpect(jsonPath("$.written").value(1));

        mvc.perform(signedIn(get("/api/state")))
                .andExpect(jsonPath("$.entries['we-adk:claude-token']").doesNotExist())
                .andExpect(jsonPath("$.entries['we-adk:kept']").value("1"));
    }

    @Test
    @Order(4)
    @DisplayName("a null value deletes the key")
    void nullDeletes() throws Exception {
        mvc.perform(signedIn(put("/api/state"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"entries\":[{\"key\":\"we-adk:kept\",\"value\":null}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(1));

        mvc.perform(signedIn(get("/api/state")))
                .andExpect(jsonPath("$.entries['we-adk:kept']").doesNotExist());
    }

    @Test
    @Order(5)
    @DisplayName("an unchanged workspace is a 304 with no body")
    void unchangedIsNotModified() throws Exception {
        String etag = mvc.perform(signedIn(get("/api/state")))
                .andExpect(status().isOk())
                // Weak, deliberately: Tomcat will not compress a response with a strong
                // ETag, so a strong one here would silently switch gzip off.
                .andExpect(header().string("ETag", org.hamcrest.Matchers.startsWith("W/")))
                // `no-cache`, not `no-store`: the browser may keep a copy and revalidate it,
                // which is the only reason the ETag is worth sending.
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-cache")))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("private")))
                .andReturn()
                .getResponse()
                .getHeader("ETag");

        mvc.perform(signedIn(get("/api/state")).header("If-None-Match", etag))
                .andExpect(status().isNotModified())
                // The body is the 1.8 MB this whole mechanism exists to avoid sending.
                .andExpect(content().string(""));
    }

    @Test
    @Order(6)
    @DisplayName("a write changes the version, so the next read is a full one")
    void writingChangesTheVersion() throws Exception {
        String before = mvc.perform(signedIn(get("/api/state")))
                .andReturn()
                .getResponse()
                .getHeader("ETag");

        mvc.perform(signedIn(put("/api/state"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"entries\":[{\"key\":\"we-adk:etag-probe\",\"value\":\"1\"}]}"))
                .andExpect(status().isOk());

        // Same conditional request, now answered in full — the key set changed, so the md5
        // half of the version changed even within the same second.
        mvc.perform(signedIn(get("/api/state")).header("If-None-Match", before))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries['we-adk:etag-probe']").value("1"));
    }

    @Test
    @Order(7)
    @DisplayName("state needs a token like everything else")
    void requiresAToken() throws Exception {
        mvc.perform(get("/api/state")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/state")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"entries\":[]}"))
                .andExpect(status().isUnauthorized());
    }
}
