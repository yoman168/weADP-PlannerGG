package com.weadk.auth;

import com.weadk.common.NotFoundException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sign-in.
 *
 * <p>The encoder and the password encoder arrive through {@link ObjectProvider} because
 * both are conditional on a signing secret: without one this service verifies tokens
 * issued elsewhere and cannot mint its own, and asking it to answers 501 rather than
 * failing to start.
 */
@Service
public class AuthService {

    private final AppUserRepository users;
    private final AuthProperties props;
    private final ObjectProvider<JwtEncoder> encoders;
    private final ObjectProvider<PasswordEncoder> passwords;

    public AuthService(
            AppUserRepository users,
            AuthProperties props,
            ObjectProvider<JwtEncoder> encoders,
            ObjectProvider<PasswordEncoder> passwords) {
        this.users = users;
        this.props = props;
        this.encoders = encoders;
        this.passwords = passwords;
    }

    public boolean canIssueTokens() {
        return props.jwt().canIssue() && encoders.getIfAvailable() != null;
    }

    /**
     * Verifies the password and mints a token.
     *
     * <p>A missing account, a wrong password and a disabled account all produce the same
     * message: the difference between them tells an attacker which addresses are real.
     */
    @Transactional
    public AuthDtos.Session login(AuthDtos.Login input) {
        JwtEncoder encoder = encoders.getIfAvailable();
        PasswordEncoder passwordEncoder = passwords.getIfAvailable();
        if (!props.jwt().canIssue() || encoder == null || passwordEncoder == null) {
            throw new AuthUnavailableException(
                    "This API does not issue tokens. Set weadk.auth.jwt.secret to enable local "
                            + "sign-in, or obtain a token from the configured identity provider.");
        }

        AppUser user = users.findByEmail(AppUser.normalise(input.email()))
                .orElseThrow(AuthService::rejected);
        if (user.isDisabled()
                || user.getPasswordHash() == null
                || !passwordEncoder.matches(input.password(), user.getPasswordHash())) {
            throw rejected();
        }

        user.signedIn();
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plus(props.ttl());
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(props.issuer())
                .subject(user.getId())
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .claim("email", user.getEmail())
                .claim("name", user.getName())
                // Read by the resource server's authorities converter; ROLE_ is added there.
                .claim("roles", List.copyOf(user.getRoles()))
                .build();
        String token = encoder
                .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
        return new AuthDtos.Session(token, expiresAt, AuthDtos.User.of(user));
    }

    @Transactional(readOnly = true)
    public AppUser require(String userId) {
        return users.findById(userId).orElseThrow(() -> new NotFoundException("User", userId));
    }

    @Transactional(readOnly = true)
    public Optional<AppUser> find(String userId) {
        return userId == null ? Optional.empty() : users.findById(userId);
    }

    private static InvalidCredentialsException rejected() {
        return new InvalidCredentialsException("That email and password do not match an account.");
    }

    /** Wrong credentials, a disabled account, or an address that does not exist. */
    public static class InvalidCredentialsException extends RuntimeException {
        public InvalidCredentialsException(String message) {
            super(message);
        }
    }

    /** Asked to issue a token by a deployment that only verifies them. */
    public static class AuthUnavailableException extends RuntimeException {
        public AuthUnavailableException(String message) {
            super(message);
        }
    }
}
