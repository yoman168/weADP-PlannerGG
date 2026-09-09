package com.weadk.ai;

import java.util.Locale;

/**
 * Which request knobs a model will accept.
 *
 * <p>Adaptive thinking and {@code output_config.effort} are rejected outright by the small
 * models — a 400, not a warning — so sending them unconditionally would break the folder
 * chat, whose default model is Haiku. The rule errs towards leaving a knob off: omitting
 * one costs a little quality, sending an unsupported one costs the whole request.
 */
final class ModelCapabilities {

    private ModelCapabilities() {}

    /** True for the models that take {@code thinking: {type: "adaptive"}}. */
    static boolean adaptiveThinking(String model) {
        return !small(model);
    }

    /** True for the models that take {@code output_config.effort}. */
    static boolean effort(String model) {
        return !small(model);
    }

    /**
     * Haiku, and the pre-4.6 generations, take neither.
     *
     * <p>Matched on the family name rather than a fixed list of ids, so a model released
     * after this was written is treated as a current one — which is the direction that
     * fails safe, since every current model accepts both.
     */
    private static boolean small(String model) {
        if (model == null) {
            return true;
        }
        String id = model.toLowerCase(Locale.ROOT);
        return id.contains("haiku")
                || id.contains("sonnet-4-5")
                || id.contains("sonnet-3")
                || id.contains("opus-4-5")
                || id.contains("opus-3");
    }
}
