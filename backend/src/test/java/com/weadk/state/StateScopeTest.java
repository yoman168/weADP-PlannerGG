package com.weadk.state;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Which keys belong to a person rather than the team.
 *
 * <p>The distinction did not exist while this state lived in the browser. Getting it wrong
 * in either direction is a visible bug: a shared key marked personal splits a team's
 * project in two, and a personal key left shared means one person changing their language
 * changes everyone's.
 */
class StateScopeTest {

    @Test
    @DisplayName("preferences belong to the viewer")
    void preferencesArePersonal() {
        assertThat(StateScope.personal("we-adk:locale")).isTrue();
        assertThat(StateScope.personal("we-adk:sidebar-config")).isTrue();
        assertThat(StateScope.personal("we-adk:version-rail-width")).isTrue();
        assertThat(StateScope.personal("we-adk:whats-new:proj-x:v2")).isTrue();
    }

    @Test
    @DisplayName("the project's own work is shared, and so is anything unclassified")
    void workIsShared() {
        assertThat(StateScope.personal("we-adk:business:versions:proj-x")).isFalse();
        assertThat(StateScope.personal("we-adk:task-status:proj-x")).isFalse();
        assertThat(StateScope.personal("we-adk:qa:runs:proj-x")).isFalse();
        // Shared is the default on purpose: a key nobody classified ends up visible to the
        // team, which is noticed at once, rather than private to one browser, which is not.
        assertThat(StateScope.personal("we-adk:something-nobody-thought-about")).isFalse();
    }

    @Test
    @DisplayName("credentials are refused outright")
    void credentialsRejected() {
        assertThat(StateScope.rejected("we-adk:claude-token")).isTrue();
        assertThat(StateScope.rejected("we-adk:api-token")).isTrue();
        assertThat(StateScope.rejected("we-adk:api-user")).isTrue();
        assertThat(StateScope.rejected("we-adk:locale")).isFalse();
    }

    @Test
    @DisplayName("a personal key is owned by the viewer, a shared key by the project")
    void ownership() {
        assertThat(StateScope.ownerFor("we-adk:locale", "user-1")).isEqualTo("user-1");
        assertThat(StateScope.ownerFor("we-adk:task-status:p", "user-1")).isEqualTo(StateScope.SHARED);
    }
}
