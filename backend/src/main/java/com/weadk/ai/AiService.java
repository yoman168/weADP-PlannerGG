package com.weadk.ai;

import com.anthropic.client.AnthropicClient;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.BadRequestException;
import com.anthropic.errors.PermissionDeniedException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.errors.UnauthorizedException;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * The AI calls that answer in one shot: a canvas edit, a set of proposed screens, a list
 * of functional requirements, and the key check.
 *
 * <p>All four have the same shape — build a prompt, ask for JSON, read the JSON back —
 * and all four record what they spent whether or not they succeeded.
 */
@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    /** Enough for a one-word answer; the key check does not need room to talk. */
    private static final long VERIFY_MAX_TOKENS = 32;

    private final AnthropicClients clients;
    private final AiProperties props;
    private final UsageRecorder usage;
    private final ObjectMapper mapper;

    public AiService(
            AnthropicClients clients, AiProperties props, UsageRecorder usage, ObjectMapper mapper) {
        this.clients = clients;
        this.props = props;
        this.usage = usage;
        this.mapper = mapper;
    }

    public AiDtos.Status status() {
        return new AiDtos.Status(
                clients.serverConfigured(), props.modelFor("sonnet"), props.models());
    }

    /* ------------------------------------------------------------------ */
    /* Canvas edits                                                        */
    /* ------------------------------------------------------------------ */

    public AiDtos.CanvasResponse canvas(AiDtos.CanvasRequest request, Caller caller) {
        String prompt = Prompts.canvas(
                request.instruction(), request.catalog(), describe(request.blocks()));
        Completed done = complete(
                "canvas",
                model(request.model(), "sonnet"),
                prompt,
                props.timeout().canvas(),
                props.tokens().max(),
                null,
                caller,
                request.projectId(),
                request.label() == null ? request.instruction() : request.label());

        JsonNode envelope = ModelText.object(mapper, done.text())
                .orElseThrow(() -> AiException.unreadable(
                        "Claude did not answer with the JSON this canvas reads. It said: "
                                + excerpt(done.text())));
        String reply = text(envelope, "reply", "Done.");
        List<Map<String, Object>> operations = new ArrayList<>();
        JsonNode ops = envelope.get("operations");
        if (ops != null && ops.isArray()) {
            for (JsonNode candidate : ops) {
                if (candidate.isObject()) {
                    operations.add(asMap(candidate));
                }
            }
        }
        return new AiDtos.CanvasResponse(reply, operations, done.usage());
    }

    /** The canvas as the prompt describes it: index, id, kind, name and props, in order. */
    private String describe(List<AiDtos.CanvasBlock> blocks) {
        if (blocks == null || blocks.isEmpty()) {
            return "The canvas is currently empty.";
        }
        StringBuilder out = new StringBuilder();
        for (int index = 0; index < blocks.size(); index++) {
            AiDtos.CanvasBlock block = blocks.get(index);
            if (index > 0) {
                out.append('\n');
            }
            out.append(index)
                    .append(". id=")
                    .append(block.id())
                    .append(" kind=")
                    .append(block.kind())
                    .append(" name=\"")
                    .append(block.name() == null ? "" : block.name())
                    .append('"');
            if (block.hidden()) {
                out.append(" (hidden)");
            }
            out.append(" props=").append(json(block.props()));
        }
        return out.toString();
    }

    /* ------------------------------------------------------------------ */
    /* Meeting notes to screens                                            */
    /* ------------------------------------------------------------------ */

    public AiDtos.GenerateResponse generate(AiDtos.GenerateRequest request, Caller caller) {
        String baseScreen = null;
        if (request.baseScreen() != null) {
            List<String> blocks = new ArrayList<>();
            for (AiDtos.BaseScreenBlock block : nullSafe(request.baseScreen().blocks())) {
                blocks.add(
                        block.label() == null || block.label().isBlank()
                                ? block.kind()
                                : block.kind() + " \"" + block.label() + "\"");
            }
            baseScreen = Prompts.baseScreen(
                    request.baseScreen().path(), request.baseScreen().route(), blocks);
        }

        String references = request.references();
        if (references != null && request.referenceNames() != null && !request.referenceNames().isEmpty()) {
            references = references
                    + "\n\nAttachments with no extractable text, listed so you know they exist: "
                    + String.join(", ", request.referenceNames());
        }

        String prompt = Prompts.generate(
                request.notes(),
                request.catalog(),
                request.customer(),
                request.sessionTitle(),
                request.screens(),
                references,
                baseScreen);

        Completed done = complete(
                "generate",
                model(request.model(), "sonnet"),
                prompt,
                props.timeout().generate(),
                props.tokens().max(),
                AiDtos.Effort.high,
                caller,
                request.projectId(),
                request.sessionTitle());

        JsonNode envelope = ModelText.object(mapper, done.text())
                .orElseThrow(() -> AiException.unreadable(
                        "Claude did not return screens this board could read. It said: "
                                + excerpt(done.text())));

        List<AiDtos.GeneratedScreen> screens = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        JsonNode proposals = envelope.get("screens");
        if (proposals != null && proposals.isArray()) {
            for (JsonNode candidate : proposals) {
                readScreen(candidate).ifPresentOrElse(screens::add, () -> skipped.add(excerpt(candidate.toString())));
            }
        }
        if (screens.isEmpty()) {
            throw AiException.unreadable("Claude proposed no screens that this board could read.");
        }
        if (!skipped.isEmpty()) {
            log.info("Generate dropped {} unreadable screen proposal(s).", skipped.size());
        }
        return new AiDtos.GenerateResponse(
                text(envelope, "reply", "Proposed screens from the notes."), screens, skipped, done.usage());
    }

    /**
     * One proposal, or nothing.
     *
     * <p>Read one at a time on purpose: a single malformed screen in a set of five should
     * cost the one, not all five.
     */
    private Optional<AiDtos.GeneratedScreen> readScreen(JsonNode node) {
        if (node == null || !node.isObject()) {
            return Optional.empty();
        }
        String name = text(node, "name", null);
        JsonNode blocks = node.get("blocks");
        if (name == null || name.isBlank() || blocks == null || !blocks.isArray() || blocks.isEmpty()) {
            return Optional.empty();
        }
        List<AiDtos.GeneratedBlock> read = new ArrayList<>();
        for (JsonNode candidate : blocks) {
            String kind = text(candidate, "kind", null);
            if (kind == null || kind.isBlank()) {
                continue;
            }
            JsonNode propsNode = candidate.get("props");
            read.add(new AiDtos.GeneratedBlock(
                    kind, propsNode != null && propsNode.isObject() ? asMap(propsNode) : Map.of()));
        }
        if (read.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new AiDtos.GeneratedScreen(
                name, text(node, "route", null), text(node, "rationale", null), read));
    }

    /* ------------------------------------------------------------------ */
    /* Functional requirements                                             */
    /* ------------------------------------------------------------------ */

    public AiDtos.FrdResponse frd(AiDtos.FrdRequest request, Caller caller) {
        String prompt = Prompts.frd(
                request.prdId(),
                request.prdTitle(),
                request.prdDescription() == null ? "" : request.prdDescription(),
                nullSafe(request.requirements()),
                nullSafe(request.screens()));
        Completed done = complete(
                "frd",
                model(request.model(), "sonnet"),
                prompt,
                props.timeout().frd(),
                props.tokens().max(),
                null,
                caller,
                request.projectId(),
                request.prdId());

        Optional<JsonNode> array = ModelText.array(mapper, done.text());
        if (array.isEmpty()) {
            // The caller falls back to deriving items locally, so the prose is worth more
            // than an error here.
            return new AiDtos.FrdResponse(List.of(), done.text(), done.usage());
        }
        List<AiDtos.FrdItem> items = new ArrayList<>();
        for (JsonNode candidate : array.get()) {
            String title = candidate.isTextual() ? candidate.asText() : text(candidate, "title", null);
            if (title != null && !title.isBlank()) {
                items.add(new AiDtos.FrdItem(title.trim()));
            }
        }
        return new AiDtos.FrdResponse(items, null, done.usage());
    }

    /* ------------------------------------------------------------------ */
    /* Key check                                                           */
    /* ------------------------------------------------------------------ */

    /** One tiny call, to prove a credential works before the workspace relies on it. */
    public AiDtos.VerifyResponse verify(Caller caller) {
        String model = props.modelFor("haiku");
        Completed done = complete(
                "verify",
                model,
                "Reply with exactly OK",
                Duration.ofSeconds(60),
                VERIFY_MAX_TOKENS,
                null,
                caller,
                null,
                "credential check");
        return new AiDtos.VerifyResponse(!done.text().isBlank(), model);
    }

    /* ------------------------------------------------------------------ */
    /* The one call all of them make                                       */
    /* ------------------------------------------------------------------ */

    /** A finished call: the text it produced, and what it cost. */
    record Completed(String text, AiDtos.UsageView usage) {}

    private Completed complete(
            String endpoint,
            String model,
            String prompt,
            Duration timeout,
            long maxTokens,
            AiDtos.Effort effort,
            Caller caller,
            String projectId,
            String label) {
        AnthropicClient client = clients.forRequest(caller.apiKey(), timeout);
        MessageCreateParams.Builder params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(maxTokens)
                .addUserMessage(prompt);
        if (effort != null && ModelCapabilities.effort(model)) {
            params.outputConfig(OutputConfig.builder().effort(effortOf(effort)).build());
        }

        AiUsage row = new AiUsage(endpoint, model).by(caller.userId()).on(projectId, label);
        long startedAt = System.nanoTime();
        Message message;
        try {
            message = client.messages().create(params.build());
        } catch (RuntimeException ex) {
            AiException mapped = mapFailure(ex);
            usage.record(row.took(elapsedMs(startedAt))
                    .outcome(AiUsage.Outcome.ERROR, mapped.getMessage()));
            throw mapped;
        }

        long durationMs = elapsedMs(startedAt);
        row.withTokens(message.usage()).took(durationMs);
        if (ModelText.refused(message)) {
            String detail = ModelText.refusalDetail(message);
            usage.record(row.outcome(AiUsage.Outcome.REFUSAL, detail));
            throw AiException.refused(detail);
        }
        usage.record(row.outcome(AiUsage.Outcome.OK, null));
        return new Completed(
                ModelText.of(message),
                new AiDtos.UsageView(
                        model,
                        message.usage().inputTokens(),
                        message.usage().outputTokens(),
                        row.getCostUsd(),
                        durationMs));
    }

    /**
     * Turns an SDK failure into the answer the workspace should show.
     *
     * <p>Caught as separate types rather than by status code because the four that matter
     * want four different sentences: a rejected key is the user's to fix, a rate limit is
     * worth retrying, a bad model id is a configuration mistake, and a timeout is neither.
     */
    static AiException mapFailure(RuntimeException ex) {
        if (ex instanceof AiException already) {
            return already;
        }
        if (ex instanceof UnauthorizedException) {
            return AiException.upstream(
                    HttpStatus.UNAUTHORIZED, "Anthropic rejected that API key. Check it and try again.");
        }
        if (ex instanceof PermissionDeniedException) {
            return AiException.upstream(
                    HttpStatus.FORBIDDEN, "That API key is not allowed to use this model.");
        }
        if (ex instanceof RateLimitException) {
            return AiException.upstream(
                    HttpStatus.TOO_MANY_REQUESTS, "Anthropic is rate limiting this key. Try again shortly.");
        }
        if (ex instanceof com.anthropic.errors.NotFoundException) {
            return AiException.upstream(
                    HttpStatus.BAD_GATEWAY,
                    "Anthropic does not know that model. Check weadk.ai.models on the API.");
        }
        if (ex instanceof BadRequestException bad) {
            return AiException.upstream(
                    HttpStatus.BAD_GATEWAY, "Anthropic rejected the request: " + excerpt(bad.getMessage()));
        }
        if (ex instanceof AnthropicIoException) {
            return AiException.upstream(
                    HttpStatus.GATEWAY_TIMEOUT, "The call to Anthropic timed out or the connection dropped.");
        }
        if (ex instanceof AnthropicServiceException service) {
            log.warn("Anthropic service error", service);
            // The body's own sentence when there is one. From the real API that is
            // "Overloaded" and the like; from the local Claude bridge it is the only place
            // "the claude CLI was not found" can reach the person who can fix it.
            String detail = upstreamMessage(service);
            return AiException.upstream(
                    HttpStatus.BAD_GATEWAY,
                    detail.isBlank() ? "Anthropic returned an error." : excerpt(detail));
        }
        log.error("Unexpected failure calling Anthropic", ex);
        return AiException.upstream(HttpStatus.BAD_GATEWAY, "Could not complete the call to Anthropic.");
    }

    /** The {@code error.message} of an Anthropic-shaped error body, or "" when there is none. */
    private static String upstreamMessage(AnthropicServiceException ex) {
        try {
            JsonNode body = ex.body().convert(JsonNode.class);
            return body == null ? "" : body.path("error").path("message").asText("");
        } catch (RuntimeException unreadable) {
            return "";
        }
    }

    static OutputConfig.Effort effortOf(AiDtos.Effort effort) {
        return switch (effort) {
            case low -> OutputConfig.Effort.LOW;
            case medium -> OutputConfig.Effort.MEDIUM;
            case high -> OutputConfig.Effort.HIGH;
            case xhigh -> OutputConfig.Effort.XHIGH;
            case max -> OutputConfig.Effort.MAX;
        };
    }

    private String model(AiDtos.Model requested, String fallback) {
        return props.modelFor(requested == null ? fallback : requested.name());
    }

    private static long elapsedMs(long startedAtNanos) {
        return (System.nanoTime() - startedAtNanos) / 1_000_000L;
    }

    private static <T> List<T> nullSafe(List<T> value) {
        return value == null ? List.of() : value;
    }

    private static String text(JsonNode node, String field, String fallback) {
        if (node == null || !node.isObject()) {
            return fallback;
        }
        JsonNode value = node.get(field);
        return value != null && value.isTextual() ? value.asText() : fallback;
    }

    private Map<String, Object> asMap(JsonNode node) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (Map.Entry<String, JsonNode> entry : node.properties()) {
            out.put(entry.getKey(), mapper.convertValue(entry.getValue(), Object.class));
        }
        return out;
    }

    private String json(Object value) {
        try {
            return mapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            return "{}";
        }
    }

    static String excerpt(String text) {
        if (text == null) {
            return "";
        }
        String trimmed = text.strip();
        return trimmed.length() <= 300 ? trimmed : trimmed.substring(0, 300) + "…";
    }
}
