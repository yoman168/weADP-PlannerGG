package com.weadk.project;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects")
@Tag(name = "Projects", description = "Products, and the Customer projects that feed them.")
public class ProjectController {

    private final ProjectService service;

    public ProjectController(ProjectService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "List projects; omit `archived` for all of them.")
    public List<ProjectDtos.View> list(@RequestParam(required = false) Boolean archived) {
        return service.list(archived).stream().map(ProjectDtos.View::of).toList();
    }

    @GetMapping("/{id}")
    public ProjectDtos.View get(@PathVariable String id) {
        return ProjectDtos.View.of(service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectDtos.View create(@Valid @RequestBody ProjectDtos.Create input) {
        return ProjectDtos.View.of(service.create(input));
    }

    @PatchMapping("/{id}")
    public ProjectDtos.View update(@PathVariable String id, @Valid @RequestBody ProjectDtos.Update input) {
        return ProjectDtos.View.of(service.update(id, input));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
