package com.weadk.ai;

import com.anthropic.client.AnthropicClient;
import com.anthropic.core.http.StreamResponse;
import com.anthropic.models.messages.Base64ImageSource;
import com.anthropic.models.messages.CacheControlEphemeral;
import com.anthropic.models.messages.ContentBlockParam;
import com.anthropic.models.messages.ImageBlockParam;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.RawMessageStreamEvent;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.TextBlockParam;
import com.anthropic.models.messages.ThinkingConfigAdaptive;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * The folder chat, streamed.
 *
 * <p>The wire format is not this API's invention. Six places in the workspace already read
 * this stream through one decoder, and that decoder was written against the newline-delimited
 * envelopes the Claude Code CLI emits — a {@code stream_event} per token, an {@code assistant}
 * message, a closing {@code result} carrying the turn's usage, a {@code bridge_error} when the
 * bridge itself fails. Keeping that shape is what lets the browser side of this migration be
 * a no-op; inventing a nicer one would mean changing six call sites to gain nothing.
 *
 * <p>So: same envelopes, different engine. What is behind them is now the Anthropic SDK
 * rather than a spawned CLI process, which is also why attached images are sent as image
 * blocks in the message instead of being written to a temporary directory for a subprocess
 * to go and read.
 */
@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    private final AnthropicClients clients;
    private final AiProperties props;
    private final UsageRecorder usage;
    private final ObjectMapper mapper;

    public ChatService(
            AnthropicClients clients, AiProperties props, UsageRecorder usage, ObjectMapper mapper) {
        this.clients = clients;
        this.props = props;
        this.usage = usage;
        this.mapper = mapper;
    }

    /**
     * Runs one turn, writing envelopes as they arrive.
     *
     * <p>Errors are written into the stream rather than thrown: by the time the first token
     * is out the response is committed and a status code is no longer available, and the
     * decoder on the other end already knows how to show a {@code bridge_error}.
     */
    public void stream(AiDtos.ChatRequest request, Caller caller, OutputStream out) {
        String model = props.modelFor(request.model() == null ? "haiku" : request.model().name());
        AiUsage row = new AiUsage("chat", model)
                .by(caller.userId())
                .on(request.projectId(), request.folderLabel());
        long startedAt = System.nanoTime();
        Writer writer = new Writer(out, mapper);

        AnthropicClient client;
        MessageCreateParams params;
        try {
            client = clients.forRequest(caller.apiKey(), props.timeout().chat());
            params = build(request, model);
        } catch (RuntimeException ex) {
            AiException mapped = AiService.mapFailure(ex);
            usage.record(row.took(elapsedMs(startedAt)).outcome(AiUsage.Outcome.ERROR, mapped.getMessage()));
            writer.error(mapped.getMessage());
            return;
        }

        long inputTokens = 0;
        long outputTokens = 0;
        long cacheRead = 0;
        long cacheWrite = 0;
        StopReason stopReason = null;
        String refusal = null;
        boolean wroteAnything = false;

        try (StreamResponse<RawMessageStreamEvent> stream = client.messages().createStreaming(params)) {
            for (RawMessageStreamEvent event : (Iterable<RawMessageStreamEvent>) stream.stream()::iterator) {
                if (event.isMessageStart()) {
                    var started = event.asMessageStart().message().usage();
                    inputTokens = started.inputTokens();
                    cacheRead = started.cacheReadInputTokens().orElse(0L);
                    cacheWrite = started.cacheCreationInputTokens().orElse(0L);
                } else if (event.isContentBlockDelta()) {
                    // Text only. Thinking deltas are deliberately dropped: the panel greps the
                    // reply for a ```html block and saves what it finds, so reasoning mixed into
                    // that text would be saved as part of a screen.
                    var delta = event.asContentBlockDelta().delta();
                    if (delta.isText()) {
                        writer.delta(delta.asText().text());
                        wroteAnything = true;
                    }
                } else if (event.isMessageDelta()) {
                    var messageDelta = event.asMessageDelta();
                    outputTokens = messageDelta.usage().outputTokens();
                    stopReason = messageDelta.delta().stopReason().orElse(null);
                    refusal = messageDelta
                            .delta()
                            .stopDetails()
                            .flatMap(details -> details.explanation())
                            .orElse(refusal);
                }
            }
        } catch (RuntimeException ex) {
            AiException mapped = AiService.mapFailure(ex);
            usage.record(row.withTokensRaw(inputTokens, outputTokens, cacheRead, cacheWrite)
                    .took(elapsedMs(startedAt))
                    .outcome(AiUsage.Outcome.ERROR, mapped.getMessage()));
            writer.error(mapped.getMessage());
            return;
        }

        long durationMs = elapsedMs(startedAt);
        row.withTokensRaw(inputTokens, outputTokens, cacheRead, cacheWrite).took(durationMs);

        if (StopReason.REFUSAL.equals(stopReason)) {
            String detail = refusal == null || refusal.isBlank() ? "Claude declined that request." : refusal;
            usage.record(row.outcome(AiUsage.Outcome.REFUSAL, detail));
            writer.refused(detail);
            return;
        }
        usage.record(row.outcome(AiUsage.Outcome.OK, null));
        if (!wroteAnything) {
            // A turn that produced no text at all: the panel would otherwise show "(no reply)"
            // with no indication of why.
            writer.error("Claude ended the turn without writing anything.");
            return;
        }
        writer.done(inputTokens + cacheRead + cacheWrite, outputTokens, row.getCostUsd(), durationMs);
    }

    /* ------------------------------------------------------------------ */
    /* Request                                                             */
    /* ------------------------------------------------------------------ */

    private MessageCreateParams build(AiDtos.ChatRequest request, String model) {
        MessageCreateParams.Builder params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(props.tokens().chatMax())
                // The system prompt carries the whole folder — notes, files, sometimes a
                // screen's full html — and does not change between turns in that folder, so
                // it is worth caching. Below the model's minimum it simply is not cached.
                .systemOfTextBlockParams(List.of(TextBlockParam.builder()
                        .text(ChatPrompt.of(request.folderLabel(), name(request), request.context()))
                        .cacheControl(CacheControlEphemeral.builder().build())
                        .build()));

        if (Boolean.TRUE.equals(request.thinking()) && ModelCapabilities.adaptiveThinking(model)) {
            params.thinking(ThinkingConfigAdaptive.builder()
                    .display(ThinkingConfigAdaptive.Display.SUMMARIZED)
                    .build());
        }
        if (request.effort() != null && ModelCapabilities.effort(model)) {
            params.outputConfig(
                    OutputConfig.builder().effort(AiService.effortOf(request.effort())).build());
        }

        for (AiDtos.Turn turn : request.turns()) {
            if (turn.role() == AiDtos.Turn.Role.user) {
                params.addUserMessage(turn.text());
            } else {
                params.addAssistantMessage(turn.text());
            }
        }
        params.addUserMessageOfBlockParams(userTurn(request));
        return params.build();
    }

    /** The message itself: any images, then the text, with text attachments appended to it. */
    private List<ContentBlockParam> userTurn(AiDtos.ChatRequest request) {
        List<ContentBlockParam> blocks = new ArrayList<>();
        StringBuilder text = new StringBuilder(request.message());
        List<String> notes = new ArrayList<>();

        for (AiDtos.Attachment file : request.files()) {
            switch (file.kind()) {
                case image -> {
                    if (file.dataBase64() != null && !file.dataBase64().isBlank()) {
                        blocks.add(ContentBlockParam.ofImage(ImageBlockParam.builder()
                                .source(Base64ImageSource.builder()
                                        .data(file.dataBase64())
                                        .mediaType(mediaType(file))
                                        .build())
                                .build()));
                        notes.add("--- attached image: " + file.name() + " (above) ---");
                    }
                }
                case text -> {
                    if (file.text() != null && !file.text().isBlank()) {
                        notes.add("--- attached file: " + file.name() + " ---\n" + file.text());
                    }
                }
                case binary -> notes.add("--- attached file (no extractable text): " + file.name() + " ---");
            }
        }
        if (!notes.isEmpty()) {
            text.append("\n\n[ATTACHMENTS]\n").append(String.join("\n\n", notes));
        }
        blocks.add(ContentBlockParam.ofText(text.toString()));
        return blocks;
    }

    private static Base64ImageSource.MediaType mediaType(AiDtos.Attachment file) {
        String declared = file.mediaType() == null ? "" : file.mediaType().toLowerCase(Locale.ROOT);
        String name = file.name() == null ? "" : file.name().toLowerCase(Locale.ROOT);
        if (declared.contains("jpeg") || declared.contains("jpg") || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
            return Base64ImageSource.MediaType.IMAGE_JPEG;
        }
        if (declared.contains("gif") || name.endsWith(".gif")) {
            return Base64ImageSource.MediaType.IMAGE_GIF;
        }
        if (declared.contains("webp") || name.endsWith(".webp")) {
            return Base64ImageSource.MediaType.IMAGE_WEBP;
        }
        return Base64ImageSource.MediaType.IMAGE_PNG;
    }

    private static String name(AiDtos.ChatRequest request) {
        return request.projectName() == null || request.projectName().isBlank()
                ? "WE-ADK"
                : request.projectName();
    }

    private static long elapsedMs(long startedAtNanos) {
        return (System.nanoTime() - startedAtNanos) / 1_000_000L;
    }

    /* ------------------------------------------------------------------ */
    /* The envelopes                                                       */
    /* ------------------------------------------------------------------ */

    /**
     * Writes one JSON envelope per line, flushing each.
     *
     * <p>Without the flush the servlet container buffers and the panel sits blank until the
     * turn finishes, which defeats the point of streaming. A write that fails means the
     * browser hung up — the user pressed escape or closed the tab — so it stops writing and
     * lets the caller unwind, which closes the upstream stream and cancels the turn.
     */
    private static final class Writer {

        private final OutputStream out;
        private final ObjectMapper mapper;
        private boolean broken;

        Writer(OutputStream out, ObjectMapper mapper) {
            this.out = out;
            this.mapper = mapper;
        }

        void delta(String text) {
            write(ChatEnvelopes.delta(text));
        }

        void done(long inputTokens, long outputTokens, java.math.BigDecimal costUsd, long durationMs) {
            write(ChatEnvelopes.success(inputTokens, outputTokens, costUsd, durationMs));
        }

        /** A refusal is a finished turn with nothing usable in it, not a bridge failure. */
        void refused(String detail) {
            write(ChatEnvelopes.unsuccessful("error_refusal", detail));
        }

        void error(String message) {
            write(ChatEnvelopes.bridgeError(message));
        }

        private void write(Map<String, ?> event) {
            if (broken) {
                return;
            }
            try {
                out.write(mapper.writeValueAsString(event).getBytes(StandardCharsets.UTF_8));
                out.write('\n');
                out.flush();
            } catch (JsonProcessingException ex) {
                log.warn("Could not serialise a chat event", ex);
            } catch (IOException ex) {
                broken = true;
                log.debug("Chat stream closed by the client: {}", ex.getMessage());
            }
        }
    }
}
