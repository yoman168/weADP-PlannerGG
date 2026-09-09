# Putting we-adk on the shared Mac mini edge

The app runs in Docker on `127.0.0.1:3003`. Everything below is about making it
reachable through the one Cloudflare tunnel this machine already runs.

## What already exists

```text
Internet → macmini-tunnel  (cloudflare/cloudflared, free Quick Tunnel)
             → macmini-edge  (nginx:1.27-alpine, 127.0.0.1:8080)
                  ├─ /cases/      → :3000  we-testcase   (Next basePath=/cases)
                  ├─ /securescan/ → :3001  SecureScan     (Next basePath=/securescan)
                  ├─ /ptas168/    → :8082  PTAS168        (Vite base /ptas168/)
                  ├─ /ohmycmo/    → :8889  OhMyCMO
                  └─ /adk/        → :3003  WE-ADK         ← to add
```

Both containers are defined in
`/Users/kosign/Projects/we-testcase-ms/deploy/edge/docker-compose.yml`
and are shared by five projects.

> **The tunnel URL is fragile.** `macmini-tunnel` is a *Quick Tunnel*: it mints a
> brand-new random `*.trycloudflare.com` hostname **every time it restarts**, and
> that one hostname fronts all five apps. So never `docker restart macmini-tunnel`
> to pick up an nginx change — `nginx -s reload` re-reads the config without
> touching the tunnel's connection.

## Why `/adk` and not `/we-adk`

Next inlines `basePath` into every client bundle and `/_next/*` asset URL, so the
prefix has to be a real basePath, not just an nginx rewrite — nginx here
deliberately does not strip prefixes.

This app's own routes already begin with `/we-adk` (`src/app/we-adk/…`), so
`BASE_PATH=/we-adk` would serve the project list at `/we-adk/we-adk`. Using
`/adk` keeps one short prefix without renaming 69 route files:

| URL | Screen |
| --- | --- |
| `/adk/we-adk` | Your projects (entry) |
| `/adk/we-adk/production` | Production screens |
| `/adk/we-adk/devadmin` | DevAdmin |
| `/adk/eacc` | eACC Cloud mockups |
| `/adk` | 307 → `/adk/we-adk` |

To change it, edit `BASE_PATH` in both `docker-compose.yml` and the nginx block
below, then rebuild — it is baked in at build time.

## The nginx change

Edit `/Users/kosign/Projects/we-testcase-ms/deploy/edge/nginx.conf`.

**1.** Add an upstream, next to the existing ones:

```nginx
  upstream weadk {
    server host.docker.internal:3003;
    keepalive 8;
  }
```

**2.** Add two locations inside the `listen 8080 default_server;` block, after
the `/ohmycmo` pair. This is what makes the tunnel URL work:

```nginx
    location /adk/ {
      proxy_pass http://weadk$uri$is_args$args;
    }

    location = /adk {
      proxy_pass http://weadk$uri$is_args$args;
    }
```

**3.** Optional — a hostname block matching the shape of the other three, for
`/etc/hosts` testing (`127.0.0.1 adk.local`):

```nginx
  server {
    listen 8080;
    server_name ~^(adk|weadk|we-adk)\.;
    port_in_redirect off;
    absolute_redirect off;

    location / {
      proxy_pass http://weadk$uri$is_args$args;
    }
  }
```

**4.** Update the header comment and `www/index.html` listing so the edge still
documents itself.

## Apply it

Validate, then reload. Neither command restarts the tunnel:

```bash
docker exec macmini-edge nginx -t && docker exec macmini-edge nginx -s reload
```

Then check the app answers through the edge:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/adk/we-adk
```

`200` means done. If nginx rejects the config it keeps running the old one, so a
typo is not an outage; restore from the `.bak` file if needed.

## The public URL

As of this writing the Quick Tunnel had **no working hostname**: the last one it
announced was `engine-occur-kids-uploaded.trycloudflare.com` on 2026-08-24, the
container restarted 2026-09-01 without minting a replacement, and that host no
longer resolves. `/cases/`, `/securescan/`, `/ptas168/` and `/ohmycmo/` are all
equally unreachable from outside right now.

To mint a fresh one — **this changes the public URL for all five projects**:

```bash
docker restart macmini-tunnel && sleep 8 && docker logs macmini-tunnel 2>&1 | grep trycloudflare
```

For a hostname that survives restarts, a *named* tunnel is the fix. It needs a
Cloudflare zone and an interactive `cloudflared tunnel login`; the existing
`deploy/cloudflared/config.edge.example.yml` in the we-testcase repo sketches the
hostname-routing version.
