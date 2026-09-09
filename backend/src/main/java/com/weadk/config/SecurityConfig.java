package com.weadk.config;

import com.weadk.config.WeAdkProperties.SecurityMode;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Two chains, chosen by configuration.
 *
 * <p>A JWT resource server needs an issuer to validate against, and there is no
 * issuer on a laptop. Making the secured chain the only chain means the service
 * cannot start in development; making the open chain the only chain means it
 * ships without auth. So the mode is a property, it is named in the startup
 * log, and production sets it to {@code jwt}.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /** Open to everyone, including the docs and the actuator. */
    private static final String[] PUBLIC_PATHS = {
        // The root says what this service is and links to the workspace. Open, because the
        // whole point of it is to be readable by someone who arrived here by mistake — and a
        // 401 on the root is indistinguishable from the service being down.
        "/",
        "/actuator/health", "/actuator/health/**", "/actuator/info",
        "/v3/api-docs", "/v3/api-docs/**", "/swagger-ui.html", "/swagger-ui/**"
    };

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, WeAdkProperties props) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        // Both token modes protect the API the same way; they differ only in who signs the
        // token and how it is obtained. The authorization server's own endpoints and its
        // sign-in page are handled by earlier, narrower chains in com.weadk.oauth.
        if (props.security().mode() != SecurityMode.OPEN) {
            http.authorizeHttpRequests(auth -> auth.requestMatchers(PUBLIC_PATHS)
                            .permitAll()
                            .anyRequest()
                            .authenticated())
                    .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()));
        } else {
            http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        }
        return http.build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(WeAdkProperties props) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(props.cors().allowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
