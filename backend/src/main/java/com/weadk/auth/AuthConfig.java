package com.weadk.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * What sign-in adds to the security setup.
 *
 * <p>Three things, all conditional on a signing secret being configured, and none of
 * them replacing the chain in {@code com.weadk.config.SecurityConfig}: an encoder and a
 * decoder for this service's own HS256 tokens, and one filter chain scoped to the login
 * route so that route stays reachable when the main chain requires a token.
 *
 * <p>The chain is deliberately matched to {@code /api/auth/login} alone. Widening it to
 * {@code /api/auth/**} would make {@code /api/auth/me} anonymous as well, and "who am I"
 * answered without a token is not an answer.
 *
 * <p>Providing a {@link JwtDecoder} here also switches the resource server onto these
 * tokens: Boot's own OAuth2 auto-configuration backs off when one is already in the
 * context, so the main chain's {@code oauth2ResourceServer().jwt()} picks this up. With
 * no secret set — see {@link SigningSecretPresent} for what counts as none — nothing here
 * is created and an external issuer configured through
 * {@code spring.security.oauth2.resourceserver.*} is used unchanged.
 */
@Configuration
@Conditional(SigningSecretPresent.class)
public class AuthConfig {

    /** Runs before the application's main chain, which matches every request. */
    @Bean
    @Order(1)
    SecurityFilterChain loginFilterChain(HttpSecurity http) throws Exception {
        return http.securityMatcher("/api/auth/login")
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .build();
    }

    @Bean
    JwtEncoder jwtEncoder(AuthProperties props) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(secretKey(props)));
    }

    @Bean
    JwtDecoder jwtDecoder(AuthProperties props) {
        return NimbusJwtDecoder.withSecretKey(secretKey(props))
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
    }

    private static SecretKey secretKey(AuthProperties props) {
        byte[] bytes = props.jwt().secret().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < AuthProperties.MIN_SECRET_BYTES) {
            throw new IllegalStateException("weadk.auth.jwt.secret must be at least "
                    + AuthProperties.MIN_SECRET_BYTES
                    + " bytes for HS256; got "
                    + bytes.length
                    + ".");
        }
        return new SecretKeySpec(bytes, "HmacSHA256");
    }
}
