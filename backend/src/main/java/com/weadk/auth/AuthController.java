package com.weadk.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Signing in, and reading back who signed in.
 *
 * <p>The two failures particular to sign-in are handled here rather than in the shared
 * advice: wrong credentials must not be reported as a validation error, and a deployment
 * that only verifies tokens must say so rather than answering 401. Both are written in
 * the same problem-detail shape the rest of the API uses.
 */
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth", description = "Sign in, and who the caller is.")
public class AuthController {

    private final AuthService service;

    public AuthController(AuthService service) {
        this.service = service;
    }

    @PostMapping("/login")
    @SecurityRequirements
    @Operation(
            summary = "Exchange an email and password for a bearer token.",
            description = "Available when this deployment signs its own tokens; 501 when it only "
                    + "verifies tokens from an external issuer.")
    public AuthDtos.Session login(@Valid @RequestBody AuthDtos.Login input) {
        return service.login(input);
    }

    @GetMapping("/me")
    @Operation(summary = "The account behind the bearer token.")
    public AuthDtos.User me(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) {
            throw new AuthService.InvalidCredentialsException("Sign in to the WE-ADK API first.");
        }
        return AuthDtos.User.of(service.require(jwt.getSubject()));
    }

    @ExceptionHandler(AuthService.InvalidCredentialsException.class)
    ProblemDetail onInvalidCredentials(AuthService.InvalidCredentialsException ex) {
        return problem(HttpStatus.UNAUTHORIZED, "Not signed in", ex.getMessage(), "unauthenticated");
    }

    @ExceptionHandler(AuthService.AuthUnavailableException.class)
    ProblemDetail onUnavailable(AuthService.AuthUnavailableException ex) {
        return problem(HttpStatus.NOT_IMPLEMENTED, "Sign-in not available", ex.getMessage(), "sign-in-unavailable");
    }

    private static ProblemDetail problem(HttpStatus status, String title, String detail, String slug) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setTitle(title);
        body.setType(URI.create("https://we-adk.dev/problems/" + slug));
        return body;
    }
}
