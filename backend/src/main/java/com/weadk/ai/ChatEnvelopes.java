package com.weadk.ai;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The exact envelopes the folder chat streams.
 *
 * <p>Its own class, with pure methods, because this is a contract with code that lives in
 * another language and another repository directory: six places in the workspace decode
 * this stream through one function, {@code readChatEvent} in
 * {@code src/components/we-adk/claude-chat.tsx}, and that function was written against the
 * shapes the Claude Code CLI emits. Renaming a field here breaks all six silently — the
 * decoder ignores what it does not recognise, so the panel would simply show nothing.
 *
 * <p>Separated out so the shapes can be asserted in a test rather than only being produced
 * at the moment they are written to a socket.
 */
final class ChatEnvelopes {

    private ChatEnvelopes() {}

    /** One token of text. Decoded as `delta` and appended to the reply as it arrives. */
    static Map<String, Object> delta(String text) {
        return Map.of(
                "type", "stream_event",
                "event", Map.of(
                        "type", "content_block_delta",
                        "delta", Map.of("type", "text_delta", "text", text)));
    }

    /**
     * The closing envelope of a turn that worked.
     *
     * <p>Read for the session's running token and cost totals, which is why the field names
     * are the API's snake_case rather than this codebase's camelCase.
     */
    static Map<String, Object> success(
            long inputTokens, long outputTokens, BigDecimal costUsd, long durationMs) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", "result");
        event.put("subtype", "success");
        event.put("usage", Map.of("input_tokens", inputTokens, "output_tokens", outputTokens));
        event.put("total_cost_usd", costUsd);
        event.put("duration_ms", durationMs);
        return event;
    }

    /**
     * A turn that finished without a usable answer.
     *
     * <p>A {@code result} with a subtype other than {@code success} is how the decoder learns
     * that a run ended without answering; it shows {@code result} as the reason. Not a
     * {@code bridge_error}, which means the bridge itself broke.
     */
    static Map<String, Object> unsuccessful(String subtype, String detail) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", "result");
        event.put("subtype", subtype);
        event.put("result", detail);
        return event;
    }

    /** The bridge failed: no key, a rejected key, a timeout, a dropped connection. */
    static Map<String, Object> bridgeError(String message) {
        return Map.of("type", "bridge_error", "error", message);
    }
}
