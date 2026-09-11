package com.weadk.ai;

/**
 * Who is making an AI call, and on whose credential.
 *
 * <p>{@code userId} is for the usage row — a bill nobody can attribute is a bill nobody
 * can act on. {@code apiKey} is the optional {@code X-Anthropic-Api-Key} override; null
 * means the server's own key.
 */
public record Caller(String userId, String apiKey) {

    public static final Caller ANONYMOUS = new Caller(null, null);

    public static Caller of(String userId, String apiKey) {
        return new Caller(blankToNull(userId), blankToNull(apiKey));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
