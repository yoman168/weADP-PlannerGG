package com.weadk.auth;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Sign-in configuration, under {@code weadk.auth}.
 *
 * <p>Separate from {@code weadk.security}, which decides whether tokens are
 * <em>required</em>. This decides whether this service can <em>issue</em> them: with a
 * secret set it signs its own HS256 tokens and {@code POST /api/auth/login} works; with
 * an external issuer configured instead (through the standard
 * {@code spring.security.oauth2.resourceserver} properties) it verifies and does not
 * issue, and local sign-in answers 501.
 *
 * <p>Every field has a default, so the service starts without any of these keys being
 * present in a yml file.
 */
@ConfigurationProperties(prefix = "weadk.auth")
public record AuthProperties(String issuer, Duration ttl, Jwt jwt, Seed seed) {

    /** Shortest secret HS256 will accept: 256 bits. */
    public static final int MIN_SECRET_BYTES = 32;

    public AuthProperties {
        issuer = issuer == null || issuer.isBlank() ? "we-adk-api" : issuer;
        ttl = ttl == null ? Duration.ofHours(12) : ttl;
        jwt = jwt == null ? new Jwt(null) : jwt;
        seed = seed == null ? new Seed(null, null, null, null) : seed;
    }

    public record Jwt(String secret) {
        /** True when this service can sign its own tokens. */
        public boolean canIssue() {
            return secret != null && secret.length() >= MIN_SECRET_BYTES;
        }
    }

    /**
     * The first account, created only when the table is empty.
     *
     * <p>A service with authentication switched on and no way in is a service nobody can
     * use; a service that seeds a known password on every boot is a back door. So this
     * runs once, on an empty table, and only when both fields are given.
     */
    public record Seed(String email, String password, String name, String roles) {
        public boolean given() {
            return email != null && !email.isBlank() && password != null && !password.isBlank();
        }
    }
}
