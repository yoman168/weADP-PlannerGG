package com.weadk.oauth;

import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import com.weadk.auth.AppUserRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.authorization.JdbcOAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.client.JdbcRegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.config.annotation.web.configuration.OAuth2AuthorizationServerConfiguration;
import org.springframework.security.oauth2.server.authorization.config.annotation.web.configurers.OAuth2AuthorizationServerConfigurer;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenCustomizer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.LoginUrlAuthenticationEntryPoint;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.MediaTypeRequestMatcher;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;

/**
 * The authorization server.
 *
 * <p>Active only when {@code weadk.security.mode} is {@code oauth2}. What it adds is the
 * standard thing the workspace was missing: a place where a person signs in, and a
 * standards-defined way for the browser application to obtain a token afterwards, instead
 * of a bespoke endpoint that traded a password for one.
 *
 * <p>The flow is authorization code with PKCE. The workspace is registered as a public
 * client with no secret, because it is a browser application and a secret shipped to a
 * browser is not a secret. PKCE is what stops an intercepted code from being redeemed by
 * anyone else, and it is required rather than merely allowed.
 *
 * <p>Three filter chains, in this order, each narrower than the next:
 *
 * <ol>
 *   <li>the protocol endpoints — {@code /oauth2/**} and the discovery documents
 *   <li>the sign-in page, which is session-based because a person is being authenticated
 *   <li>and then the application's own stateless chain in {@code com.weadk.config}
 * </ol>
 *
 * <p>That ordering matters. The protocol chain has to see {@code /oauth2/authorize} before
 * the stateless API chain does, or the redirect to sign in would be answered with a 401.
 */
@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(OAuth2Properties.class)
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
        prefix = "weadk.security",
        name = "mode",
        havingValue = "oauth2")
public class OAuth2ServerConfig {

    private static final Logger log = LoggerFactory.getLogger(OAuth2ServerConfig.class);

    /** The scopes the workspace asks for. `openid` is what makes an id token available. */
    static final List<String> SCOPES = List.of(OidcScopes.OPENID, OidcScopes.PROFILE, "weadk.api");

    /* ------------------------------------------------------------------ */
    /* Chain 1 — the protocol endpoints                                    */
    /* ------------------------------------------------------------------ */

    @Bean
    @Order(1)
    SecurityFilterChain authorizationServerChain(HttpSecurity http) throws Exception {
        OAuth2AuthorizationServerConfigurer configurer =
                OAuth2AuthorizationServerConfigurer.authorizationServer();

        http.securityMatcher(configurer.getEndpointsMatcher())
                .with(configurer, server -> server.oidc(Customizer.withDefaults()))
                // Stated rather than inherited. The browser redeems its code against
                // /oauth2/token from the workspace's origin, so the response has to carry the
                // CORS headers or the fetch cannot read it — and a token exchange that fails
                // only in a browser is a bad thing to discover late.
                .cors(Customizer.withDefaults())
                .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
                // An unauthenticated browser arriving at /oauth2/authorize is sent to sign in.
                // Restricted to requests that actually want HTML: a programmatic call should
                // get a 401 rather than a page telling it to use its eyes.
                .exceptionHandling(handling -> handling.defaultAuthenticationEntryPointFor(
                        new LoginUrlAuthenticationEntryPoint("/login"),
                        new MediaTypeRequestMatcher(MediaType.TEXT_HTML)));
        return http.build();
    }

    /* ------------------------------------------------------------------ */
    /* Chain 2 — signing in                                                */
    /* ------------------------------------------------------------------ */

