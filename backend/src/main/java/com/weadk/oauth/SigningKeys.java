package com.weadk.oauth;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The key access tokens are signed with, kept in the database.
 *
 * <p>Generating a key pair at startup is the usual shortcut and it is wrong here: the key
 * is what makes a token verifiable, so a new one on every restart invalidates every token
 * issued before it. To a user that reads as being signed out at random, and to a deployment
 * with more than one instance it reads as being signed out half the time, because each
 * instance would be signing with a different key.
 *
 * <p>So it is generated once, on first boot, and read back afterwards. Rotation is a
 * deliberate act: delete the row and restart, accepting that everyone signs in again.
 */
@Component
public class SigningKeys {

    private static final Logger log = LoggerFactory.getLogger(SigningKeys.class);

    /** One key at a time, under a fixed id, so two instances racing cannot both insert. */
    private static final String ROW_ID = "active";

    private final JdbcTemplate jdbc;

    public SigningKeys(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** The JWK set the server signs with and publishes at {@code /oauth2/jwks}. */
    @Transactional
    public JWKSource<SecurityContext> jwkSource() {
        StoredKey stored = read();
        if (stored == null) {
            stored = generateAndStore();
            log.info("Generated the OAuth2 signing key and stored it; tokens now survive a restart.");
        }
        RSAKey key = new RSAKey.Builder(stored.publicKey())
                .privateKey(stored.privateKey())
                .keyID(ROW_ID)
                .build();
        return new ImmutableJWKSet<>(new JWKSet(key));
    }

    private record StoredKey(RSAPublicKey publicKey, RSAPrivateKey privateKey) {}

    private StoredKey read() {
        return jdbc
                .query(
                        "select public_key, private_key from oauth2_signing_key where id = ?",
                        rs -> rs.next()
                                ? new StoredKey(
                                        publicKey(rs.getString("public_key")),
                                        privateKey(rs.getString("private_key")))
                                : null,
                        ROW_ID);
    }

    private StoredKey generateAndStore() {
        KeyPair pair = freshPair();
        RSAPublicKey publicKey = (RSAPublicKey) pair.getPublic();
        RSAPrivateKey privateKey = (RSAPrivateKey) pair.getPrivate();
        Base64.Encoder encoder = Base64.getEncoder();

        // `on conflict do nothing` rather than a plain insert: two instances starting
        // together would otherwise both generate and one would fail on the primary key.
        int inserted = jdbc.update(
                """
                insert into oauth2_signing_key (id, public_key, private_key)
                values (?, ?, ?) on conflict (id) do nothing
                """,
                ROW_ID,
                encoder.encodeToString(publicKey.getEncoded()),
                encoder.encodeToString(privateKey.getEncoded()));
        if (inserted == 0) {
            // Someone else won the race; theirs is the key.
            StoredKey theirs = read();
            if (theirs != null) {
                return theirs;
            }
        }
        return new StoredKey(publicKey, privateKey);
    }

    private static KeyPair freshPair() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return generator.generateKeyPair();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("This JVM has no RSA key pair generator", ex);
        }
    }

    private static RSAPublicKey publicKey(String base64) {
        try {
            return (RSAPublicKey) KeyFactory.getInstance("RSA")
                    .generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(base64)));
        } catch (NoSuchAlgorithmException | InvalidKeySpecException ex) {
            throw new IllegalStateException("The stored OAuth2 public key could not be read", ex);
        }
    }

    private static RSAPrivateKey privateKey(String base64) {
        try {
            return (RSAPrivateKey) KeyFactory.getInstance("RSA")
                    .generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(base64)));
        } catch (NoSuchAlgorithmException | InvalidKeySpecException ex) {
            throw new IllegalStateException("The stored OAuth2 private key could not be read", ex);
        }
    }

    /** A fresh id, for callers that need one. */
    static String newId() {
        return UUID.randomUUID().toString();
    }
}
