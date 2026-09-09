package com.weadk.state;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reading and writing workspace state.
 *
 * <p>One read gives a viewer everything, because the code on the other side is synchronous:
 * around eighty keys are consulted from inside render paths and memos that cannot await
 * anything, so the browser hydrates the lot once and answers from memory afterwards.
 *
 * <p>Writes arrive batched for the same reason. Dragging a rail or editing a canvas touches
 * several keys in a few milliseconds, and one request per key would be a request storm.
 */
@Service
public class StateService {

    private static final Logger log = LoggerFactory.getLogger(StateService.class);

    private final WorkspaceStateRepository repository;

    public StateService(WorkspaceStateRepository repository) {
        this.repository = repository;
    }

    /**
     * Everything this viewer can see.
     *
     * <p>Their own rows win over the shared ones. That only matters for a key that was
     * shared before being classified as personal, and in that case the personal answer is
     * the one they meant.
     */
    @Transactional(readOnly = true)
    public StateDtos.Snapshot snapshot(String viewer) {
        Map<String, String> entries = new LinkedHashMap<>();
        List<String> personal = new ArrayList<>();

        for (WorkspaceState row : repository.findByOwnerIn(List.of(StateScope.SHARED, viewer))) {
            boolean mine = !StateScope.SHARED.equals(row.getOwner());
            if (mine || !entries.containsKey(row.getStateKey())) {
                entries.put(row.getStateKey(), row.getValue());
            }
            if (mine) {
                personal.add(row.getStateKey());
            }
        }
        return new StateDtos.Snapshot(entries, personal);
    }

    /**
     * Applies a batch.
     *
     * <p>A rejected key does not fail the batch. The browser sends what it has, and one key
     * it should not have sent must not lose the ninety-nine it should — the rejects come
     * back named so the caller can stop sending them.
     */
    @Transactional
    public StateDtos.Result apply(String viewer, StateDtos.Patch patch) {
        List<String> rejected = new ArrayList<>();
        Map<String, List<String>> deletionsByOwner = new HashMap<>();
        int written = 0;

        for (StateDtos.Write write : patch.entries()) {
            String key = write.key();
            if (StateScope.rejected(key)) {
                rejected.add(key);
                continue;
            }
            String owner = StateScope.ownerFor(key, viewer);

            if (write.value() == null) {
                deletionsByOwner.computeIfAbsent(owner, unused -> new ArrayList<>()).add(key);
                continue;
            }
            WorkspaceState row = repository
                    .findByOwnerAndStateKey(owner, key)
                    .orElseGet(() -> new WorkspaceState(owner, key, write.value()));
            row.update(write.value());
            repository.save(row);
            written++;
        }

        int deleted = 0;
        for (Map.Entry<String, List<String>> entry : deletionsByOwner.entrySet()) {
            deleted += repository.deleteByOwnerAndStateKeyIn(entry.getKey(), entry.getValue());
        }
        if (!rejected.isEmpty()) {
            log.warn("Refused to store {} credential-shaped key(s): {}", rejected.size(), rejected);
        }
        return new StateDtos.Result(written, deleted, rejected);
    }

    /**
     * Writes only the keys that do not exist yet.
     *
     * <p>This is what the one-time import from a browser uses. Nobody's existing work should
     * be overwritten by whichever browser happens to load first after the upgrade, so an
     * import fills gaps and never replaces.
     */
    @Transactional
    public StateDtos.Result importMissing(String viewer, StateDtos.Patch patch) {
        Set<String> present = snapshot(viewer).entries().keySet();
        List<StateDtos.Write> gaps = patch.entries().stream()
                .filter(write -> write.value() != null && !present.contains(write.key()))
                .toList();
        if (gaps.isEmpty()) {
            return new StateDtos.Result(0, 0, List.of());
        }
        log.info("Importing {} workspace key(s) that the database did not have yet.", gaps.size());
        return apply(viewer, new StateDtos.Patch(gaps));
    }

    /**
     * A version for everything this viewer can see.
     *
     * <p>Used as the ETag. It is worth a second query because the answer decides whether the
     * first one runs at all: an unchanged workspace becomes a 304 with no body, instead of
     * serialising and sending the whole snapshot again.
     */
    @Transactional(readOnly = true)
    public String version(String viewer) {
        return repository.versionFor(new String[] {StateScope.SHARED, viewer});
    }

    @Transactional(readOnly = true)
    public boolean isEmptyFor(String viewer) {
        return repository.countByOwners(List.of(StateScope.SHARED, viewer)) == 0;
    }
}
