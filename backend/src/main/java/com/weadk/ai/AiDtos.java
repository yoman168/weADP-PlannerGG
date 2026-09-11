package com.weadk.ai;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * The wire shapes of the AI endpoints.
 *
 * <p>Two things are deliberately not typed here, and it is the same reason both times.
 * A block's {@code props} and a canvas operation are described by the block catalogue,
 * which lives in the browser — it is generated from the same module the canvas inspector
 * is drawn from — so they cross this boundary as free-form JSON and are validated against
 * the catalogue on the client. Restating that catalogue in Java would be a second
 * definition of what a block is, drifting out of step with the first, which is the exact
 * failure the generated client types exist to prevent everywhere else.
 *
 * <p>So the division is: this API owns the model call, the prompts, the accounting and the
 * credential; the client owns what a block is.
 */
public final class AiDtos {

    private AiDtos() {}

    /** The alias the workspace's model picker sends. Resolved by {@code weadk.ai.models}. */
    @Schema(name = "AiModel", allowableValues = {"opus", "sonnet", "haiku"})
    public enum Model {
        opus,
        sonnet,
        haiku
    }

    @Schema(name = "AiEffort", description = "Thinking depth; ignored by models that do not take it.")
    public enum Effort {
        low,
        medium,
        high,
        xhigh,
        max
    }

    @Schema(name = "AiUsageView", description = "What this call spent.")
    public record UsageView(
            String model, long inputTokens, long outputTokens, BigDecimal costUsd, long durationMs) {}

    /* ------------------------------------------------------------------ */
    /* Canvas edits                                                        */
    /* ------------------------------------------------------------------ */

    @Schema(name = "CanvasBlockView", description = "One block of the canvas being edited.")
    public record CanvasBlock(
            @NotBlank String id,
            @NotBlank String kind,
            String name,
            boolean hidden,
            @Schema(description = "Catalogue-defined; passed through untouched.") Map<String, Object> props) {}

    @Schema(name = "CanvasEditRequest")
    public record CanvasRequest(
            @NotBlank @Size(max = 2_000) String instruction,
            @Valid @NotNull @Size(max = 200) List<CanvasBlock> blocks,
            @Schema(
                            description = "The block catalogue, rendered by the client. This is what tells "
                                    + "the model which kinds and props exist.")
                    @NotBlank
                    @Size(max = 60_000)
                    String catalog,
            Model model,
            @Schema(description = "Attributes the spend to a project.") String projectId,
            @Size(max = 300) String label) {}

    @Schema(
            name = "CanvasEditResponse",
            description = "The model's proposed operations, unvalidated against the catalogue — the "
                    + "client checks them before applying.")
    public record CanvasResponse(
            String reply, List<Map<String, Object>> operations, UsageView usage) {}

    /* ------------------------------------------------------------------ */
    /* Meeting notes to screens                                            */
    /* ------------------------------------------------------------------ */

    @Schema(name = "BaseScreenBlock", description = "One block of the live screen being revised.")
    public record BaseScreenBlock(@NotBlank String kind, String label) {}

    @Schema(
            name = "BaseScreen",
            description = "The screen that exists in production today, when this is a change request "
                    + "rather than a fresh design.")
    public record BaseScreen(
            @Size(max = 200) String path,
            @Size(max = 200) String route,
            @Valid @Size(max = 30) List<BaseScreenBlock> blocks) {}

    @Schema(name = "GenerateScreensRequest")
    public record GenerateRequest(
            @NotBlank @Size(min = 20, max = 12_000) String notes,
            @NotBlank @Size(max = 60_000) String catalog,
            @Size(max = 120) String customer,
            @Size(max = 160) String sessionTitle,
            @Min(1) @Max(8) Integer maxScreens,
            @Schema(description = "Merged text of the meeting's reference files.") @Size(max = 16_000)
                    String references,
            @Schema(description = "Names of attachments with no extractable text, so the model knows they exist.")
                    @Size(max = 40)
                    List<@Size(max = 200) String> referenceNames,
            @Valid BaseScreen baseScreen,
            Model model,
            String projectId) {

        public int screens() {
            return maxScreens == null ? 4 : maxScreens;
        }
    }

