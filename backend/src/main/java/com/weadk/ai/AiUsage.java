package com.weadk.ai;

import com.anthropic.models.messages.Usage;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;

/**
 * One Claude call, and what it cost.
 *
 * <p>Written for every call, including the ones that failed — a refused request still
 * spends input tokens, and a run of errors is exactly the thing an operator needs to see.
 *
 * <p>{@code costUsd} is stored rather than derived on read. The rate card in configuration
 * will change; what a call cost on the day does not, and a report that silently reprices
 * last month is a report nobody can reconcile.
 */
@Entity
@Table(name = "ai_usage")
public class AiUsage {

    /** Machine-written rows, so unlike everything else here the id is generated. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String endpoint;

    @Column(nullable = false)
    private String model;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "project_id")
    private String projectId;

    /** What the caller was looking at, so a cost can be read back to a screen. */
    private String label;

    @Column(name = "input_tokens", nullable = false)
    private long inputTokens;

    @Column(name = "output_tokens", nullable = false)
    private long outputTokens;

    @Column(name = "cache_read_tokens", nullable = false)
    private long cacheReadTokens;

    @Column(name = "cache_write_tokens", nullable = false)
    private long cacheWriteTokens;

    @Column(name = "cost_usd", nullable = false)
    private BigDecimal costUsd = BigDecimal.ZERO;

    @Column(name = "duration_ms", nullable = false)
    private long durationMs;

    @Column(nullable = false)
    private String outcome = Outcome.OK.wire();

    private String detail;

    @Column(nullable = false)
    private Instant at = Instant.now();

    protected AiUsage() {}

    public AiUsage(String endpoint, String model) {
        this.endpoint = endpoint;
        this.model = model;
    }

    public enum Outcome {
        OK,
        REFUSAL,
        ERROR;

        public String wire() {
            return name().toLowerCase(java.util.Locale.ROOT);
        }
    }

    /** Copies the token counts across, tolerating the optional cache fields being absent. */
    public AiUsage withTokens(Usage usage) {
        if (usage != null) {
            this.inputTokens = usage.inputTokens();
            this.outputTokens = usage.outputTokens();
            this.cacheReadTokens = usage.cacheReadInputTokens().orElse(0L);
            this.cacheWriteTokens = usage.cacheCreationInputTokens().orElse(0L);
        }
        return this;
    }

    /**
     * The same, from counts gathered by hand.
     *
     * <p>A streamed turn never produces a {@code Usage} object: the input count arrives on
     * the opening event and the output count on the closing one, so the caller accumulates
     * them and passes them in.
     */
    public AiUsage withTokensRaw(long inputTokens, long outputTokens, long cacheRead, long cacheWrite) {
        this.inputTokens = inputTokens;
        this.outputTokens = outputTokens;
        this.cacheReadTokens = cacheRead;
        this.cacheWriteTokens = cacheWrite;
        return this;
    }

    /** Prices the row from a rate card given in USD per million tokens. */
    public AiUsage priced(AiProperties.Price price) {
        BigDecimal million = new BigDecimal(1_000_000);
        BigDecimal input = price.inputPerMillion()
                .multiply(BigDecimal.valueOf(inputTokens + cacheReadTokens + cacheWriteTokens))
                .divide(million, 6, RoundingMode.HALF_UP);
        BigDecimal output = price.outputPerMillion()
                .multiply(BigDecimal.valueOf(outputTokens))
                .divide(million, 6, RoundingMode.HALF_UP);
        this.costUsd = input.add(output);
        return this;
    }

    public AiUsage by(String userId) {
        this.userId = userId;
        return this;
    }

    public AiUsage on(String projectId, String label) {
        this.projectId = projectId;
        this.label = label == null || label.isBlank() ? null : label.substring(0, Math.min(label.length(), 300));
        return this;
    }

    public AiUsage took(long durationMs) {
        this.durationMs = durationMs;
        return this;
    }

    public AiUsage outcome(Outcome outcome, String detail) {
        this.outcome = outcome.wire();
        this.detail = detail == null || detail.isBlank()
                ? null
                : detail.substring(0, Math.min(detail.length(), 1_000));
        return this;
    }

    public Long getId() {
        return id;
    }

    public String getEndpoint() {
        return endpoint;
    }

    public String getModel() {
        return model;
    }

    public long getInputTokens() {
        return inputTokens;
    }

    public long getOutputTokens() {
        return outputTokens;
    }

    public BigDecimal getCostUsd() {
        return costUsd;
    }

    public long getDurationMs() {
        return durationMs;
    }

    public String getOutcome() {
        return outcome;
    }

    public String getUserId() {
        return userId;
    }

    public String getProjectId() {
        return projectId;
    }

    public Instant getAt() {
        return at;
    }
}
