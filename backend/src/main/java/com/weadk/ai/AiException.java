package com.weadk.ai;

import org.springframework.http.HttpStatus;

/**
 * A failure of an AI call, with the status and problem slug it should be reported as.
 *
 * <p>Its own type rather than the shared {@code NotFoundException} / {@code ConflictException}
 * because none of these are those: an absent API key, a model that refused, an upstream
 * rate limit and an unreadable response are four different answers and the workspace
 * shows each of them differently.
 */
public class AiException extends RuntimeException {

    private final HttpStatus status;
    private final String slug;

    public AiException(HttpStatus status, String slug, String message) {
        super(message);
        this.status = status;
        this.slug = slug;
    }

    public HttpStatus status() {
        return status;
    }

    public String slug() {
        return slug;
    }

    /** No credential configured, no bridge either, and the caller did not bring a key. */
    public static AiException notConfigured() {
        return new AiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "ai-not-configured",
                "This server has no Anthropic API key and no local Claude bridge. Set "
                        + "ANTHROPIC_API_KEY on the API, point CLAUDE_BRIDGE_URL at "
                        + "scripts/claude-bridge.mjs, or send your own key as the "
                        + "X-Anthropic-Api-Key header.");
    }

    /** The model answered, but not with something this endpoint could read. */
    public static AiException unreadable(String what) {
        return new AiException(HttpStatus.BAD_GATEWAY, "ai-unreadable", what);
    }

    public static AiException refused(String detail) {
        return new AiException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "ai-refused",
                detail == null || detail.isBlank() ? "Claude declined that request." : detail);
    }

    public static AiException upstream(HttpStatus status, String detail) {
        return new AiException(status, "ai-upstream", detail);
    }
}