    /**
     * The sign-in page and the session behind it.
     *
     * <p>Session-based, unlike everything else here, and deliberately so: this is the one
     * place a person proves who they are, and the result has to survive the redirect back to
     * {@code /oauth2/authorize} that immediately follows.
     */
    @Bean
    @Order(2)
    SecurityFilterChain loginChain(HttpSecurity http) throws Exception {
        http.securityMatcher("/login", "/logout", "/oauth2/consent", "/css/**", "/favicon.ico")
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .formLogin(form -> form.loginPage("/login")
                        .loginProcessingUrl("/login")
                        // Back to the authorization request that sent them here. Spring keeps it
                        // in the session, so the default saved-request behaviour is right.
                        .failureUrl("/login?error"))
                .logout(logout -> logout
                        // A GET, which is not Spring's default and is required here. The
                        // workspace signs out by navigating the browser to this URL from
                        // another origin, and the session cookie is SameSite=Lax — sent on a
                        // top-level GET navigation and withheld from a cross-site POST. So a
                        // POST-only logout would arrive with no session to end.
                        //
                        // The tradeoff is that a crafted link can sign someone out. That is a
                        // nuisance rather than a breach: it destroys a session, it cannot
                        // create one or read anything.
                        .logoutRequestMatcher(PathPatternRequestMatcher.withDefaults()
                                .matcher(HttpMethod.GET, "/logout"))
                        .logoutSuccessUrl("/login?signedOut")
                        .permitAll());
        return http.build();
    }

    /* ------------------------------------------------------------------ */
    /* Chain 3 — the endpoint that is no longer the way in                 */
    /* ------------------------------------------------------------------ */

