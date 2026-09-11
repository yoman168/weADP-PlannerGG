package com.weadk.support;

import org.testcontainers.containers.PostgreSQLContainer;

/**
 * The one Postgres the whole suite shares.
 *
 * <p>Extracted from {@link PostgresTest} because the OAuth2 tests need the same database
 * under a different set of properties — a mode is not something a running context can be
 * asked to change — and starting a second container for that would double the slowest part
 * of the build.
 *
 * <p>Started in a static initializer and left to the JVM to reap: the classic Testcontainers
 * singleton, which is the supported way to share one container across test classes.
 */
public final class WorkspaceDatabase {

    @SuppressWarnings("resource")
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine")
            .withDatabaseName("weadk")
            .withUsername("weadk")
            .withPassword("weadk");

    static {
        POSTGRES.start();
    }

    private WorkspaceDatabase() {}

    public static String jdbcUrl() {
        return POSTGRES.getJdbcUrl();
    }

    public static String username() {
        return POSTGRES.getUsername();
    }

    public static String password() {
        return POSTGRES.getPassword();
    }
}
