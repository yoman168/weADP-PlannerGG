package com.weadk.meeting;

import com.weadk.common.Platform;
import com.weadk.common.RecordStatus;
import com.weadk.common.ScreenType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * One generated screen: a whole page, and where it sits.
 *
 * <p>The parent is another screen rather than a folder, because in this product
 * a section is a screen — Login is not a folder containing the catalog, it is a
 * screen that opens it.
 */
@Entity
@Table(name = "screen")
public class Screen {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "meeting_id", nullable = false)
    private Meeting meeting;

    /** The order the screens are met in, which is part of the product. */
    @Column(name = "position", nullable = false)
    private int position;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, columnDefinition = "text")
    private String html = "";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private Screen parent;

    @Column(name = "screen_type", nullable = false)
    private ScreenType screenType = ScreenType.SCREEN;

    @Column(nullable = false)
    private Platform platform = Platform.PC;

    /** When the html last changed. With {@link #movedAt}, this is the N / M mark. */
    @Column(name = "updated_at")
    private Instant updatedAt;

    /** When it was last sent to a product. Null means it never has been. */
    @Column(name = "moved_at")
    private Instant movedAt;

    /**
     * Live or deleted. See {@link RecordStatus}.
     *
     * <p>A deleted screen keeps its {@code position}, which is why the unique index
     * on it covers live rows only: the generation after a reset starts again at 0.
     */
    @Column(nullable = false)
    private int status = RecordStatus.ACTIVE;

    protected Screen() {}

    public Screen(String id, Meeting meeting, int position, String name) {
        this.id = id;
        this.meeting = meeting;
        this.position = position;
        this.name = name;
    }

    /**
     * New to the product, changed since it was sent, or neither.
     *
     * <p>Two timestamps rather than a diff of the page: what matters is whether
     * the product has seen this screen, and whether it has seen this version.
     */
    public String change() {
        if (movedAt == null) {
            return "new";
        }
        return updatedAt != null && updatedAt.isAfter(movedAt) ? "modified" : null;
    }

    public String getId() {
        return id;
    }

    public Meeting getMeeting() {
        return meeting;
    }

    void setMeeting(Meeting meeting) {
        this.meeting = meeting;
    }

    public int getPosition() {
        return position;
    }

    void setPosition(int position) {
        this.position = position;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getHtml() {
        return html;
    }

    /** Writing the page is what makes it modified; the caller does not decide. */
    public void setHtml(String html) {
        this.html = html == null ? "" : html;
        this.updatedAt = Instant.now();
    }

    public Screen getParent() {
        return parent;
    }

    public void setParent(Screen parent) {
        this.parent = parent;
    }

    public ScreenType getScreenType() {
        return screenType;
    }

    public void setScreenType(ScreenType screenType) {
        this.screenType = screenType == null ? ScreenType.SCREEN : screenType;
    }

    public Platform getPlatform() {
        return platform;
    }

    public void setPlatform(Platform platform) {
        this.platform = platform == null ? Platform.PC : platform;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getMovedAt() {
        return movedAt;
    }

    public void markMoved(Instant when) {
        this.movedAt = when;
    }

    public int getStatus() {
        return status;
    }

    public boolean isDeleted() {
        return status == RecordStatus.DELETED;
    }

    /** Deletes the screen without removing it, page and placement included. */
    void markDeleted() {
        this.status = RecordStatus.DELETED;
    }
}
