package com.weadk.request;

import com.weadk.common.Ids;
import com.weadk.common.NotFoundException;
import com.weadk.project.Project;
import com.weadk.project.ProjectRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RequestService {

    private final ScreenRequestRepository requests;
    private final ProjectRepository projects;

    public RequestService(ScreenRequestRepository requests, ProjectRepository projects) {
        this.requests = requests;
        this.projects = projects;
    }

    @Transactional(readOnly = true)
    public List<ScreenRequest> list(String projectId, boolean waitingOnly) {
        if (!projects.existsLiveById(projectId)) {
            throw new NotFoundException("Project", projectId);
        }
        return waitingOnly
                ? requests.findLiveWaitingForProject(projectId)
                : requests.findAllLiveForProject(projectId);
    }

    /**
     * Files a set of screens into a product's Request tab.
     *
     * <p>One row per screen, not one per move: a screen regenerated and moved
     * again is the same screen, so the waiting row is replaced rather than
     * joined by a twin nobody can tell apart. Rows already filed into a round
     * are left alone — those are history, not a pending copy.
     *
     * <p>The row being replaced is marked rather than removed, like every other
     * delete here: the move that filed it is part of the record even once a newer
     * version of the screen has taken its place.
     */
    @Transactional
    public List<ScreenRequest> move(String projectId, RequestDtos.Move input) {
        Project project = projects.findLiveById(projectId)
                .orElseThrow(() -> new NotFoundException("Project", projectId));

        return input.screens().stream()
                .map(incoming -> {
                    String fromLabel = incoming.fromLabel() == null ? "" : incoming.fromLabel();
                    requests
                            .findLiveWaitingFor(projectId, fromLabel, incoming.name())
                            .ifPresent(ScreenRequest::markDeleted);

                    ScreenRequest request = new ScreenRequest(
                            Ids.orGenerate(incoming.id(), "req"), project, incoming.name());
                    request.setRoute(incoming.route());
                    request.setFromLabel(fromLabel);
                    if (incoming.placement() != null) {
                        request.setParentPath(incoming.placement().parentPath());
                        request.setParentName(incoming.placement().parentName());
                        request.setScreenType(incoming.placement().screenType());
                        request.setPlatform(incoming.placement().platform());
                    }
                    return requests.save(request);
                })
                .toList();
    }

    @Transactional
    public ScreenRequest file(String id, int version) {
        ScreenRequest request =
                requests.findLiveById(id).orElseThrow(() -> new NotFoundException("Request", id));
        request.fileInto(version);
        return request;
    }

    /** Deletes the request without removing it. */
    @Transactional
    public void delete(String id) {
        requests.findLiveById(id)
                .orElseThrow(() -> new NotFoundException("Request", id))
                .markDeleted();
    }
}
