package com.weadk.meeting;

import com.weadk.common.MeetingKind;
import com.weadk.common.Platform;
import com.weadk.common.ScreenType;
import com.weadk.common.TaskSource;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class MeetingDtos {

    private MeetingDtos() {}

    @Schema(name = "ProjectRef", description = "Just enough of a project to name it.")
    public record ProjectRef(String id, String name) {}

    @Schema(
            name = "ScreenView",
            description = "A screen without its page. The html is fetched per screen, because a "
                    + "meeting's pages together run to megabytes.")
    public record ScreenView(
            String id,
            int position,
            String name,
            String parentId,
            ScreenType screenType,
            Platform platform,
            Instant updatedAt,
            Instant movedAt,
            @Schema(
                            description = "`new` when the product has never had it, `modified` when "
                                    + "it changed since it was sent, null when they agree.",
                            allowableValues = {"new", "modified"})
                    String change) {

        public static ScreenView of(Screen screen) {
            return new ScreenView(
                    screen.getId(),
                    screen.getPosition(),
                    screen.getName(),
                    screen.getParent() == null ? null : screen.getParent().getId(),
                    screen.getScreenType(),
                    screen.getPlatform(),
                    screen.getUpdatedAt(),
                    screen.getMovedAt(),
                    screen.change());
        }
    }

    @Schema(name = "MeetingView")
    public record View(
            String id,
            String projectId,
            String title,
            LocalDate date,
            String attendees,
            String notes,
            MeetingKind kind,
            TaskSource source,
            String postedBy,
            @Schema(description = "The product these screens are built to fit. A plan.")
                    ProjectRef product,
            @Schema(description = "The product they have actually been sent to. A fact.")
                    ProjectRef movedTo,
            Instant createdAt,
            Instant updatedAt,
            List<ScreenView> screens) {

        public static View of(Meeting meeting) {
            return new View(
                    meeting.getId(),
                    meeting.getProject().getId(),
                    meeting.getTitle(),
                    meeting.getDate(),
                    meeting.getAttendees(),
                    meeting.getNotes(),
                    meeting.getKind(),
                    meeting.getSource(),
                    meeting.getPostedBy(),
                    meeting.getProductName() == null
                            ? null
                            : new ProjectRef(
                                    meeting.getProduct() == null ? null : meeting.getProduct().getId(),
                                    meeting.getProductName()),
                    meeting.getMovedToName() == null
                            ? null
                            : new ProjectRef(
                                    meeting.getMovedTo() == null ? null : meeting.getMovedTo().getId(),
                                    meeting.getMovedToName()),
                    meeting.getCreatedAt(),
                    meeting.getUpdatedAt(),
                    meeting.getScreens().stream().map(ScreenView::of).toList());
        }
    }

    @Schema(name = "MeetingCreate")
    public record Create(
            String id,
            @NotBlank @Size(max = 300) String title,
            @NotNull LocalDate date,
            String attendees,
            String notes,
            MeetingKind kind,
            TaskSource source,
            String postedBy) {}

    @Schema(name = "MeetingUpdate", description = "Only the fields present are changed.")
    public record Update(
            @Size(max = 300) String title,
            LocalDate date,
            String attendees,
            String notes,
            MeetingKind kind,
            TaskSource source,
            String postedBy,
            @Schema(description = "Id of the product to build into; empty string clears it.")
                    String productId) {}

    @Schema(
            name = "ScreenWrite",
            description = "One generated screen. `parentId` may name another screen in the same "
                    + "request; parents need not be listed first.")
    public record ScreenWrite(
            String id,
            @NotBlank String name,
            String html,
            String parentId,
            ScreenType screenType,
            Platform platform) {}

    @Schema(
            name = "ScreensReplace",
            description = "The whole set after a generation. Screens matched by name keep their "
                    + "id, their placement and their moved mark; the rest are new.")
    public record ScreensReplace(@Valid @NotNull List<ScreenWrite> screens) {}

    @Schema(name = "ScreenHtml")
    public record Html(@NotNull String html) {}

    @Schema(name = "ScreensMoved", description = "Records that the set has been sent to a product.")
    public record Moved(@NotBlank String projectId) {}
}