    @Schema(name = "GeneratedBlock")
    public record GeneratedBlock(
            @NotBlank String kind,
            @Schema(description = "Catalogue-defined; passed through untouched.") Map<String, Object> props) {}

    @Schema(name = "GeneratedScreen")
    public record GeneratedScreen(
            String name, String route, String rationale, List<GeneratedBlock> blocks) {}

    @Schema(name = "GenerateScreensResponse")
    public record GenerateResponse(
            String reply,
            List<GeneratedScreen> screens,
            @Schema(description = "Screens the model proposed that this API could not read at all.")
                    List<String> skipped,
            UsageView usage) {}

    /* ------------------------------------------------------------------ */
    /* Functional requirements                                             */
    /* ------------------------------------------------------------------ */

    @Schema(name = "FrdRequest")
    public record FrdRequest(
            @NotBlank @Size(max = 60) String prdId,
            @NotBlank @Size(max = 300) String prdTitle,
            @Size(max = 4_000) String prdDescription,
            @NotNull @Size(max = 60) List<@Size(max = 600) String> requirements,
            @Size(max = 60) List<@Size(max = 300) String> screens,
            Model model,
            String projectId) {}

    @Schema(name = "FrdItem")
    public record FrdItem(String title) {}

    @Schema(name = "FrdResponse")
    public record FrdResponse(List<FrdItem> items, String reply, UsageView usage) {}

    /* ------------------------------------------------------------------ */
    /* The folder chat                                                     */
    /* ------------------------------------------------------------------ */

    @Schema(name = "ChatTurn")
    public record Turn(@NotNull Role role, @NotNull @Size(max = 6_000) String text) {
        public enum Role {
            user,
            assistant
        }
    }

    @Schema(name = "ChatAttachment")
    public record Attachment(
            @NotBlank @Size(max = 200) String name,
            @NotNull Kind kind,
            @Schema(description = "Images only — base64 with no data: prefix.") @Size(max = 2_800_000)
                    String dataBase64,
            @Size(max = 80) String mediaType,
            @Schema(description = "Text files only — their content, read in the browser.") @Size(max = 8_000)
                    String text) {

        public enum Kind {
            image,
            text,
            binary
        }
    }

    /**
     * The chat request.
     *
     * <p>The caps are the ones the route this replaces arrived at, and two of them are
     * load-bearing rather than arbitrary. {@code message} allows 12,000 characters because
     * the canvas generator sends the block catalogue's own schema inline with its prompt
     * and a chat-sized cap rejected it outright. {@code context} allows 200,000 because the
     * screen being discussed is in there — its full html, since there is no filesystem for
     * this chat to read — and a smaller cap silently truncated the page, after which the
     * model answered "show me the file" to a request to change the screen in front of it.
     */
    @Schema(name = "ChatRequest")
    public record ChatRequest(
            @NotBlank @Size(max = 12_000) String message,
            @Valid @Size(max = 30) List<Turn> history,
            @Size(max = 200_000) String context,
            @Size(max = 200) String folderLabel,
            @Size(max = 160) String projectName,
            Model model,
            @Valid @Size(max = 4) List<Attachment> attachments,
            @Schema(description = "Ask for a reasoning summary; ignored by models without it.")
                    Boolean thinking,
            Effort effort,
            String projectId) {

        public List<Turn> turns() {
            return history == null ? List.of() : history;
        }

        public List<Attachment> files() {
            return attachments == null ? List.of() : attachments;
        }
    }

    @Schema(name = "AiStatus", description = "Whether this deployment can call Claude at all.")
    public record Status(boolean configured, String defaultModel, Map<String, String> models) {}

    @Schema(name = "AiVerifyResponse")
    public record VerifyResponse(boolean ok, String model) {}
}
