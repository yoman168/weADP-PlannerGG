package com.weadk.landing;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.weadk.support.PostgresTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The root, which exists to be read by someone who came to the wrong port.
 *
 * <p>Worth a test for one reason: it has to answer without a token. It is on the allowlist in
 * {@code SecurityConfig}, and if it ever falls off, what a person sees is a bare
 * {@code HTTP ERROR 401} and the browser's own "This page isn't working" — which looks
 * exactly like the service being down rather than like a wrong port.
 */
class RootControllerTest extends PostgresTest {

    @Autowired
    private MockMvc mvc;

    @Test
    @DisplayName("a browser is sent to the workspace, with no token")
    void browserGoesToTheWorkspace() throws Exception {
        mvc.perform(get("/").accept(MediaType.TEXT_HTML))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "http://localhost:3000"))
                // 302, not 301. A permanent redirect would be cached and would outlive a
                // change of CORS_ORIGINS, pointing people at an address this API dropped.
                .andExpect(status().is(302));
    }

    @Test
    @DisplayName("anything else gets JSON, so a script or a probe can read it")
    void scriptsGetJson() throws Exception {
        mvc.perform(get("/").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.service").value("WE-ADK API"))
                .andExpect(jsonPath("$.workspace").value("http://localhost:3000"))
                // Says which mode it is in, which is the first thing to check when a token
                // is being refused.
                .andExpect(jsonPath("$.security").value("jwt"))
                .andExpect(jsonPath("$.docs").value("/swagger-ui.html"));
    }
}
