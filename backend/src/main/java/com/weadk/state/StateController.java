package com.weadk.state;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;

/**
 * Workspace state: the rounds, tasks, canvases, IA rows and everything else the workspace
 * used to keep in the browser.
 *
 * <p>Three routes, because the browser needs exactly three things — read it all once, save
 * what changed, and hand over what an existing browser was holding the first time it
 * connects to a database that has none of it.
 */
@RestController
@RequestMapping("/api/state")
@Tag(name = "Workspace state", description = "The state the workspace used to keep in the browser.")
public class StateController {

    private final StateService service;

    public StateController(StateService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(
            summary = "Everything the caller can see, in one read.",
            description = "One request rather than one per key: the code that consumes this reads "
                    + "synchronously from inside render paths, so it hydrates once at load. "
                    + "Carries an ETag, so an unchanged workspace costs a 304 and no body.")
    public ResponseEntity<StateDtos.Snapshot> snapshot(
            @AuthenticationPrincipal Jwt jwt, WebRequest request) {
        String viewer = viewer(jwt);

        /*
         * The version is checked before the snapshot is built.
         *
         * That ordering is the point. This payload is the largest thing the service sends and
         * every page load waits on it, so the cheap question — has anything changed — is asked
         * first, and on a hit nothing is read, serialised or transmitted. `checkNotModified`
         * handles If-None-Match and sets the 304 and the ETag itself.
         */
        /*
         * A weak ETag, and it has to be weak.
         *
         * Tomcat refuses to compress a response carrying a strong ETag, and it is right to:
         * a strong tag identifies exact bytes, and compressing changes them (RFC 9110). So a
         * strong tag here silently switched gzip off — two optimisations cancelling each
         * other out, with nothing in any log to say so. `W/` says "this identifies the
         * content, not the encoding", which is true and lets both work.
         *
         * Conditional requests are unaffected: `If-None-Match` on a GET compares weakly.
         */
        String etag = "W/\"" + service.version(viewer) + "\"";
        if (request.checkNotModified(etag)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).build();
        }

        return ResponseEntity.ok()
                // `no-cache` rather than `no-store`: the browser may keep a copy, it just has
                // to revalidate before using it — which is what makes the ETag worth having.
                // `private`, because this is one person's workspace and no shared cache should
                // ever hold it.
                .cacheControl(CacheControl.noCache().cachePrivate())
                .eTag(etag)
                .body(service.snapshot(viewer));
    }

    @PutMapping
    @Operation(summary = "Apply a batch of writes and deletions.")
    public StateDtos.Result apply(
            @Valid @RequestBody StateDtos.Patch patch, @AuthenticationPrincipal Jwt jwt) {
        return service.apply(viewer(jwt), patch);
    }

    @PostMapping("/import")
    @Operation(
            summary = "Seed only the keys that do not exist yet.",
            description = "The one-time handover from a browser that still holds state. Fills gaps "
                    + "and never overwrites, so whichever browser connects first cannot flatten "
                    + "work done from another.")
    public StateDtos.Result importMissing(
            @Valid @RequestBody StateDtos.Patch patch, @AuthenticationPrincipal Jwt jwt) {
        return service.importMissing(viewer(jwt), patch);
    }

    /**
     * Who is asking.
     *
     * <p>A deployment that requires no sign-in has no subject, and its personal keys land
     * under one shared stand-in. That is the honest behaviour for a mode whose whole point
     * is that it does not know who anyone is.
     */
    private static String viewer(Jwt jwt) {
        return jwt == null || jwt.getSubject() == null ? StateScope.ANONYMOUS : jwt.getSubject();
    }
}
