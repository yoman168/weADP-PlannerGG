#!/usr/bin/env bash
#
# One command per stack.
#
#   scripts/stack.sh dev  up        # build if needed and start
#   scripts/stack.sh prod up
#   scripts/stack.sh dev  down      # stop, keeping the database
#   scripts/stack.sh dev  logs api  # follow one service
#   scripts/stack.sh dev  tools     # add the database browser
#   scripts/stack.sh dev  urls      # where it is answering, tunnels included
#   scripts/stack.sh dev  ps
#   scripts/stack.sh dev  reset     # stop and DELETE the database
#
# The point of this wrapper is that the two stacks are never confused for one another. Each
# has its own compose project name, its own volumes and its own ports, and every command
# here carries the environment as its first word — so there is no "current" stack to be
# wrong about, and no way to `down` production while meaning to restart dev.
#
# Everything the system needs to run is a container in that stack, including the two
# services that are only there in development: `claude-bridge`, which is how the API
# reaches Claude without an API key, and the Cloudflare tunnels behind the `tunnel`
# profile. Nothing is left running on the developer's machine to be forgotten.
set -euo pipefail

cd "$(dirname "$0")/.."

ENVIRONMENT="${1:-}"
COMMAND="${2:-up}"
shift 2 2>/dev/null || shift 1 2>/dev/null || true

case "$ENVIRONMENT" in
  dev | prod) ;;
  *)
    echo "usage: scripts/stack.sh <dev|prod> [up|down|restart|logs|ps|build|tools|reset] [args…]" >&2
    exit 2
    ;;
esac

# The project name, the layered env files and `compose` itself — shared with tunnel.sh so
# the two scripts cannot disagree about which stack they are driving.
# shellcheck source=scripts/lib/stack-env.sh
source scripts/lib/stack-env.sh

# Said once, at the point it can still be acted on.
#
# The dev API has no Anthropic key, so it calls the claude-bridge container instead — and
# that container has no Keychain to borrow a login from the way a process on the Mac would.
# `claude setup-token` mints the long-lived token it needs.
check_claude_token() {
  [[ "$ENVIRONMENT" == "dev" ]] || return 0
  [[ -n "$(stack_value CLAUDE_CODE_OAUTH_TOKEN)" ]] && return 0
  cat >&2 <<'NOTE'

  note: the AI features have no credential, so they will answer with an error.
        Run `claude setup-token` and put the token it prints in deploy/dev.secrets.env:

            CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat...

        Then `pnpm stack:dev` again. An ANTHROPIC_API_KEY in deploy/dev.secrets.env
        works too — the bridge runs the CLI with it.
NOTE
}

# Where the stack is answering.
#
# Localhost always, because the published ports do not stop working when a tunnel is up —
# and the tunnels underneath, read from the containers themselves, because a quick tunnel's
# hostname is generated at startup and written down nowhere a person would think to look.
print_urls() {
  local web api tunnel_web tunnel_api
  web="http://localhost:$(stack_value WEB_PORT)"
  api="http://localhost:$(stack_value API_PORT)"
  echo "    workspace  $web"
  echo "    api        $api"
  echo "    docs       $api/swagger-ui.html"

  tunnel_web="$(tunnel_hostname tunnel-web)"
  tunnel_api="$(tunnel_hostname tunnel-api)"
  if [[ -n "$tunnel_web" || -n "$tunnel_api" ]]; then
    echo "  and through the tunnels:"
    [[ -n "$tunnel_web" ]] && echo "    workspace  $tunnel_web"
    [[ -n "$tunnel_api" ]] && echo "    api        $tunnel_api"
  fi
}

case "$COMMAND" in
  up)
    compose up -d --build "$@"
    echo
    echo "  $STACK_NAME is up."
    print_urls
    check_claude_token
    ;;
  urls)
    echo "  $STACK_NAME"
    print_urls
    # An `&&` chain here would make "there are tunnels" the script's exit status.
    if [[ -z "$(tunnel_hostname tunnel-web)" ]]; then
      echo "  (no tunnels — 'pnpm stack:dev:tunnel' puts it on the internet)"
    fi
    ;;
  down) compose down "$@" ;;
  restart) compose restart "$@" ;;
  logs) compose logs -f --tail=100 "$@" ;;
  ps) compose ps "$@" ;;
  build) compose build "$@" ;;
  tools)
    compose --profile tools up -d adminer "$@"
    echo "  database browser  http://localhost:$(stack_value ADMINER_PORT)"
    ;;
  reset)
    # Deliberately awkward. `down -v` deletes the database, and doing that to the wrong
    # stack is not something a typo should be able to achieve.
    printf 'This deletes the %s database and everything in it. Type the stack name to confirm: ' "$STACK_NAME"
    read -r confirmation
    [[ "$confirmation" == "$STACK_NAME" ]] || {
      echo "Not confirmed; nothing was deleted." >&2
      exit 1
    }
    compose down -v
    ;;
  *) compose "$COMMAND" "$@" ;;
esac
