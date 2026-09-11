package com.weadk.request;

import com.weadk.common.Platform;
import com.weadk.common.ScreenType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

public final class RequestDtos {

    private RequestDtos() {}

    @Schema(
            name = "Placement",
            description = "Where a screen was agreed to sit, as the path it was agreed at. Kept as a "
                    + "path rather than a reference because the parent may not be in this product yet.")
    public record Placement(
            List<String> parentPath, String parentName, ScreenType screenType, Platform platform) {}

    @Schema(name = "RequestView", description = "A screen waiting in a product for a round.")
    public record View(
            String id,
            String projectId,
            String name,
            String route,
            String fromLabel,
            Placement placement,
            @Schema(description = "The round it was filed into; null while it is still waiting.")
                    Integer version,
            boolean waiting,
            Instant createdAt,
            Instant movedAt) {

        public static View of(ScreenRequest request) {
            return new View(
                    request.getId(),
                    request.getProject().getId(),
                    request.getName(),
                    request.getRoute(),
                    request.getFromLabel(),
                    new Placement(
                            request.getParentPath(),
                            request.getParentName(),
                            request.getScreenType(),
                            request.getPlatform()),
                    request.getVersion(),
                    request.isWaiting(),
                    request.getCreatedAt(),
                    request.getMovedAt());
        }
    }

    @Schema(name = "RequestCreate")
    public record Create(
            @Schema(description = "The copy's own id. Generated when absent.") String id,
            @NotBlank String name,
            String route,
            String fromLabel,
            Placement placement) {}

    @Schema(
            name = "RequestMove",
            description = "Moving a set of screens into a product. A screen whose name already waits "
                    + "from the same source replaces that row rather than joining it.")
    public record Move(@Valid @NotNull List<Create> screens) {}

    @Schema(name = "RequestFile", description = "Filing a waiting request into a round.")
    public record File(@NotNull Integer version) {}
}
