package com.weadk.state;

import java.util.List;
import java.util.Set;

/**
 * Whether a key belongs to the team or to one person.
 *
 * <p>The distinction did not exist while this state lived in the browser, because there
 * every key belonged to whoever's browser it was. Moving it to a shared database forces the
 * question, and the two answers are genuinely different: a design round is the project's
 * and everyone should see the same one, while a chosen language or a dragged-out rail width
 * is nobody else's business.
 *
 * <p>Shared is the default. The exceptions are listed, because that way a key nobody
 * thought about ends up visible to the team rather than silently private to one browser —
 * the failure that is noticed immediately rather than the one discovered months later.
 */
public final class StateScope {

    /** The owner of state the whole team shares. Not a valid user id, so it cannot collide. */
    public static final String SHARED = "*";

    /** Stands in for the owner when the deployment requires no sign-in. */
    public static final String ANONYMOUS = "anonymous";

    /** Exact keys that belong to the viewer rather than the team. */
    private static final Set<String> PERSONAL_KEYS = Set.of(
            "we-adk:locale",
            "we-adk:sidebar-config",
            "we-adk:version-rail-width",
            "we-adk:sketcher:chat-model",
            "we-adk:last-folder",
            "we-adk:last-user-view");

    /** Key families that belong to the viewer. */
    private static final List<String> PERSONAL_PREFIXES = List.of("we-adk:whats-new:");

    /**
     * Keys that must never be stored at all.
     *
     * <p>A Claude credential and a session token belong in the browser that obtained them.
     * The database rejects these too; this is the half that gives the caller a reason.
     */
    private static final Set<String> REJECTED_KEYS =
            Set.of("we-adk:claude-token", "we-adk:api-token", "we-adk:api-user");

    private StateScope() {}

    public static boolean personal(String key) {
        if (PERSONAL_KEYS.contains(key)) {
            return true;
        }
        return PERSONAL_PREFIXES.stream().anyMatch(key::startsWith);
    }

    public static boolean rejected(String key) {
        return REJECTED_KEYS.contains(key);
    }

    /** The row owner a key should be written under, for this viewer. */
    public static String ownerFor(String key, String viewer) {
        return personal(key) ? viewer : SHARED;
    }
}
