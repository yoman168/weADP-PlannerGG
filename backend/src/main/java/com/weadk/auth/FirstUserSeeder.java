package com.weadk.auth;

import java.util.Arrays;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates the first account, once, on an empty table.
 *
 * <p>A service with authentication switched on and nobody in the user table is a service
 * nobody can sign in to, and there is no console here to create the first account from.
 * So one is seeded from {@code weadk.auth.seed.*} — but only when the table is empty, so
 * a redeploy cannot quietly reset a password that has since been changed.
 */
@Component
public class FirstUserSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(FirstUserSeeder.class);

    private final AppUserRepository users;
    private final AuthProperties props;
    private final PasswordEncoder passwords;

    public FirstUserSeeder(AppUserRepository users, AuthProperties props, PasswordEncoder passwords) {
        this.users = users;
        this.props = props;
        this.passwords = passwords;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        AuthProperties.Seed seed = props.seed();
        if (!seed.given()) {
            if (users.count() == 0) {
                log.warn(
                        "No accounts exist and weadk.auth.seed.email/password are unset — nobody can sign in. "
                                + "Set both to create the first account.");
            }
            return;
        }
        if (users.count() > 0) {
            return;
        }
        AppUser user = new AppUser(seed.email(), seed.name());
        user.setPasswordHash(passwords.encode(seed.password()));
        user.setRoles(roles(seed.roles()));
        users.save(user);
        log.info("Seeded the first account {} with roles {}.", user.getEmail(), user.getRoles());
    }

    private static List<String> roles(String configured) {
        if (configured == null || configured.isBlank()) {
            return List.of("USER", "ADMIN");
        }
        return Arrays.stream(configured.split(","))
                .map(String::trim)
                .filter(role -> !role.isEmpty())
                .map(role -> role.toUpperCase(java.util.Locale.ROOT))
                .distinct()
                .toList();
    }
}
