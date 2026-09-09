package com.weadk.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * What counts as "no signing secret".
 *
 * <p>This exists because getting it wrong took the service down. The first version used
 * {@code @ConditionalOnProperty}, and {@code application.yml} declares the key with an
 * empty default so an operator can see it exists — to that annotation, a declared key
 * holding an empty string is present, so sign-in configured itself on a deployment that had
 * configured nothing and the service failed to start on a zero-length HS256 key.
 */
class SigningSecretPresentTest {

    @Test
    @DisplayName("a declared-but-empty property is not a secret — the case that broke startup")
    void emptyIsAbsent() {
        assertThat(SigningSecretPresent.present("")).isFalse();
        assertThat(SigningSecretPresent.present("   ")).isFalse();
        assertThat(SigningSecretPresent.present(null)).isFalse();
    }

    @Test
    @DisplayName("anything non-blank is a secret, including one too short to use")
    void nonBlankIsPresent() {
        // Short on purpose. A secret that is present but unusable must reach the length
        // check and fail startup loudly, not be silently treated as absent — someone
        // meant to configure this and got it wrong.
        assertThat(SigningSecretPresent.present("too-short")).isTrue();
        assertThat(SigningSecretPresent.present("test-secret-that-is-long-enough-for-hs256")).isTrue();
    }
}
