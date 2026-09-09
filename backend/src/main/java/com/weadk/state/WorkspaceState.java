package com.weadk.state;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

/**
 * One key of workspace state.
 *
 * <p>The value is the string the browser stored, kept exactly as it arrived — see the
 * migration for why it is {@code text} rather than {@code jsonb}.
 */
@Entity
@Table(name = "workspace_state")
@IdClass(WorkspaceState.Key.class)
public class WorkspaceState {

    /** {@code *} for shared state, or a user id. */
    @Id
    @Column(name = "owner", nullable = false)
    private String owner;

    @Id
    @Column(name = "state_key", nullable = false)
    private String stateKey;

    @Column(nullable = false)
    private String value;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected WorkspaceState() {}

    public WorkspaceState(String owner, String stateKey, String value) {
        this.owner = owner;
        this.stateKey = stateKey;
        this.value = value;
    }

    public void update(String value) {
        this.value = value;
        this.updatedAt = Instant.now();
    }

    public String getOwner() {
        return owner;
    }

    public String getStateKey() {
        return stateKey;
    }

    public String getValue() {
        return value;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    /** The composite key. Required by JPA; nothing outside this package constructs one. */
    public static class Key implements Serializable {

        private String owner;
        private String stateKey;

        public Key() {}

        public Key(String owner, String stateKey) {
            this.owner = owner;
            this.stateKey = stateKey;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Key key)) {
                return false;
            }
            return Objects.equals(owner, key.owner) && Objects.equals(stateKey, key.stateKey);
        }

        @Override
        public int hashCode() {
            return Objects.hash(owner, stateKey);
        }
    }
}
