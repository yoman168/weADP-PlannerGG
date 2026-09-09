package com.weadk.oauth;

import com.weadk.auth.AppUser;
import com.weadk.auth.AppUserRepository;
import java.util.List;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The sign-in page authenticates against {@code app_user}.
 *
 * <p>The username is the email address, because that is what the workspace already knows
 * people by and asking them to remember a second handle would be inventing a problem.
 */
@Service
public class AppUserDetailsService implements UserDetailsService {

    private final AppUserRepository users;

    public AppUserDetailsService(AppUserRepository users) {
        this.users = users;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) {
        AppUser user = users.findByEmail(AppUser.normalise(username))
                .orElseThrow(() -> new UsernameNotFoundException("No account for " + username));
        if (user.getPasswordHash() == null) {
            // An account that exists for attribution but signs in somewhere else. Reported as
            // not found rather than as a different failure: which accounts are password
            // accounts is not something a sign-in form should disclose.
            throw new UsernameNotFoundException("No password sign-in for " + username);
        }
        List<SimpleGrantedAuthority> authorities = user.getRoles().stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .toList();
        return User.withUsername(user.getId())
                .password(user.getPasswordHash())
                .authorities(authorities)
                .disabled(user.isDisabled())
                .build();
    }
}
