package com.weadk.state;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceStateRepository
        extends JpaRepository<WorkspaceState, WorkspaceState.Key> {

    /** Everything one viewer can see: the shared rows plus their own. */
    List<WorkspaceState> findByOwnerIn(Collection<String> owners);

    Optional<WorkspaceState> findByOwnerAndStateKey(String owner, String stateKey);

    @Modifying
    @Query("delete from WorkspaceState s where s.owner = :owner and s.stateKey in :keys")
    int deleteByOwnerAndStateKeyIn(@Param("owner") String owner, @Param("keys") Collection<String> keys);

    @Query("select count(s) from WorkspaceState s where s.owner in :owners")
    long countByOwners(@Param("owners") Collection<String> owners);

    /**
     * A cheap fingerprint of everything a viewer can see, for the ETag.
     *
     * <p>Two quantities, because either alone misses a change. {@code max(updated_at)} catches
     * an edited value but not a deletion; the md5 of the key set catches an added or removed
     * key but not an edit. Together they cannot miss one.
     *
     * <p>Deliberately not a hash of the values. The whole point of this query is to decide
     * whether to send 1.8 MB, so it must not read 1.8 MB to find out — the keys are short and
     * stay inline, while the values are large enough that Postgres stores them out of line.
     */
    @Query(
            value =
                    "select coalesce(md5(string_agg(state_key, ',' order by state_key)), 'empty')"
                            + " || '-' || coalesce(max(extract(epoch from updated_at))::text, '0')"
                            + " from workspace_state where owner = any (:owners)",
            nativeQuery = true)
    String versionFor(@Param("owners") String[] owners);
}
