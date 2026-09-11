package com.weadk.ai;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

/** What the AI has cost over a window. Projected straight out of a JPQL aggregate. */
@Schema(name = "AiUsageTotals")
public record AiUsageTotals(long inputTokens, long outputTokens, BigDecimal costUsd, long calls) {}
