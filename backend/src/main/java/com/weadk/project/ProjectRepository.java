package com.weadk.project;

import com.weadk.common.RecordStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Every read here is a live read.
 *
 * <p>The status is spelled out in the derived query names rather than hidden behind a
 * mapping-level restriction, because Spring Data's {@code findById} goes through
 * {@code EntityManager.find} and a restriction on the entity would not apply to it —
 * a deleted project would still be findable by id. The {@code Live} methods below are
 * what callers use, so the filter cannot be forgotten at a call site.
 */
public interface ProjectRepository extends JpaRepository<Project, String> {

    List<Project> findAllByStatusOrderByUpdatedAtDesc(int status);

    List<Project> findAllByArchivedAndStatusOrderByUpdatedAtDesc(boolean archived, int status);

    Optional<Project> findByIdAndStatus(String id, int status);

    boolean existsByIdAndStatus(String id, int status);

    default List<Project> findAllLive() {
        return findAllByStatusOrderByUpdatedAtDesc(RecordStatus.ACTIVE);
    }

    default List<Project> findAllLive(boolean archived) {
        return findAllByArchivedAndStatusOrderByUpdatedAtDesc(archived, RecordStatus.ACTIVE);
    }

    default Optional<Project> findLiveById(String id) {
        return findByIdAndStatus(id, RecordStatus.ACTIVE);
    }

    default boolean existsLiveById(String id) {
        return existsByIdAndStatus(id, RecordStatus.ACTIVE);
    }
}
