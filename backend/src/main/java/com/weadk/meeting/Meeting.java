package com.weadk.meeting;

import com.weadk.common.MeetingKind;
import com.weadk.common.RecordStatus;
import com.weadk.common.TaskSource;
import com.weadk.project.Project;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.SQLRestriction;

/**
 * A conversation, and the screens it produced.
 *
 * <p>Two projects hang off it and they mean different things. {@code product}
 * is where these screens are being built to fit, chosen before generating so
 * the model knows what already exists. {@code movedTo} is where they have
 * actually been sent. Choosing is a plan and moving is a fact, and collapsing
 * them into one column is what made the tree claim a product already held
 * screens nobody had sent it.
 */
@Entity
@Table(name = "meeting")
public class Meeting {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(nullable = false)
    private String title;

    @Column(name = "meeting_date", nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private String attendees = "";

    @Column(nullable = false, columnDefinition = "text")
    private String notes = "";

    @Column(nullable = false)
    private MeetingKind kind = MeetingKind.MEETING_NOTE;

    @Column(nullable = false)
    private TaskSource source = TaskSource.MEETING;

    /** Who put it here — the person, not the room. */
    @Column(name = "posted_by")
    private String postedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Project product;

    @Column(name = "product_name")
    private String productName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "moved_to_id")
    private Project movedTo;

    @Column(name = "moved_to_name")
    private String movedToName;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    /** Live or deleted. See {@link RecordStatus}. */
    @Column(nullable = false)
    private int status = RecordStatus.ACTIVE;

    /**
     * The screens this meeting still has.
     *
     * <p>Restricted to the live rows, which is what makes reset work: a deleted screen
     * has to be absent from this list — the meeting's own view of itself is built from
     * it — while its row stays in the table.
     *
     * <p>{@code orphanRemoval} is deliberately not set. It is what used to turn
     * {@code screens.clear()} into a DELETE, and a screen leaving this list now means
     * it was marked deleted, not that its row should go. Removal is cascaded nowhere
     * for the same reason.
     */
    @OneToMany(mappedBy = "meeting", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @OrderBy("position ASC")
    @SQLRestriction("status = " + RecordStatus.ACTIVE)
    private List<Screen> screens = new ArrayList<>();

    protected Meeting() {}

    public Meeting(String id, Project project, String title, LocalDate date) {
        this.id = id;
        this.project = project;
        this.title = title;
        this.date = date;
    }

    /**
     * Replaces the whole set, renumbering as it goes.
     *
     * <p>Positions are assigned here rather than trusted from the caller: they
     * are what the order of the tree is drawn from, and a gap or a duplicate
     * would show up as two screens claiming the same place.
     */
    public void replaceScreens(List<Screen> replacements) {
        screens.clear();
        int index = 0;
        for (Screen screen : replacements) {
            screen.setMeeting(this);
            screen.setPosition(index++);
            screens.add(screen);
        }
        touch();
    }

    public void markScreensMoved(Project destination, Instant when) {
        this.movedTo = destination;
        this.movedToName = destination == null ? null : destination.getName();
        for (Screen screen : screens) {
            screen.markMoved(when);
        }
        touch();
    }

    /**
     * Reset: the screens go, the notes stay.
     *
     * <p>Marked and then dropped from the list, in that order. The rows survive with
     * {@code status = 0} — they are still managed, so the mark is written — and the
     * meeting reports no screens, which is what a reset has to look like.
     */
    public void clearScreens() {
        screens.forEach(Screen::markDeleted);
        screens.clear();
        this.movedTo = null;
        this.movedToName = null;
        touch();
    }

    /** Deletes the meeting without removing it, taking the screens it still has. */
    public void markDeleted() {
        this.status = RecordStatus.DELETED;
        screens.forEach(Screen::markDeleted);
        touch();
    }

    public void touch() {
        this.updatedAt = Instant.now();
    }

    public String getId() {
        return id;
    }

    public Project getProject() {
        return project;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public String getAttendees() {
        return attendees;
    }

    public void setAttendees(String attendees) {
        this.attendees = attendees == null ? "" : attendees;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes == null ? "" : notes;
    }

    public MeetingKind getKind() {
        return kind;
    }

    public void setKind(MeetingKind kind) {
        this.kind = kind == null ? MeetingKind.MEETING_NOTE : kind;
    }

    public TaskSource getSource() {
        return source;
    }

    public void setSource(TaskSource source) {
        this.source = source == null ? TaskSource.MEETING : source;
    }

    public String getPostedBy() {
        return postedBy;
    }

    public void setPostedBy(String postedBy) {
        this.postedBy = postedBy;
    }

    public Project getProduct() {
        return product;
    }

    public String getProductName() {
        return productName;
    }

    public void setProduct(Project product) {
        this.product = product;
        this.productName = product == null ? null : product.getName();
    }

    public Project getMovedTo() {
        return movedTo;
    }

    public String getMovedToName() {
        return movedToName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public List<Screen> getScreens() {
        return screens;
    }

    public int getStatus() {
        return status;
    }

    public boolean isDeleted() {
        return status == RecordStatus.DELETED;
    }
}
