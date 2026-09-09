package com.weadk.project;

import com.weadk.common.RecordStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * A project, of either kind.
 *
 * <p>{@code archived} is what separates them: an archived project is a Customer
 * project — meetings and generated screens, no rounds — and an active one is a
 * Product. The workspace has always drawn that distinction from this one flag,
 * and giving them separate tables here would mean teaching every join about a
 * difference the frontend does not have.
 */
@Entity
@Table(name = "project")
public class Project {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String customer = "";

    @Column(nullable = false)
    private String owner = "";

    @Column(nullable = false)
    private String summary = "";

    @Column(nullable = false)
    private String stage = "Project Brief";

    @Column(name = "status_label", nullable = false)
    private String statusLabel = "In progress";

    @Column(name = "status_tone", nullable = false)
    private String statusTone = "blue";

    @Column(nullable = false)
    private String accent = "blue";

    @Column(nullable = false)
    private BigDecimal spend = BigDecimal.ZERO;

    @Column(nullable = false)
    private boolean archived = false;

    /** Live or deleted. See {@link RecordStatus}; delete writes this rather than removing the row. */
    @Column(nullable = false)
    private int status = RecordStatus.ACTIVE;

    private String solution;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected Project() {}

    public Project(String id, String name) {
        this.id = id;
        this.name = name;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCustomer() {
        return customer;
    }

    public void setCustomer(String customer) {
        this.customer = customer == null ? "" : customer;
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        this.owner = owner == null ? "" : owner;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary == null ? "" : summary;
    }

    public String getStage() {
        return stage;
    }

    public void setStage(String stage) {
        this.stage = stage;
    }

    public String getStatusLabel() {
        return statusLabel;
    }

    public void setStatusLabel(String statusLabel) {
        this.statusLabel = statusLabel;
    }

    public String getStatusTone() {
        return statusTone;
    }

    public void setStatusTone(String statusTone) {
        this.statusTone = statusTone;
    }

    public String getAccent() {
        return accent;
    }

    public void setAccent(String accent) {
        this.accent = accent;
    }

    public BigDecimal getSpend() {
        return spend;
    }

    public void setSpend(BigDecimal spend) {
        this.spend = spend == null ? BigDecimal.ZERO : spend;
    }

    public boolean isArchived() {
        return archived;
    }

    public int getStatus() {
        return status;
    }

    public boolean isDeleted() {
        return status == RecordStatus.DELETED;
    }

    /**
     * Deletes the project without removing it.
     *
     * <p>What used to go with it — its meetings, their screens, its requests — is
     * marked by {@code ProjectService}: the foreign keys that used to cascade cannot
     * fire when the row stays.
     */
    public void markDeleted() {
        this.status = RecordStatus.DELETED;
        touch();
    }

    public void setArchived(boolean archived) {
        this.archived = archived;
    }

    public String getSolution() {
        return solution;
    }

    public void setSolution(String solution) {
        this.solution = solution;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void touch() {
        this.updatedAt = Instant.now();
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
