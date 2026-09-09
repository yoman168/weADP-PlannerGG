package com.weadk.ai;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AiUsageRepository extends JpaRepository<AiUsage, Long> {

    List<AiUsage> findByProjectIdOrderByAtDesc(String projectId, Pageable pageable);

    /** Totals since a moment, for the DevAdmin dashboards. */
    @Query("""
            select new com.weadk.ai.AiUsageTotals(
                coalesce(sum(u.inputTokens), 0L),
                coalesce(sum(u.outputTokens), 0L),
                coalesce(sum(u.costUsd), 0),
                count(u))
            from AiUsage u
            where u.at >= :since
            """)
    AiUsageTotals totalsSince(Instant since);
}
