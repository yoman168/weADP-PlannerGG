package com.weadk.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Password hashing, always available.
 *
 * <p>Deliberately not inside {@link AuthConfig}: that whole class is conditional on a
 * signing secret, and an account still has to be creatable — and its password still has
 * to be hashed — in a deployment that verifies tokens issued somewhere else.
 */
@Configuration
public class PasswordConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
