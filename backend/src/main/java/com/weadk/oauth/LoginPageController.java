package com.weadk.oauth;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * The sign-in page.
 *
 * <p>It is served here, by the authorization server, rather than by the workspace. That is
 * the property the redirect buys: a password is typed into the server that can check it and
 * into nothing else, so the browser application never handles a credential and cannot leak
 * one. The workspace's own sign-in screen is a button that starts this flow.
 */
@Controller
@ConditionalOnProperty(prefix = "weadk.security", name = "mode", havingValue = "oauth2")
public class LoginPageController {

    @GetMapping("/login")
    public String login(
            @RequestParam(required = false) String error,
            @RequestParam(required = false) String signedOut,
            Model model) {
        // One message for a wrong password and for an address that does not exist. The
        // difference between them tells whoever is guessing which addresses are real.
        model.addAttribute("failed", error != null);
        model.addAttribute("signedOut", signedOut != null);
        return "login";
    }
}
