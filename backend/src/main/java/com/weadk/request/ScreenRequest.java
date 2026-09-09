package com.weadk.request;

import com.weadk.common.Platform;
import com.weadk.common.RecordStatus;
import com.weadk.common.ScreenType;
import com.weadk.project.Project;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A screen that has arrived in a product and is waiting for a round: the
 * Request tab.
 *
 * <p>Its place in the IA is kept as the path it was agreed at, not as a foreign
 * key, because the parent may not exist in this product yet — the whole point
 * of the Request tab is that these screens are ahead of the rounds.
 */
@Entity
@Table(name = "screen_request")
public class ScreenRequest {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(nullable = false)
    private String name;

    private String route;

    /** "From Fleet management portal", or the task it came from. */
    @Column(name = "from_label", nullable = false)
    private String fromLabel = "";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "parent_path", nullable = false, columnDefinition = "jsonb")
    private List<String> parentPath = new ArrayList<>();

    @Column(name = "parent_name", nullable = false)
    private String parentName = "Top level";

    @Column(name = "screen_type", nullable = false)
    private ScreenType screenType = ScreenType.SCREEN;

    @Column(nullable = false)
    private Platform platform = Platform.PC;

    /** Set when it is filed into a round; null while it is still waiting. */
    private Integer version;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "moved_at")
    private Instant movedAt;

    /** Live or deleted. See {@link RecordStatus}. */
    @Column(nullable = false)
    private int status = RecordStatus.ACTIVE;

    protected ScreenRequest() {}

    public ScreenRequest(String id, Project project, String name) {
        this.id = id;
        this.project = project;
        this.name = name;
    }

    public boolean isWaiting() {
        return version == null;
    }

    public void fileInto(int roundVersion) {
        this.version = roundVersion;
        this.movedAt = Instant.now();
    }

    public String getId() {
        return id;
    }

    public Project getProject() {
        return project;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getRoute() {
        return route;
    }

    public void setRoute(String route) {
        this.route = route;
    }

    public String getFromLabel() {
        return fromLabel;
    }

    public void setFromLabel(String fromLabel) {
        this.fromLabel = fromLabel == null ? "" : fromLabel;
    }

    public List<String> getParentPath() {
        return parentPath;
    }

    public void setParentPath(List<String> parentPath) {
        this.parentPath = parentPath == null ? new ArrayList<>() : new ArrayList<>(parentPath);
    }

    public String getParentName() {
        return parentName;
    }

    public void setParentName(String parentName) {
        this.parentName = parentName == null || parentName.isBlank() ? "Top level" : parentName;
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

    public Integer getVersion() {
        return version;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getMovedAt() {
        return movedAt;
    }

    public int getStatus() {
        return status;
    }

    public boolean isDeleted() {
        return status == RecordStatus.DELETED;
    }

    /** Deletes the request without removing it. */
    public void markDeleted() {
        this.status = RecordStatus.DELETED;
    }
}
