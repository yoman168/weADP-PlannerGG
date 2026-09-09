package com.weadk.auth;

import com.weadk.common.Ids;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Someone allowed to call this API.
 *
 * <p>{@code passwordHash} is null for an account that signs in through an external
 * issuer — this service holds the row so usage can be attributed to a person, without
 * ever seeing their password.
 */
@Entity
@Table(name = "app_user")
public class AppUser {

    @Id
    private String id;

    /** Stored lower-cased; the database enforces it too. */
    @Column(nullable = false)
    private String email;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(nullable = false)
    private String name = "";

    private String department;

    /** Bare names — {@code USER}, {@code ADMIN}. The {@code ROLE_} prefix is added at the edge. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<String> roles = new ArrayList<>(List.of("USER"));

    /** The group DevAdmin totals usage by. */
    @Column(name = "usage_group")
    private String usageGroup;

    @Column(nullable = false)
    private boolean disabled = false;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected AppUser() {}

    public AppUser(String email, String name) {
        this.id = Ids.generate("user");
        this.email = normalise(email);
        this.name = name == null || name.isBlank() ? this.email : name;
    }

    public static String normalise(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    public void signedIn() {
        this.lastLoginAt = Instant.now();
    }

    public String getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name == null ? "" : name;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public List<String> getRoles() {
        return roles;
    }

    public void setRoles(List<String> roles) {
        this.roles = roles == null || roles.isEmpty()
                ? new ArrayList<>(List.of("USER"))
                : new ArrayList<>(roles);
    }

    public String getUsageGroup() {
        return usageGroup;
    }

    public void setUsageGroup(String usageGroup) {
        this.usageGroup = usageGroup;
    }

    public boolean isDisabled() {
        return disabled;
    }

    public void setDisabled(boolean disabled) {
        this.disabled = disabled;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
