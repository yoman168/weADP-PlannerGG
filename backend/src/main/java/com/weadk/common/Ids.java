package com.weadk.common;

import java.security.SecureRandom;

/**
 * Ids the workspace can live with.
 *
 * <p>The client supplies its own for anything it already named — a screen's id
 * is written into stored pages and into the links between them, so the server
 * generating a different one would break every reference. This is only for
 * rows arriving without one.
 */
public final class Ids {

    private static final char[] ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private Ids() {}

    public static String generate(String prefix) {
        StringBuilder out = new StringBuilder(prefix).append('-');
        for (int i = 0; i < 10; i++) {
            out.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
        }
        return out.toString();
    }

    /** The given id when there is one, a generated one when there is not. */
    public static String orGenerate(String supplied, String prefix) {
        return supplied == null || supplied.isBlank() ? generate(prefix) : supplied.trim();
    }
}
