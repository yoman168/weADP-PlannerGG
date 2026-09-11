package com.weadk.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Delete keeps the row.
 *
 * <p>Every one of these goes through the endpoint and then looks at the table directly,
 * because the claim has two halves that no single layer can show: the API stops
 * returning the record, and the row is still there with {@code status = 0}. Asserting
 * only the first would pass just as well against the {@code deleteById} this replaced.
 *
 * <p>Each test makes its own project. The suite shares one database, and scoping every
 * assertion to a fresh project is what keeps these independent of each other.
 */
class SoftDeleteTest extends PostgresTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    @Autowired
    private DataSource dataSource;

    private JdbcTemplate jdbc;
    private String token;

    @BeforeEach
    void setUp() {
        jdbc = new JdbcTemplate(dataSource);
    }

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

    private String created(String path, String body) throws Exception {
        return mvc.perform(signedIn(post(path)).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    private String newProject(String name) throws Exception {
        return mapper.readTree(created("/api/projects", "{\"name\":\"%s\"}".formatted(name)))
                .get("id")
                .asText();
    }

    private String newMeeting(String projectId, String title) throws Exception {
        return mapper.readTree(created(
                        "/api/projects/%s/meetings".formatted(projectId),
                        "{\"title\":\"%s\",\"date\":\"2026-01-05\"}".formatted(title)))
                .get("id")
                .asText();
    }

    /** Three screens, as a generation would leave them. */
    private void generateScreens(String meetingId) throws Exception {
        mvc.perform(signedIn(put("/api/meetings/%s/screens".formatted(meetingId)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                {"screens":[
                                  {"name":"Sign in","html":"<h1>Sign in</h1>"},
                                  {"name":"Fleet list","html":"<h1>Fleet</h1>"},
                                  {"name":"Vehicle detail","html":"<h1>Vehicle</h1>"}
                                ]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.screens.length()").value(3));
    }

    private int statusOf(String table, String id) {
        return jdbc.queryForObject("select status from " + table + " where id = ?", Integer.class, id);
    }

    private int screenCount(String meetingId, int status) {
        return jdbc.queryForObject(
                "select count(*) from screen where meeting_id = ? and status = ?",
                Integer.class,
                meetingId,
                status);
    }

    @Test
    @DisplayName("deleting a project keeps its row, and marks what used to cascade with it")
    void projectDelete() throws Exception {
        String projectId = newProject("Delete me");
        String meetingId = newMeeting(projectId, "Kickoff");
        generateScreens(meetingId);
        String requestId = mapper.readTree(created(
                        "/api/projects/%s/requests".formatted(projectId),
                        "{\"screens\":[{\"name\":\"Sign in\",\"fromLabel\":\"From Kickoff\"}]}"))
                .get(0)
                .get("id")
                .asText();

        mvc.perform(signedIn(delete("/api/projects/%s".formatted(projectId))))
                .andExpect(status().isNoContent());

        // Gone from the API, by every route that used to reach it.
        mvc.perform(signedIn(get("/api/projects/%s".formatted(projectId)))).andExpect(status().isNotFound());
        mvc.perform(signedIn(get("/api/projects")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '%s')]".formatted(projectId)).isEmpty());
        mvc.perform(signedIn(get("/api/projects/%s/meetings".formatted(projectId))))
                .andExpect(status().isNotFound());
        mvc.perform(signedIn(get("/api/projects/%s/requests".formatted(projectId))))
                .andExpect(status().isNotFound());
        mvc.perform(signedIn(get("/api/meetings/%s".formatted(meetingId))))
                .andExpect(status().isNotFound());

        // Still in the database, all of it, marked rather than removed.
        assertThat(statusOf("project", projectId)).as("project row").isZero();
        assertThat(statusOf("meeting", meetingId)).as("its meeting").isZero();
        assertThat(statusOf("screen_request", requestId)).as("its request").isZero();
        assertThat(screenCount(meetingId, 1)).as("live screens left behind").isZero();
        assertThat(screenCount(meetingId, 0)).as("marked screens").isEqualTo(3);
    }

    @Test
    @DisplayName("deleting a meeting keeps its row and its screens, and leaves the project alone")
    void meetingDelete() throws Exception {
        String projectId = newProject("Keeps its meetings");
        String meetingId = newMeeting(projectId, "One to delete");
        String keptId = newMeeting(projectId, "One to keep");
        generateScreens(meetingId);

        mvc.perform(signedIn(delete("/api/meetings/%s".formatted(meetingId))))
                .andExpect(status().isNoContent());

        mvc.perform(signedIn(get("/api/meetings/%s".formatted(meetingId)))).andExpect(status().isNotFound());
        mvc.perform(signedIn(get("/api/projects/%s/meetings".formatted(projectId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(keptId));

        assertThat(statusOf("meeting", meetingId)).as("meeting row").isZero();
        assertThat(screenCount(meetingId, 0)).as("its screens went with it").isEqualTo(3);
        assertThat(statusOf("project", projectId)).as("the project is untouched").isEqualTo(1);

        // A second delete is a 404, not a silent success: it is deleted already.
        mvc.perform(signedIn(delete("/api/meetings/%s".formatted(meetingId))))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("reset keeps the screen rows, and the next generation reuses their positions")
    void screensReset() throws Exception {
        String projectId = newProject("Regenerates");
        String meetingId = newMeeting(projectId, "Reset and run again");
        generateScreens(meetingId);

        mvc.perform(signedIn(delete("/api/meetings/%s/screens".formatted(meetingId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.screens.length()").value(0))
                .andExpect(jsonPath("$.title").value("Reset and run again"));

        assertThat(screenCount(meetingId, 0)).as("kept, marked").isEqualTo(3);
        assertThat(screenCount(meetingId, 1)).as("none live").isZero();

        // This is what a table-wide unique index on (meeting_id, position) would break:
        // the new set starts again at 0, where the marked rows still sit.
        generateScreens(meetingId);

        assertThat(screenCount(meetingId, 1)).as("the new set").isEqualTo(3);
        assertThat(screenCount(meetingId, 0)).as("and the old one, still there").isEqualTo(3);
        mvc.perform(signedIn(get("/api/meetings/%s".formatted(meetingId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.screens.length()").value(3));
    }

    @Test
    @DisplayName("deleting a request keeps its row and takes it out of the tab")
    void requestDelete() throws Exception {
        String projectId = newProject("Has requests");
        String body = created(
                "/api/projects/%s/requests".formatted(projectId),
                """
                {"screens":[
                  {"name":"Sign in","fromLabel":"From Kickoff"},
                  {"name":"Fleet list","fromLabel":"From Kickoff"}
                ]}
                """);
        String deletedId = mapper.readTree(body).get(0).get("id").asText();
        String keptId = mapper.readTree(body).get(1).get("id").asText();

        mvc.perform(signedIn(delete("/api/requests/%s".formatted(deletedId))))
                .andExpect(status().isNoContent());

        mvc.perform(signedIn(get("/api/projects/%s/requests".formatted(projectId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(keptId));

        assertThat(statusOf("screen_request", deletedId)).as("request row").isZero();
        assertThat(statusOf("screen_request", keptId)).as("the other one").isEqualTo(1);

        // Filing a deleted request is a 404 rather than a resurrection.
        mvc.perform(signedIn(post("/api/requests/%s/file".formatted(deletedId)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2}"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("a deleted screen's page is no longer served, but is still stored")
    void screenHtmlAfterReset() throws Exception {
        String projectId = newProject("Pages");
        String meetingId = newMeeting(projectId, "Has pages");
        generateScreens(meetingId);

        String screenId = mapper.readTree(mvc.perform(signedIn(get("/api/meetings/%s".formatted(meetingId))))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString())
                .get("screens")
                .get(0)
                .get("id")
                .asText();

        mvc.perform(signedIn(get("/api/screens/%s/html".formatted(screenId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.html").value("<h1>Sign in</h1>"));

        mvc.perform(signedIn(delete("/api/meetings/%s/screens".formatted(meetingId))))
                .andExpect(status().isOk());

        mvc.perform(signedIn(get("/api/screens/%s/html".formatted(screenId))))
                .andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("select html from screen where id = ?", String.class, screenId))
                .as("the page itself is still in the row")
                .isEqualTo("<h1>Sign in</h1>");
    }
}
