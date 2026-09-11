#!/usr/bin/env bash
#
# Put the dev stack on the internet through Cloudflare quick tunnels — and keep localhost.
#
#   scripts/tunnel.sh         # start (or reuse) the tunnels, write deploy/dev.local.env, bring the stack up
#   scripts/tunnel.sh stop    # stop the tunnels, remove the override; the stack goes back to localhost only
#
# A quick tunnel needs no account, and the price is that it has no name: every start gets a
# new random *.trycloudflare.com hostname. The API has to know that hostname, because it is
# the OAuth2 issuer, a CORS origin and a redirect URI, all of which the browser checks. So
# this script captures both URLs and writes them to deploy/dev.local.env, which stack.sh
# layers over dev.env. Both origins are listed, so the one stack answers on
# http://localhost:3000 and on the tunnel alike.
#
# The tunnels are containers in the stack, behind compose's `tunnel` profile, so nothing
# runs on the machine and `pnpm stack:dev:down` takes them with it. They start before the
# rest: the API has to be given the hostname at startup, and bringing it up first would
# mean restarting it the moment the tunnel had a URL. A later `pnpm stack:dev` leaves them
# alone — their definition holds none of the values that change, so compose has no reason
# to recreate them, and the URLs survive.
#
# They do not survive a reboot, or a crash: cloudflared is deliberately not restarted, since
# a new process means a new hostname and silently swapping it under a running stack is
# worse than stopping. After one, run this again — the hostnames will be new, and anyone
# holding the old links needs the new ones. That churn is the reason to graduate to a named
# tunnel with fixed hostnames when it starts to hurt.
set -euo pipefail
cd "$(dirname "$0")/.."

# Read by stack-env.sh below, which is what shellcheck cannot see from here.
# shellcheck disable=SC2034
ENVIRONMENT=dev
# shellcheck source=scripts/lib/stack-env.sh
source scripts/lib/stack-env.sh

WEB_PORT=3000

if [[ "${1:-}" == "stop" ]]; then
  compose --profile tunnel rm -sf tunnel-web tunnel-api >/dev/null 2>&1 || true
  rm -f "$LOCAL_ENV_FILE"
  echo "Tunnels stopped and $LOCAL_ENV_FILE removed. Run 'pnpm stack:dev' to recreate the stack for localhost only."
  exit 0
fi

# Starts the tunnel containers if they are not already up, and prints the public URL of
# one of them. A running tunnel is left alone rather than restarted, because restarting it
# changes the URL — which is the whole difficulty with quick tunnels.
compose --profile tunnel up -d tunnel-web tunnel-api

tunnel_url() {
  local service="$1" url=""
  for _ in $(seq 1 40); do
    url="$(tunnel_hostname "$service")"
    [[ -n "$url" ]] && break
    sleep 2
  done
  [[ -n "$url" ]] || {
    echo "The $service tunnel gave no URL in 80s; see 'docker compose logs $service'." >&2
    exit 1
  }
  printf '%s' "$url"
}

WEB_URL="$(tunnel_url tunnel-web)"
API_URL="$(tunnel_url tunnel-api)"

cat >"$LOCAL_ENV_FILE" <<ENV
# Written by scripts/tunnel.sh on $(date '+%Y-%m-%d %H:%M'). Layered over dev.env by stack.sh.
# Git-ignored, and rewritten on every run — nothing of your own belongs here; deploy/dev.secrets.env
# is the file for that. Delete this one, or run 'pnpm stack:dev:tunnel:stop', for localhost only.

# What the browser is told the API is. The tunnel, so the workspace works from any device.
# From localhost the calls take the same route, which costs a Cloudflare round trip each.
PUBLIC_API_URL=$API_URL

# Where the workspace answers. Nothing is derived from this while the two below are set
# outright — it is here so 'pnpm stack:dev' reports the tunnel rather than localhost.
PUBLIC_WEB_URL=$WEB_URL

# Every place the workspace is opened from. The tunnel first: that is where a browser that
# lands on the API's root by mistake gets sent, and localhost would be useless to a phone.
CORS_ORIGINS=$WEB_URL,http://localhost:$WEB_PORT
OAUTH2_REDIRECT_URIS=$WEB_URL/auth/callback,http://localhost:$WEB_PORT/auth/callback
OAUTH2_POST_LOGOUT_URIS=$WEB_URL/login,http://localhost:$WEB_PORT/login
ENV

bash scripts/stack.sh dev up

echo "  and through the tunnels:"
echo "    workspace  $WEB_URL"
echo "    api        $API_URL"
