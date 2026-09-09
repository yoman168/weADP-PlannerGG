package com.weadk.ai;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes the {@code ai_usage} row for a call.
 *
 * <p>In its own transaction, and never allowed to throw: a failure to record what a call
 * cost must not turn a call that worked into an error the user sees.
 */
@Service
public class UsageRecorder {

    private static final Logger log = LoggerFactory.getLogger(UsageRecorder.class);

    private final AiUsageRepository repository;
    private final AiProperties props;

    public UsageRecorder(AiUsageRepository repository, AiProperties props) {
        this.repository = repository;
        this.props = props;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void save(AiUsage usage) {
        repository.save(usage.priced(props.priceFor(usage.getModel())));
    }

    /** Records, and swallows anything that goes wrong doing so. */
    public void record(AiUsage usage) {
        try {
            save(usage);
        } catch (RuntimeException ex) {
            log.warn(
                    "Could not record AI usage for {} on {}: {}",
                    usage.getEndpoint(),
                    usage.getModel(),
                    ex.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public AiUsageTotals totalsForLastDays(int days) {
        return repository.totalsSince(Instant.now().minus(days, ChronoUnit.DAYS));
    }
}
