package com.weadk.request;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Tag(name = "Requests", description = "Screens waiting in a product for a round.")
public class RequestController {

    private final RequestService service;

    public RequestController(RequestService service) {
        this.service = service;
    }

    @GetMapping("/projects/{projectId}/requests")
    public List<RequestDtos.View> list(
            @PathVariable String projectId,
            @RequestParam(defaultValue = "false") boolean waitingOnly) {
        return service.list(projectId, waitingOnly).stream().map(RequestDtos.View::of).toList();
    }

    @PostMapping("/projects/{projectId}/requests")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Move screens into this product's Request tab.")
    public List<RequestDtos.View> move(
            @PathVariable String projectId, @Valid @RequestBody RequestDtos.Move input) {
        return service.move(projectId, input).stream().map(RequestDtos.View::of).toList();
    }

    @PostMapping("/requests/{id}/file")
    @Operation(summary = "File a waiting request into a round.")
    public RequestDtos.View file(@PathVariable String id, @Valid @RequestBody RequestDtos.File input) {
        return RequestDtos.View.of(service.file(id, input.version()));
    }

    @DeleteMapping("/requests/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
