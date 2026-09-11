package com.weadk.meeting;

import com.weadk.common.RecordStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MeetingRepository extends JpaRepository<Meeting, String> {

    @EntityGraph(attributePaths = "screens")
    List<Meeting> findAllByProjectIdAndStatusOrderByDateDesc(String projectId, int status);

    @EntityGraph(attributePaths = "screens")
    Optional<Meeting> findWithScreensByIdAndStatus(String id, int status);

    default List<Meeting> findAllLiveForProject(String projectId) {
        return findAllByProjectIdAndStatusOrderByDateDesc(projectId, RecordStatus.ACTIVE);
    }

    default Optional<Meeting> findLiveWithScreensById(String id) {
        return findWithScreensByIdAndStatus(id, RecordStatus.ACTIVE);
    }

    /**
     * Marks every live meeting of a project, which is what deleting the project used
     * to do through {@code on delete cascade}. A statement rather than a loop: a
     * project's meetings are not otherwise loaded, and there is no reason to.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update Meeting m set m.status = :status, m.updatedAt = :when
            where m.project.id = :projectId and m.status <> :status
            """)
    int markAllInProject(
            @Param("projectId") String projectId, @Param("status") int status, @Param("when") Instant when);
}
