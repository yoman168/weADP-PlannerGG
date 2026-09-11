package com.weadk.auth;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;

/**
 * Whether this deployment has been given a signing secret.
 *
 * <p>Not {@code @ConditionalOnProperty}, which was the first attempt and was wrong.
 * {@code application.yml} declares the key with an empty default so an operator can see it
 * exists — {@code secret: ${WEADK_AUTH_JWT_SECRET:}} — and to that annotation a declared
 * key holding an empty string is a key that is present. So the whole of {@link AuthConfig}
 * activated on a deployment that had configured nothing, and the service failed to start on
 * a zero-length HS256 key.
 *
 * <p>Blank is therefore "not configured": sign-in is off, the service verifies tokens from
 * whatever issuer it was pointed at, and it starts. A secret that is present but too short
 * is a different thing — someone meant to configure this and got it wrong — and that still
 * fails at startup rather than signing weakly.
 *
 * <p>It also stands down entirely in {@code oauth2} mode. The authorization server issues
 * RS256 tokens signed with a key pair and contributes its own decoder, so leaving this one
 * in the context would mean two {@code JwtDecoder} beans and a service that cannot start.
 * The two token formats are alternatives, not layers.
 */
class SigningSecretPresent implements Condition {

    static final String KEY = "weadk.auth.jwt.secret";

    /** Split out from {@link #matches} so the rule itself can be tested. */
    static boolean present(String secret) {
        return secret != null && !secret.isBlank();
    }

    /** The mode that issues its own RS256 tokens instead, making this path redundant. */
    static final String OAUTH2_MODE = "oauth2";

    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        String mode = context.getEnvironment().getProperty("weadk.security.mode");
        if (mode != null && OAUTH2_MODE.equalsIgnoreCase(mode.trim())) {
            return false;
        }
        return present(context.getEnvironment().getProperty(KEY));
    }
}
