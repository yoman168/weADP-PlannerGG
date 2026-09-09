package com.weadk.support;

import static org.assertj.core.api.Assertions.assertThat;

import javax.sql.DataSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The context starts, which means Flyway applied every migration and Hibernate agreed
 * that every entity matches the schema those migrations produced.
 *
 * <p>Deliberately thin. Almost all of its value is in the fact that it ran at all.
 */
class SchemaValidationTest extends PostgresTest {

    @Autowired
    private DataSource dataSource;

    @Test
    @DisplayName("every migration applied, and every entity mapping validated against it")
    void schemaMatchesEntities() {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);

        Integer applied = jdbc.queryForObject(
                "select count(*) from flyway_schema_history where success", Integer.class);
        assertThat(applied).as("applied migrations").isGreaterThanOrEqualTo(2);

        assertThat(jdbc.queryForList("select table_name from information_schema.tables where table_schema = 'public'",
                        String.class))
                .contains("project", "meeting", "screen", "screen_request", "app_user", "ai_usage");
    }
}
