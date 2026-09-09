package com.weadk.request;

import com.weadk.common.RecordStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ScreenRequestRepository extends JpaRepository<ScreenRequest, String> {

    List<ScreenRequest> findAllByProjectIdAndStatusOrderByCreatedAtDesc(String projectId, int status);

    List<ScreenRequest> findAllByProjectIdAndVersionIsNullAndStatusOrderByCreatedAtDesc(
            String projectId, int status);

    Optional<ScreenRequest> findByIdAndStatus(String id, int status);

    /**
     * The waiting request for this screen from this source, if there is one.
     *
     * <p>Moving a regenerated screen again should replace the row that is
     * waiting rather than leave a twin nobody can tell apart. Deleted rows are
     * excluded, so a request that was deleted is not the one that gets replaced.
     */
    Optional<ScreenRequest> findFirstByProjectIdAndFromLabelAndNameIgnoreCaseAndVersionIsNullAndStatus(
            String projectId, String fromLabel, String name, int status);

    default List<ScreenRequest> findAllLiveForProject(String projectId) {
        return findAllByProjectIdAndStatusOrderByCreatedAtDesc(projectId, RecordStatus.ACTIVE);
    }

    default List<ScreenRequest> findLiveWaitingForProject(String projectId) {
        return findAllByProjectIdAndVersionIsNullAndStatusOrderByCreatedAtDesc(
                projectId, RecordStatus.ACTIVE);
    }

    default Optional<ScreenRequest> findLiveById(String id) {
        return findByIdAndStatus(id, RecordStatus.ACTIVE);
    }

    default Optional<ScreenRequest> findLiveWaitingFor(String projectId, String fromLabel, String name) {
        return findFirstByProjectIdAndFromLabelAndNameIgnoreCaseAndVersionIsNullAndStatus(
                projectId, fromLabel, name, RecordStatus.ACTIVE);
    }

    /** Marks every live request of a project, as deleting the project used to cascade. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update ScreenRequest r set r.status = :status
            where r.project.id = :projectId and r.status <> :status
            """)
    int markAllInProject(@Param("projectId") String projectId, @Param("status") int status);
}
