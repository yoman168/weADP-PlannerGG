package com.weadk.ai;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/**
 * The Claude bridge.
 *
 * <p>These five routes replace the Next.js handlers that shelled out to the local
 * {@code claude} CLI. The request and response shapes are the ones the workspace already
 * sends and reads, so the browser did not have to change; what moved is where the call
 * happens, which credential it uses, and the fact that every call is now written down.
 *
 * <p>The {@code X-Anthropic-Api-Key} header is how a caller spends their own quota instead
 * of the organisation's. Absent, the server's key is used.
 */
@RestController
@RequestMapping("/api/ai")
@Tag(name = "AI", description = "Screen generation, canvas edits and the folder chat.")
public class AiController {

    /** Named as the request header so the two cannot drift apart. */
    public static final String API_KEY_HEADER = "X-Anthropic-Api-Key";

    private final AiService service;
    private final ChatService chat;

    public AiController(AiService service, ChatService chat) {
        this.service = service;
        this.chat = chat;
    }

    @GetMapping("/status")
    @Operation(summary = "Whether this deployment can call Claude, and which models its aliases mean.")
    public AiDtos.Status status() {
        return service.status();
    }

    @PostMapping("/verify")
    @Operation(
            summary = "Prove a credential works.",
            description = "Runs one tiny Haiku turn. Send X-Anthropic-Api-Key to check your own key "
                    + "rather than the server's.")
    public AiDtos.VerifyResponse verify(
            @AuthenticationPrincipal Jwt jwt, @RequestHeader(name = API_KEY_HEADER, required = false) String key) {
        return service.verify(caller(jwt, key));
    }

    @PostMapping("/canvas")
    @Operation(
            summary = "Turn an instruction into canvas operations.",
            description = "The operations come back as the model wrote them. They are validated "
                    + "against the block catalogue on the client, which owns it.")
    public AiDtos.CanvasResponse canvas(
            @Valid @RequestBody AiDtos.CanvasRequest request,
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = API_KEY_HEADER, required = false) String key) {
        return service.canvas(request, caller(jwt, key));
    }

    @PostMapping("/generate")
    @Operation(summary = "Propose the concept screens a set of meeting notes implies.")
    public AiDtos.GenerateResponse generate(
            @Valid @RequestBody AiDtos.GenerateRequest request,
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = API_KEY_HEADER, required = false) String key) {
        return service.generate(request, caller(jwt, key));
    }

    @PostMapping("/frd")
    @Operation(summary = "Derive functional requirements from a product requirement document.")
    public AiDtos.FrdResponse frd(
            @Valid @RequestBody AiDtos.FrdRequest request,
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = API_KEY_HEADER, required = false) String key) {
        return service.frd(request, caller(jwt, key));
    }

    /**
     * One turn of the folder chat, streamed.
     *
     * <p>Newline-delimited JSON in the envelope shape the workspace's stream decoder already
     * reads. Once the first line is out the status is committed, so a failure part-way
     * through arrives as a {@code bridge_error} line rather than an error status.
     */
    @PostMapping(value = "/chat", produces = "application/x-ndjson")
    @Operation(
            summary = "One turn of the folder chat, streamed as newline-delimited JSON.",
            parameters = @Parameter(name = API_KEY_HEADER, in = ParameterIn.HEADER,
                    description = "Spend your own quota instead of the server's."))
    @ApiResponse(
            responseCode = "200",
            description = "A stream of envelopes: `stream_event` per token, then a closing `result`.",
            content = @Content(mediaType = "application/x-ndjson", schema = @Schema(type = "string")))
    public ResponseEntity<StreamingResponseBody> chat(
            @Valid @RequestBody AiDtos.ChatRequest request,
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = API_KEY_HEADER, required = false) String key) {
        Caller caller = caller(jwt, key);
        StreamingResponseBody body = out -> chat.stream(request, caller, out);
        return ResponseEntity.ok()
                .contentType(MediaType.valueOf("application/x-ndjson;charset=UTF-8"))
                .header(HttpHeaders.CACHE_CONTROL, "no-cache, no-transform")
                // Tells an nginx in front of this not to buffer the stream into one lump.
                .header("X-Accel-Buffering", "no")
                .body(body);
    }

    /**
     * Reported here rather than in the shared advice.
     *
     * <p>An absent credential, a refusal and an unreadable reply are not any of the failures
     * the shared handler knows about, and they must not be flattened into one. The body is
     * the same problem-detail shape the rest of the API answers with, so a client still has
     * one error format to read.
     */
    @ExceptionHandler(AiException.class)
    ProblemDetail onAiFailure(AiException ex) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(ex.status(), ex.getMessage());
        body.setTitle("AI request failed");
        body.setType(URI.create("https://we-adk.dev/problems/" + ex.slug()));
        return body;
    }

    private static Caller caller(Jwt jwt, String apiKey) {
        return Caller.of(jwt == null ? null : jwt.getSubject(), apiKey);
    }
}
