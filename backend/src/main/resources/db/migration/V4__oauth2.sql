-- The authorization server's own tables.
--
-- Verbatim from Spring Authorization Server 1.5.8, with the two changes its own schema
-- comments require for Postgres: every `timestamp` becomes `timestamptz` so instants are
-- stored accurately, and every `blob` becomes `text` because Postgres has no blob type.
-- Column names and widths are otherwise untouched — `JdbcRegisteredClientRepository` and
-- `JdbcOAuth2AuthorizationService` write these columns by name, so this is their contract
-- and not ours to tidy.
--
-- Kept in the database rather than in memory so a restart does not silently sign everyone
-- out: an in-memory authorization service loses every refresh token when the process ends.

create table oauth2_registered_client (
    id varchar(100) not null,
    client_id varchar(100) not null,
    client_id_issued_at timestamptz default current_timestamp not null,
    client_secret varchar(200) default null,
    client_secret_expires_at timestamptz default null,
    client_name varchar(200) not null,
    client_authentication_methods varchar(1000) not null,
    authorization_grant_types varchar(1000) not null,
    redirect_uris varchar(1000) default null,
    post_logout_redirect_uris varchar(1000) default null,
    scopes varchar(1000) not null,
    client_settings varchar(2000) not null,
    token_settings varchar(2000) not null,
    primary key (id)
);

create table oauth2_authorization (
    id varchar(100) not null,
    registered_client_id varchar(100) not null,
    principal_name varchar(200) not null,
    authorization_grant_type varchar(100) not null,
    authorized_scopes varchar(1000) default null,
    attributes text default null,
    state varchar(500) default null,
    authorization_code_value text default null,
    authorization_code_issued_at timestamptz default null,
    authorization_code_expires_at timestamptz default null,
    authorization_code_metadata text default null,
    access_token_value text default null,
    access_token_issued_at timestamptz default null,
    access_token_expires_at timestamptz default null,
    access_token_metadata text default null,
    access_token_type varchar(100) default null,
    access_token_scopes varchar(1000) default null,
    oidc_id_token_value text default null,
    oidc_id_token_issued_at timestamptz default null,
    oidc_id_token_expires_at timestamptz default null,
    oidc_id_token_metadata text default null,
    refresh_token_value text default null,
    refresh_token_issued_at timestamptz default null,
    refresh_token_expires_at timestamptz default null,
    refresh_token_metadata text default null,
    user_code_value text default null,
    user_code_issued_at timestamptz default null,
    user_code_expires_at timestamptz default null,
    user_code_metadata text default null,
    device_code_value text default null,
    device_code_issued_at timestamptz default null,
    device_code_expires_at timestamptz default null,
    device_code_metadata text default null,
    primary key (id)
);

-- Looked up on every token refresh and every code exchange.
create index oauth2_authorization_client_principal_idx
    on oauth2_authorization (registered_client_id, principal_name);

create table oauth2_authorization_consent (
    registered_client_id varchar(100) not null,
    principal_name varchar(200) not null,
    authorities varchar(1000) not null,
    primary key (registered_client_id, principal_name)
);

-- The signing key.
--
-- One row, holding the RSA key pair the access tokens are signed with. It lives here
-- because it has to outlive the process: keys generated at startup mean every restart
-- invalidates every token that was issued before it, which reads to a user as being
-- randomly signed out. Generated on first boot and read back afterwards.
create table oauth2_signing_key (
    id          text        primary key,
    public_key  text        not null,
    private_key text        not null,
    created_at  timestamptz not null default now()
);
