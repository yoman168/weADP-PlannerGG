package com.weadk.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Everything this service is told about its surroundings, in one place.
 *
 * <p>Bound rather than read through {@code @Value} so a missing or misspelled
 * key fails at startup with the property name in the message, instead of
 * arriving as a null halfway through a request.
 */
@ConfigurationProperties(prefix = "weadk")
public record WeAdkProperties(Security security, Cors cors, Anthropic anthropic) {

    public enum SecurityMode {
        /** Bearer token required on /api/**, verified against a configured issuer or secret. */
        JWT,
        /**
         * This service is the issuer: a full OAuth2 authorization server with a sign-in page,
         * authorization code flow with PKCE, and RS256 tokens it signs itself.
         */
        OAUTH2,
        /** Local development and CI, where there is no issuer to validate against. */
        OPEN
    }

    public record Security(SecurityMode mode) {
        public Security {
            if (mode == null) {
                mode = SecurityMode.OPEN;
            }
        }
    }

    public record Cors(List<String> allowedOrigins) {
        public Cors {
            allowedOrigins = allowedOrigins == null ? List.of() : List.copyOf(allowedOrigins);
        }
    }

    public record Anthropic(String apiKey, String model) {
        /** Absent in dev: the generation endpoints say so rather than failing. */
        public boolean configured() {
            return apiKey != null && !apiKey.isBlank();
        }
    }
}