    /**
     * Lets {@code POST /api/auth/login} reach its controller, which answers 501.
     *
     * <p>It needs a chain of its own rather than a line in either neighbour. Left to the API
     * chain it would answer 401, and a client reading that would go off and check a password
     * that was never the problem. Folded into the sign-in chain above it would inherit that
     * chain's CSRF protection and answer 403 to a JSON post, which is the same misdirection
     * wearing a different number.
     */
    @Bean
    @Order(3)
    SecurityFilterChain legacyTokenEndpointChain(HttpSecurity http) throws Exception {
        http.securityMatcher("/api/auth/login")
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(
                        org.springframework.security.config.http.SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }

    /* ------------------------------------------------------------------ */
    /* Server, client and key                                              */
    /* ------------------------------------------------------------------ */

    @Bean
    AuthorizationServerSettings authorizationServerSettings(OAuth2Properties props) {
        return AuthorizationServerSettings.builder().issuer(props.issuer()).build();
    }

    @Bean
    JWKSource<SecurityContext> jwkSource(SigningKeys keys) {
        return keys.jwkSource();
    }

    /**
     * The decoder the resource server validates with.
     *
     * <p>Built from the key source directly rather than by fetching this service's own JWK
     * set over HTTP. Doing it over HTTP would make the service depend on being able to reach
     * itself, which fails in exactly the environments where it is hardest to debug.
     */
    @Bean
    JwtDecoder jwtDecoder(JWKSource<SecurityContext> jwkSource) {
        return OAuth2AuthorizationServerConfiguration.jwtDecoder(jwkSource);
    }

    @Bean
    OAuth2AuthorizationService authorizationService(
            JdbcTemplate jdbc, RegisteredClientRepository clients) {
        return new JdbcOAuth2AuthorizationService(jdbc, clients);
    }

    /**
     * The client registry, in the database, seeded with the workspace on first boot.
     *
     * <p>Seeded rather than hardcoded so its redirect URIs can be corrected in a deployment
     * without a rebuild — a wrong redirect URI is the single most common reason an OAuth2
     * flow fails, and needing a new image to fix one is a bad afternoon.
     */
    @Bean
    RegisteredClientRepository registeredClientRepository(DataSource dataSource, OAuth2Properties props) {
        JdbcRegisteredClientRepository repository =
                new JdbcRegisteredClientRepository(new JdbcTemplate(dataSource));
        RegisteredClient existing = repository.findByClientId(props.client().id());
        RegisteredClient desired = workspaceClient(props);
        if (existing == null) {
            repository.save(desired);
            log.info(
                    "Registered the OAuth2 client '{}' with redirect URIs {}.",
                    props.client().id(),
                    props.client().redirectUris());
        } else if (!existing.getRedirectUris().equals(desired.getRedirectUris())
                || !existing.getPostLogoutRedirectUris()
                        .equals(desired.getPostLogoutRedirectUris())) {
            // Saved under the stored row's id, so the registration is updated rather than a
            // second one inserted under the same client id. Without this the URIs are only
            // ever read on the first boot against an empty database, and every later change
            // to them is ignored in silence — which surfaces as a 401 from /oauth2/authorize.
            repository.save(RegisteredClient.from(desired).id(existing.getId()).build());
            log.info(
                    "Updated the OAuth2 client '{}' to redirect URIs {}.",
                    props.client().id(),
                    props.client().redirectUris());
        }
        return repository;
    }

    private static RegisteredClient workspaceClient(OAuth2Properties props) {
        RegisteredClient.Builder client = RegisteredClient.withId(UUID.randomUUID().toString())
                .clientId(props.client().id())
                .clientName("WE-ADK workspace")
                // No secret, and none possible: a browser application cannot keep one.
                .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                // No refresh token grant, and that is not an omission.
                //
                // Spring will not issue a refresh token to a public client on the
                // authorization code grant, and it is right not to: a refresh token is a
                // long-lived credential, browser storage is readable by any script that gets
                // injected, and the whole point of a public client is that it cannot keep a
                // secret. Renewal instead goes back through /oauth2/authorize, where the
                // long-lived credential is the session cookie — http-only, so a script
                // cannot read it. An expiring access token therefore costs a redirect the
                // user does not see, rather than a password prompt.
                .clientSettings(ClientSettings.builder()
                        // Not optional. Without PKCE a public client's authorization code can be
                        // redeemed by whoever intercepts it.
                        .requireProofKey(true)
                        // No consent screen: the client and the server are the same product, and
                        // asking someone to authorise an application to be itself is noise.
                        .requireAuthorizationConsent(false)
                        .build())
                .tokenSettings(TokenSettings.builder()
                        .accessTokenTimeToLive(props.accessTokenTtl())
                        .build());
        props.client().redirectUris().forEach(client::redirectUri);
        props.client().postLogoutRedirectUris().forEach(client::postLogoutRedirectUri);
        SCOPES.forEach(client::scope);
        return client.build();
    }

    /* ------------------------------------------------------------------ */
    /* What goes in the token                                              */
    /* ------------------------------------------------------------------ */

    /**
     * Adds the claims the API reads.
     *
     * <p>{@code sub} is already the user id, because that is the username the sign-in service
     * hands back. What the API also wants is the roles and the email, so that
     * {@code /api/auth/me} and the usage rows can name a person without a second query.
     */
    @Bean
    OAuth2TokenCustomizer<JwtEncodingContext> tokenCustomizer(AppUserRepository users) {
        return context -> {
            if (!"access_token".equals(context.getTokenType().getValue())
                    && !context.getTokenType().getValue().equals("id_token")) {
                return;
            }
            String subject = context.getPrincipal().getName();
            users.findById(subject).ifPresent(user -> context.getClaims().claims(claims -> {
                /*
                 * `ArrayList`, and it has to be.
                 *
                 * These claims are serialised into the `oauth2_authorization` row along with
                 * the token, and read back by an ObjectMapper whose allowlist Spring Security
                 * controls. `List.copyOf` returns `ImmutableCollections$List12`, which is not
                 * on that list, so the row wrote cleanly and then threw on every later read:
                 * "The class with java.util.ImmutableCollections$List12 ... is not in the
                 * allowlist". A 500 from the authorization endpoint, hours after the code that
                 * caused it ran.
                 */
                claims.put("roles", new ArrayList<>(user.getRoles()));
                claims.put("email", user.getEmail());
                claims.put("name", user.getName());
            }));
        };
    }

    /*
     * There is deliberately no AuthenticationProvider bean here.
     *
     * One used to be declared, to make it obvious which user store the sign-in page checks
     * against. Spring warned about it on every boot and was right to: an explicit provider
     * bean takes over the global AuthenticationManager and sidelines the UserDetailsService
     * auto-configuration, which is a surprising thing to do to gain a comment. The store is
     * `AppUserDetailsService` and the hasher is `PasswordConfig`; Spring wires them itself.
     */
}
