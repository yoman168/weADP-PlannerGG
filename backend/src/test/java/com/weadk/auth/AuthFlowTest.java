package com.weadk.auth;

import static org.assertj.core.api.Assertions.assertThat;
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

/** Signing in, and what happens when you do not. */
class AuthFlowTest extends PostgresTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    private String login(String email, String password) throws Exception {
        String body = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode json = mapper.readTree(body);
        assertThat(json.get("user").get("email").asText()).isEqualTo(email);
        return json.get("token").asText();
    }

    @Test
    @DisplayName("the seeded account signs in and the token identifies it")
    void signInAndReadBack() throws Exception {
        String token = login(SEED_EMAIL, SEED_PASSWORD);
        assertThat(token).isNotBlank();

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(SEED_EMAIL))
                .andExpect(jsonPath("$.name").value("Seed Account"))
                .andExpect(jsonPath("$.roles").isArray());
    }

    @Test
    @DisplayName("a wrong password is refused, and says no more than that")
    void wrongPassword() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"not-the-password\"}".formatted(SEED_EMAIL)))
                .andExpect(status().isUnauthorized())
                // The same sentence an unknown address gets: the difference between them
                // would tell an attacker which addresses are real.
                .andExpect(jsonPath("$.detail").value("That email and password do not match an account."));
    }

    @Test
    @DisplayName("an unknown address is refused identically")
    void unknownAccount() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nobody@we-adk.test\",\"password\":\"seed-password-1\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("That email and password do not match an account."));
    }

    @Test
    @DisplayName("the login route is reachable without a token, and everything else is not")
    void protectedByDefault() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"x@y.test\",\"password\":\"short\"}"))
                // Reached the handler and failed validation, rather than being turned away.
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/projects")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a signed-in caller reaches the domain routes")
    void tokenOpensTheApi() throws Exception {
        String token = login(SEED_EMAIL, SEED_PASSWORD);
        mvc.perform(get("/api/projects").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @DisplayName("the docs and health stay open, because a probe has no token")
    void publicPathsStayPublic() throws Exception {
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk());
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }
}
