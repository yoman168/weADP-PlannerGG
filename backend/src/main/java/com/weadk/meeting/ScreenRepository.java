package com.weadk.meeting;

import com.weadk.common.RecordStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ScreenRepository extends JpaRepository<Screen, String> {

    List<Screen> findAllByMeetingIdAndStatusOrderByPositionAsc(String meetingId, int status);

    Optional<Screen> findByIdAndStatus(String id, int status);

    default List<Screen> findAllLiveForMeeting(String meetingId) {
        return findAllByMeetingIdAndStatusOrderByPositionAsc(meetingId, RecordStatus.ACTIVE);
    }

    default Optional<Screen> findLiveById(String id) {
        return findByIdAndStatus(id, RecordStatus.ACTIVE);
    }

    /**
     * Marks every live screen under a project, by way of its meetings.
     *
     * <p>The meetings are named in a subquery rather than joined: a bulk update cannot
     * join, and {@code s.meeting.id} is the foreign key column, so this needs neither.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update Screen s set s.status = :status
            where s.status <> :status
              and s.meeting.id in (select m.id from Meeting m where m.project.id = :projectId)
            """)
    int markAllInProject(@Param("projectId") String projectId, @Param("status") int status);
}
