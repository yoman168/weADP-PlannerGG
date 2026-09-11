package com.weadk.project;

import com.weadk.common.Ids;
import com.weadk.common.NotFoundException;
import com.weadk.common.RecordStatus;
import com.weadk.meeting.MeetingRepository;
import com.weadk.meeting.ScreenRepository;
import com.weadk.request.ScreenRequestRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectService {

    private final ProjectRepository projects;
    private final MeetingRepository meetings;
    private final ScreenRepository screens;
    private final ScreenRequestRepository requests;

    public ProjectService(
            ProjectRepository projects,
            MeetingRepository meetings,
            ScreenRepository screens,
            ScreenRequestRepository requests) {
        this.projects = projects;
        this.meetings = meetings;
        this.screens = screens;
        this.requests = requests;
    }

    @Transactional(readOnly = true)
    public List<Project> list(Boolean archived) {
        return archived == null ? projects.findAllLive() : projects.findAllLive(archived);
    }

    @Transactional(readOnly = true)
    public Project get(String id) {
        return projects.findLiveById(id).orElseThrow(() -> new NotFoundException("Project", id));
    }

    @Transactional
    public Project create(ProjectDtos.Create input) {
        Project project = new Project(Ids.orGenerate(input.id(), "proj"), input.name().trim());
        project.setCustomer(input.customer());
        project.setOwner(input.owner());
        project.setSummary(input.summary());
        project.setArchived(Boolean.TRUE.equals(input.archived()));
        return projects.save(project);
    }

    @Transactional
    public Project update(String id, ProjectDtos.Update input) {
        Project project = get(id);
        if (input.name() != null) project.setName(input.name().trim());
        if (input.customer() != null) project.setCustomer(input.customer());
        if (input.owner() != null) project.setOwner(input.owner());
        if (input.summary() != null) project.setSummary(input.summary());
        if (input.stage() != null) project.setStage(input.stage());
        if (input.statusLabel() != null) project.setStatusLabel(input.statusLabel());
        if (input.statusTone() != null) project.setStatusTone(input.statusTone());
        if (input.accent() != null) project.setAccent(input.accent());
        if (input.spend() != null) project.setSpend(input.spend());
        if (input.archived() != null) project.setArchived(input.archived());
        if (input.solution() != null) project.setSolution(input.solution());
        project.touch();
        return project;
    }

    /**
     * Deletes the project without removing it, and everything that hung off it with it.
     *
     * <p>The row stays and its status goes to 0. Its meetings, their screens and its
     * requests are marked the same way, because that is what the {@code on delete
     * cascade} foreign keys used to do and those cannot fire when nothing is deleted —
     * without this, a deleted project's meetings would still answer on their own routes.
     *
     * <p>The project's own row is flushed first: the statements below clear the
     * persistence context, and a mark that had not been written yet would go with it.
     *
     * <p>What is deliberately left alone is the other direction. A meeting in another
     * project that named this one as its {@code product} or its {@code movedTo} keeps
     * that reference, where the old {@code on delete set null} would have erased it.
     * The row it points at is still there, so the reference is still valid, and keeping
     * it is what makes the delete recoverable.
     */
    @Transactional
    public void delete(String id) {
        Project project = projects.findLiveById(id).orElseThrow(() -> new NotFoundException("Project", id));
        project.markDeleted();
        projects.flush();

        meetings.markAllInProject(id, RecordStatus.DELETED, Instant.now());
        screens.markAllInProject(id, RecordStatus.DELETED);
        requests.markAllInProject(id, RecordStatus.DELETED);
    }
}
