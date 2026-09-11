package com.weadk.landing;

import com.weadk.config.WeAdkProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * What answers when someone opens the API in a browser.
 *
 * <p>They will. The API and the workspace differ by a port number, so mistyping one for the
 * other is a matter of time. It used to produce a bare {@code HTTP ERROR 401} and the
 * browser's own "This page isn't working", which is technically correct — the root is not on
 * the token allowlist — and looks exactly like the service being broken.
 *
 * <p>A browser is now sent to the workspace instead. Not to a page explaining the mistake,
 * which was the first attempt and was still a dead end: someone who opens this address wants
 * to use the product, so the useful answer is to put them in it. The workspace then does what
 * it always does — no session means the sign-in page, and signing in lands on the workspace.
 * So this address behaves like the front door whether or not it technically is one.
 *
 * <p>Anything that is not a browser still gets JSON. A health checker or a script that hits
 * {@code /} deserves something parseable, and a 302 to an HTML application is not it.
 */
@RestController
@Tag(name = "Root", description = "What this service is, and where the workspace is.")
public class RootController {

    private final WeAdkProperties props;
    private final String workspaceUrl;

    RootController(WeAdkProperties props, @Value("${weadk.cors.allowed-origins:}") List<String> origins) {
        this.props = props;
        // The workspace is whichever origin this API was told to accept. That is the same
        // value in every deployment, so there is nothing extra to configure and nothing that
        // can drift out of step with the CORS rule.
        this.workspaceUrl = origins.isEmpty() ? "http://localhost:3000" : origins.get(0);
    }

    @GetMapping(value = "/", produces = MediaType.APPLICATION_JSON_VALUE)
    @SecurityRequirements
    @Operation(summary = "What this service is. Open without a token, on purpose.")
    public Map<String, Object> describe() {
        return Map.of(
                "service", "WE-ADK API",
                "workspace", workspaceUrl,
                "security", props.security().mode().name().toLowerCase(java.util.Locale.ROOT),
                "docs", "/swagger-ui.html",
                "openapi", "/v3/api-docs",
                "health", "/actuator/health");
    }

    /**
     * A browser goes to the workspace.
     *
     * <p>Matched on {@code Accept: text/html}, which is what a browser sends and a script does
     * not. 302 rather than 301 on purpose: a permanent redirect would be cached by the browser
     * and would then survive a change of {@code CORS_ORIGINS}, leaving people pointed at an
     * address this API no longer serves and no way to notice.
     */
    @GetMapping(value = "/", produces = MediaType.TEXT_HTML_VALUE)
    @SecurityRequirements
    @Operation(summary = "Sends a browser to the workspace, which handles signing in.")
    public ResponseEntity<Void> toWorkspace() {
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(workspaceUrl))
                .build();
    }
}
