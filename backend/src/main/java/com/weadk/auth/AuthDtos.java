package com.weadk.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

public final class AuthDtos {

    private AuthDtos() {}

    @Schema(name = "LoginRequest")
    public record Login(
            @NotBlank @Email @Size(max = 320) String email,
            @NotBlank @Size(min = 8, max = 200) String password) {}

    @Schema(name = "UserView", description = "Who the caller is, as the workspace shows them.")
    public record User(
            String id,
            String email,
            String name,
            String department,
            List<String> roles,
            String usageGroup,
            Instant lastLoginAt) {

        public static User of(AppUser user) {
            return new User(
                    user.getId(),
                    user.getEmail(),
                    user.getName(),
                    user.getDepartment(),
                    List.copyOf(user.getRoles()),
                    user.getUsageGroup(),
                    user.getLastLoginAt());
        }
    }

    @Schema(name = "LoginResponse")
    public record Session(
            @Schema(description = "Send as `Authorization: Bearer <token>`.") String token,
            Instant expiresAt,
            User user) {}
}
