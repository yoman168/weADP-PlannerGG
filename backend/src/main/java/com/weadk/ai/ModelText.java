package com.weadk.ai;

import com.anthropic.models.messages.ContentBlock;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.StopReason;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Getting usable text, and then usable JSON, out of a completed message. */
public final class ModelText {

    private static final Pattern FENCED = Pattern.compile("```(?:json)?\\s*([\\s\\S]*?)```");

    private ModelText() {}

    /** Every text block joined. Thinking blocks are left out — they are not the answer. */
    public static String of(Message message) {
        StringBuilder text = new StringBuilder();
        for (ContentBlock block : message.content()) {
            block.text().ifPresent(part -> text.append(part.text()));
        }
        return text.toString();
    }

    /** True when the model declined rather than answered. */
    public static boolean refused(Message message) {
        return message.stopReason().filter(StopReason.REFUSAL::equals).isPresent();
    }

    public static String refusalDetail(Message message) {
        return message.stopDetails()
                .flatMap(details -> details.explanation())
                .orElse("Claude declined that request.");
    }

    /**
     * The JSON object in a reply, whether or not it arrived wrapped in prose or a fence.
     *
     * <p>Prompts here all end with "respond with a single JSON object and nothing else", and
     * the reply is usually exactly that. Usually is not always, so a fenced block is
     * unwrapped and, failing that, the span between the first brace and the last is taken.
     */
    public static Optional<JsonNode> object(ObjectMapper mapper, String text) {
        return between(mapper, text, '{', '}');
    }

    public static Optional<JsonNode> array(ObjectMapper mapper, String text) {
        return between(mapper, text, '[', ']');
    }

    private static Optional<JsonNode> between(ObjectMapper mapper, String text, char open, char close) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        Matcher fenced = FENCED.matcher(text);
        String candidate = (fenced.find() ? fenced.group(1) : text).trim();
        int start = candidate.indexOf(open);
        int end = candidate.lastIndexOf(close);
        if (start < 0 || end <= start) {
            return Optional.empty();
        }
        try {
            return Optional.of(mapper.readTree(candidate.substring(start, end + 1)));
        } catch (JsonProcessingException ex) {
            return Optional.empty();
        }
    }
}
