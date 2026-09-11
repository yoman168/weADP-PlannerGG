package com.weadk.oauth;

import java.time.Duration;
import java.util.List;
import java.util.Objects;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * The authorization server's configuration, under {@code weadk.oauth2}.
 *
 * <p>Only reached when {@code weadk.security.mode} is {@code oauth2}. Every value has a
 * default that works against a local workspace on port 3000, so turning the mode on is the
 * only change needed to try it.
 */
@ConfigurationProperties(prefix = "weadk.oauth2")
public record OAuth2Properties(
        String issuer, Client client, Duration accessTokenTtl, Duration refreshTokenTtl) {

    public OAuth2Properties {
        issuer = blank(issuer) ? "http://localhost:8080" : stripTrailingSlash(issuer);
        client = client == null ? new Client(null, null, null) : client;
        accessTokenTtl = accessTokenTtl == null ? Duration.ofMinutes(30) : accessTokenTtl;
        refreshTokenTtl = refreshTokenTtl == null ? Duration.ofDays(14) : refreshTokenTtl;
    }

    /**
     * The workspace, as an OAuth2 client.
     *
     * <p>A public client with no secret, because it is a browser application: anything shipped
     * to a browser is readable, so a secret there would be a secret in name only. What
     * protects the exchange instead is PKCE, which is required rather than optional.
     */
    public record Client(String id, List<String> redirectUris, List<String> postLogoutRedirectUris) {

        public Client {
            id = blank(id) ? "we-adk-workspace" : id;
            redirectUris = Objects.requireNonNullElse(
                    emptyToNull(redirectUris), List.of("http://localhost:3000/auth/callback"));
            postLogoutRedirectUris = Objects.requireNonNullElse(
                    emptyToNull(postLogoutRedirectUris), List.of("http://localhost:3000/login"));
        }
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static String stripTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private static List<String> emptyToNull(List<String> value) {
        return value == null || value.isEmpty() ? null : List.copyOf(value);
    }
}
