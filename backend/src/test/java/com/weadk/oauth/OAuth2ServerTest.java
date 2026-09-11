package com.weadk.oauth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.weadk.support.WorkspaceDatabase;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The authorization server, in its own context.
 *
 * <p>Its own rather than shared, because {@code weadk.security.mode} decides which beans
 * exist and that is settled when the context is built. The full redirect dance — sign in,
 * code, exchange, call the API — is exercised by {@code scripts/oauth/flow-check.mjs}
 * against a running server, where a real cookie jar and real redirects make it worth doing.
 * What is pinned here is the configuration those redirects depend on.
 */
@SpringBootTest
@AutoConfigureMockMvc
class OAuth2ServerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private RegisteredClientRepository clients;

    @Autowired
    private JdbcTemplate jdbc;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", WorkspaceDatabase::jdbcUrl);
        registry.add("spring.datasource.username", WorkspaceDatabase::username);
        registry.add("spring.datasource.password", WorkspaceDatabase::password);
        registry.add("weadk.security.mode", () -> "oauth2");
        registry.add("weadk.oauth2.issuer", () -> "http://localhost:8080");
        registry.add("weadk.anthropic.api-key", () -> "");
    }

    @Test
    @DisplayName("the client is public, requires PKCE, and gets no refresh token")
    void clientRegistration() {
        RegisteredClient client = clients.findByClientId("we-adk-workspace");
        assertThat(client).isNotNull();

        // A browser application cannot keep a secret, so it has none.
        assertThat(client.getClientAuthenticationMethods())
                .containsExactly(ClientAuthenticationMethod.NONE);
        assertThat(client.getClientSecret()).isNull();

        // Which is exactly why PKCE has to be required rather than merely allowed: without
        // it, an intercepted authorization code can be redeemed by anyone.
        assertThat(client.getClientSettings().isRequireProofKey()).isTrue();

        // No refresh grant, and that is deliberate. Spring will not issue a refresh token to
        // a public client on this grant, so advertising the grant would promise a token that
        // never arrives. Renewal goes back through /oauth2/authorize instead.
        assertThat(client.getAuthorizationGrantTypes())
                .containsExactly(AuthorizationGrantType.AUTHORIZATION_CODE);
    }

    @Test
    @DisplayName("the signing key is stored, so a restart does not sign everyone out")
    void signingKeyPersisted() {
        Integer keys = jdbc.queryForObject("select count(*) from oauth2_signing_key", Integer.class);
        assertThat(keys).isEqualTo(1);
    }

    @Test
    @DisplayName("discovery advertises the endpoints and PKCE")
    void discovery() throws Exception {
        mvc.perform(get("/.well-known/oauth-authorization-server"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.issuer").value("http://localhost:8080"))
                .andExpect(jsonPath("$.authorization_endpoint")
                        .value("http://localhost:8080/oauth2/authorize"))
                .andExpect(jsonPath("$.token_endpoint").value("http://localhost:8080/oauth2/token"))
                .andExpect(jsonPath("$.code_challenge_methods_supported[0]").value("S256"));
    }

    @Test
    @DisplayName("the key set is published, so tokens can be verified")
    void jwks() throws Exception {
        mvc.perform(get("/oauth2/jwks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keys[0].kty").value("RSA"))
                // The private half must never appear here.
                .andExpect(jsonPath("$.keys[0].d").doesNotExist());
    }

    @Test
    @DisplayName("the sign-in page renders, with the CSRF field the form needs")
    void loginPage() throws Exception {
        mvc.perform(get("/login"))
                .andExpect(status().isOk())
                .andExpect(content().string(Matchers.containsString("Sign in to WE-ADK")))
                // Without this the form posts and is rejected, which looks exactly like a
                // wrong password — so its presence is worth asserting rather than assuming.
                .andExpect(content().string(Matchers.containsString("name=\"_csrf\"")));
    }

    @Test
    @DisplayName("the API needs a token, and an unauthenticated browser is sent to sign in")
    void apiIsProtected() throws Exception {
        mvc.perform(get("/api/state")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/projects")).andExpect(status().isUnauthorized());

        // The other half of this — that a browser with no session is redirected to sign in
        // rather than refused — is asserted by scripts/oauth/flow-check.mjs against a running
        // server, not here. MockMvc builds a request with no query string, and the
        // authorization endpoint requires its parameters to have arrived in one, so it
        // answers 400 to a request a real container answers with a 302. Asserting either
        // outcome here would be testing MockMvc rather than this server.
    }

    @Test
    @DisplayName("the password endpoint says it is not the way in here, rather than 401")
    void legacyEndpointExplainsItself() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"you@example.com\",\"password\":\"whatever-it-is\"}"))
                // 501, not 401: the credentials were never the problem. A 401 here would send
                // someone off to check a password that was fine.
                .andExpect(status().isNotImplemented())
                .andExpect(jsonPath("$.detail").value(Matchers.containsString("does not issue tokens")));
    }
}
