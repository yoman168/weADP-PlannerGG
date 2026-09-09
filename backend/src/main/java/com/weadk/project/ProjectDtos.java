package com.weadk.project;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;

/** Wire shapes for projects. Records, so the OpenAPI schema is the Java type. */
public final class ProjectDtos {

    private ProjectDtos() {}

    @Schema(name = "ProjectView", description = "A project of either kind; archived means Customer.")
    public record View(
            String id,
            String name,
            String customer,
            String owner,
            String summary,
            String stage,
            String statusLabel,
            String statusTone,
            String accent,
            BigDecimal spend,
            boolean archived,
            String solution,
            Instant updatedAt,
            Instant createdAt) {

        public static View of(Project project) {
            return new View(
                    project.getId(),
                    project.getName(),
                    project.getCustomer(),
                    project.getOwner(),
                    project.getSummary(),
                    project.getStage(),
                    project.getStatusLabel(),
                    project.getStatusTone(),
                    project.getAccent(),
                    project.getSpend(),
                    project.isArchived(),
                    project.getSolution(),
                    project.getUpdatedAt(),
                    project.getCreatedAt());
        }
    }

    @Schema(name = "ProjectCreate")
    public record Create(
            @Schema(description = "Supplied when the client already named it; generated otherwise.")
                    String id,
            @NotBlank @Size(max = 200) String name,
            String customer,
            String owner,
            String summary,
            Boolean archived) {}

    @Schema(name = "ProjectUpdate", description = "Only the fields present are changed.")
    public record Update(
            @Size(max = 200) String name,
            String customer,
            String owner,
            String summary,
            String stage,
            String statusLabel,
            String statusTone,
            String accent,
            BigDecimal spend,
            Boolean archived,
            String solution) {}
}
