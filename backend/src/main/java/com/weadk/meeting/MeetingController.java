package com.weadk.meeting;

import com.weadk.common.NotFoundException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Tag(name = "Meetings", description = "Conversations, and the screens they produced.")
public class MeetingController {

    private final MeetingService service;
    private final ScreenRepository screens;

    public MeetingController(MeetingService service, ScreenRepository screens) {
        this.service = service;
        this.screens = screens;
    }

    @GetMapping("/projects/{projectId}/meetings")
    public List<MeetingDtos.View> list(@PathVariable String projectId) {
        return service.listFor(projectId).stream().map(MeetingDtos.View::of).toList();
    }

    @PostMapping("/projects/{projectId}/meetings")
    @ResponseStatus(HttpStatus.CREATED)
    public MeetingDtos.View create(
            @PathVariable String projectId, @Valid @RequestBody MeetingDtos.Create input) {
        return MeetingDtos.View.of(service.create(projectId, input));
    }

    @GetMapping("/meetings/{id}")
    public MeetingDtos.View get(@PathVariable String id) {
        return MeetingDtos.View.of(service.get(id));
    }

    @PatchMapping("/meetings/{id}")
    public MeetingDtos.View update(@PathVariable String id, @Valid @RequestBody MeetingDtos.Update input) {
        return MeetingDtos.View.of(service.update(id, input));
    }

    @DeleteMapping("/meetings/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/meetings/{id}/screens")
    @Operation(summary = "Replace the set after a generation; unmentioned screens are kept as they are.")
    public MeetingDtos.View replaceScreens(
            @PathVariable String id, @Valid @RequestBody MeetingDtos.ScreensReplace input) {
        return MeetingDtos.View.of(service.replaceScreens(id, input));
    }

    @DeleteMapping("/meetings/{id}/screens")
    @Operation(summary = "Reset: the screens go, the notes stay.")
    public MeetingDtos.View reset(@PathVariable String id) {
        return MeetingDtos.View.of(service.reset(id));
    }

    @PostMapping("/meetings/{id}/screens/moved")
    @Operation(summary = "Record that the whole set has been sent to a product.")
    public MeetingDtos.View markMoved(@PathVariable String id, @Valid @RequestBody MeetingDtos.Moved input) {
        return MeetingDtos.View.of(service.markMoved(id, input.projectId()));
    }

    @GetMapping("/screens/{id}/html")
    @Operation(summary = "The page itself, fetched per screen rather than with the meeting.")
    @Transactional(readOnly = true)
    public MeetingDtos.Html html(@PathVariable String id) {
        Screen screen = screens.findLiveById(id).orElseThrow(() -> new NotFoundException("Screen", id));
        return new MeetingDtos.Html(screen.getHtml());
    }

    @PutMapping("/screens/{id}/html")
    @Operation(summary = "Save the page. Writing it is what marks the screen modified.")
    @Transactional
    public MeetingDtos.ScreenView saveHtml(
            @PathVariable String id, @Valid @RequestBody MeetingDtos.Html input) {
        Screen screen = screens.findLiveById(id).orElseThrow(() -> new NotFoundException("Screen", id));
        screen.setHtml(input.html());
        return MeetingDtos.ScreenView.of(screen);
    }
}
