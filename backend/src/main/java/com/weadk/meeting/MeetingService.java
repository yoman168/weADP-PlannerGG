package com.weadk.meeting;

import com.weadk.common.Ids;
import com.weadk.common.NotFoundException;
import com.weadk.project.Project;
import com.weadk.project.ProjectRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MeetingService {

    private final MeetingRepository meetings;
    private final ProjectRepository projects;

    public MeetingService(MeetingRepository meetings, ProjectRepository projects) {
        this.meetings = meetings;
        this.projects = projects;
    }

    /** Spacing and case are not part of a name when two names are compared. */
    private static String key(String name) {
        return name == null ? "" : name.replaceAll("\\s+", "").toLowerCase(Locale.ROOT);
    }

    @Transactional(readOnly = true)
    public List<Meeting> listFor(String projectId) {
        if (!projects.existsLiveById(projectId)) {
            throw new NotFoundException("Project", projectId);
        }
        return meetings.findAllLiveForProject(projectId);
    }

    @Transactional(readOnly = true)
    public Meeting get(String id) {
        return meetings.findLiveWithScreensById(id).orElseThrow(() -> new NotFoundException("Meeting", id));
    }

    @Transactional
    public Meeting create(String projectId, MeetingDtos.Create input) {
        Project project = projects.findLiveById(projectId)
                .orElseThrow(() -> new NotFoundException("Project", projectId));
        Meeting meeting = new Meeting(
                Ids.orGenerate(input.id(), "meeting"), project, input.title().trim(), input.date());
        meeting.setAttendees(input.attendees());
        meeting.setNotes(input.notes());
        meeting.setKind(input.kind());
        meeting.setSource(input.source());
        meeting.setPostedBy(input.postedBy());
        return meetings.save(meeting);
    }

    @Transactional
    public Meeting update(String id, MeetingDtos.Update input) {
        Meeting meeting = get(id);
        if (input.title() != null) meeting.setTitle(input.title().trim());
        if (input.date() != null) meeting.setDate(input.date());
        if (input.attendees() != null) meeting.setAttendees(input.attendees());
        if (input.notes() != null) meeting.setNotes(input.notes());
        if (input.kind() != null) meeting.setKind(input.kind());
        if (input.source() != null) meeting.setSource(input.source());
        if (input.postedBy() != null) meeting.setPostedBy(input.postedBy());
        if (input.productId() != null) {
            meeting.setProduct(
                    input.productId().isBlank()
                            ? null
                            : projects.findLiveById(input.productId())
                                    .orElseThrow(() -> new NotFoundException("Project", input.productId())));
        }
        meeting.touch();
        return meeting;
    }

    /**
     * Deletes the meeting without removing it, screens included.
     *
     * <p>Loaded rather than marked by statement, because the screens it still has are
     * loaded with it and marking them here is what the cascade on {@code meeting_id}
     * used to do.
     */
    @Transactional
    public void delete(String id) {
        get(id).markDeleted();
    }

    /**
     * Replaces the set after a generation, keeping what a regeneration should keep.
     *
     * <p>A returned screen takes over the record of the screen it shares a name
     * with — same id, so its stored page and every link pointing at it survive,
     * and its agreed placement is not overwritten by the reply. A screen the
     * reply does not mention is left exactly as it was, which is what makes a
     * second run a revision rather than a rebuild.
     */
    @Transactional
    public Meeting replaceScreens(String id, MeetingDtos.ScreensReplace input) {
        Meeting meeting = get(id);

        Map<String, Screen> byName = new HashMap<>();
        for (Screen existing : meeting.getScreens()) {
            byName.put(key(existing.getName()), existing);
        }

        Map<String, Screen> written = new LinkedHashMap<>();
        Set<String> returned = new HashSet<>();

        for (MeetingDtos.ScreenWrite write : input.screens()) {
            returned.add(key(write.name()));
            Screen existing = byName.get(key(write.name()));
            Screen screen = existing != null
                    ? existing
                    : new Screen(Ids.orGenerate(write.id(), "screen"), meeting, 0, write.name());
            screen.setName(write.name());
            if (write.html() != null) {
                screen.setHtml(write.html());
            }
            if (existing == null) {
                // A placement already agreed is not the reply's to change.
                screen.setScreenType(write.screenType());
                screen.setPlatform(write.platform());
            }
            written.put(screen.getId(), screen);
        }

        // Parents in a second pass: a reply may name a parent it lists later.
        Map<String, Screen> byId = new HashMap<>(written);
        for (Screen existing : meeting.getScreens()) {
            byId.putIfAbsent(existing.getId(), existing);
        }
        Map<String, Screen> byNameAll = new HashMap<>();
        byId.values().forEach(screen -> byNameAll.putIfAbsent(key(screen.getName()), screen));

        for (MeetingDtos.ScreenWrite write : input.screens()) {
            Screen screen = byName.containsKey(key(write.name()))
                    ? byName.get(key(write.name()))
                    : byNameAll.get(key(write.name()));
            if (screen == null || write.parentId() == null || write.parentId().isBlank()) {
                continue;
            }
            Screen parent = byId.get(write.parentId());
            if (parent == null) {
                parent = byNameAll.get(key(write.parentId()));
            }
            if (parent != null && !parent.getId().equals(screen.getId()) && !wouldCycle(screen, parent)) {
                screen.setParent(parent);
            }
        }

        // Kept first, in the order the meeting already had, then whatever is new.
        List<Screen> ordered = new ArrayList<>();
        for (Screen existing : meeting.getScreens()) {
            ordered.add(existing);
        }
        for (Screen screen : written.values()) {
            if (!ordered.contains(screen)) {
                ordered.add(screen);
            }
        }
        meeting.replaceScreens(ordered);
        return meeting;
    }

    /** A parent must not be one of its own descendants. */
    private static boolean wouldCycle(Screen screen, Screen candidateParent) {
        Set<String> seen = new HashSet<>();
        Screen walker = candidateParent;
        while (walker != null && seen.add(walker.getId())) {
            if (walker.getId().equals(screen.getId())) {
                return true;
            }
            walker = walker.getParent();
        }
        return false;
    }

    @Transactional
    public Meeting markMoved(String id, String projectId) {
        Meeting meeting = get(id);
        Project destination = projects.findLiveById(projectId)
                .orElseThrow(() -> new NotFoundException("Project", projectId));
        meeting.markScreensMoved(destination, Instant.now());
        return meeting;
    }

    @Transactional
    public Meeting reset(String id) {
        Meeting meeting = get(id);
        meeting.clearScreens();
        return meeting;
    }
}
