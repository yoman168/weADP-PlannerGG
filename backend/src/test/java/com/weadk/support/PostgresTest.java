package com.weadk.support;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Base for the tests that need the real thing: a Postgres, the Flyway migrations run
 * against it, and Hibernate's {@code ddl-auto: validate} checking every entity mapping
 * against what those migrations built.
 *
 * <p>That last part is why these tests exist. An entity that disagrees with its table is
 * not caught by compiling and is not caught by a unit test; it is caught here, or by a
 * user. Booting the whole context against a real database is the only check that counts.
 *
 * <p>The container is {@link WorkspaceDatabase}, shared by the whole suite. Every subclass
 * of this class also shares one Spring context, so the property set below is deliberately
 * the only one here: a different set boots a second context, which is why the OAuth2 tests
 * declare their own rather than extending this.
 */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class PostgresTest {

    public static final String SEED_EMAIL = "seed@we-adk.test";
    public static final String SEED_PASSWORD = "seed-password-1";

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", WorkspaceDatabase::jdbcUrl);
        registry.add("spring.datasource.username", WorkspaceDatabase::username);
        registry.add("spring.datasource.password", WorkspaceDatabase::password);

        // Tokens required, and signed by this service, so the tests exercise the same
        // filter chain production runs rather than the open one.
        registry.add("weadk.security.mode", () -> "jwt");
        registry.add("weadk.auth.jwt.secret", () -> "test-secret-that-is-long-enough-for-hs256");
        registry.add("weadk.auth.seed.email", () -> SEED_EMAIL);
        registry.add("weadk.auth.seed.password", () -> SEED_PASSWORD);
        registry.add("weadk.auth.seed.name", () -> "Seed Account");

        // Pinned empty on purpose. Left to the default it reads ANTHROPIC_API_KEY from the
        // environment, and a developer who has one exported would have these tests spending
        // real money against the real API.
        registry.add("weadk.anthropic.api-key", () -> "");
    }
}
