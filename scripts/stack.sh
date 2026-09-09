#!/usr/bin/env bash
#
# One command per stack.
#
#   scripts/stack.sh dev  up        # build if needed and start
#   scripts/stack.sh prod up
#   scripts/stack.sh dev  down      # stop, keeping the database
#   scripts/stack.sh dev  logs api  # follow one service
#   scripts/stack.sh dev  tools     # add the database browser
#   scripts/stack.sh dev  ps
#   scripts/stack.sh dev  reset     # stop and DELETE the database
#
# The point of this wrapper is that the two stacks are never confused for one another. Each
# has its own compose project name, its own volumes and its own ports, and every command
# here carries the environment as its first word — so there is no "current" stack to be
# wrong about, and no way to `down` production while meaning to restart dev.
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

ENV_FILE="deploy/${ENVIRONMENT}.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE." >&2
  [[ "$ENVIRONMENT" == "prod" ]] &&
    echo "Copy deploy/prod.env.example to it and fill in the credentials." >&2
  exit 1
fi

# The dev stack layers its overrides on top of the base file; prod is the base file alone.
FILES=(-f deploy/compose.yml)
[[ "$ENVIRONMENT" == "dev" ]] && FILES+=(-f deploy/compose.dev.yml)

# Read the project name out of the env file rather than guessing it, so the name in
# `docker ps` is the one the file declares.
STACK_NAME="$(grep -E '^STACK_NAME=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
STACK_NAME="${STACK_NAME:-weadk-$ENVIRONMENT}"

compose() {
  docker compose --env-file "$ENV_FILE" -p "$STACK_NAME" "${FILES[@]}" "$@"
}

url() {
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-
}

case "$COMMAND" in
  up)
    compose up -d --build "$@"
    echo
    echo "  $STACK_NAME is up."
    echo "    workspace  $(url PUBLIC_WEB_URL)"
    echo "    api        $(url PUBLIC_API_URL)"
    echo "    docs       $(url PUBLIC_API_URL)/swagger-ui.html"
    ;;
  down) compose down "$@" ;;
  restart) compose restart "$@" ;;
  logs) compose logs -f --tail=100 "$@" ;;
  ps) compose ps "$@" ;;
  build) compose build "$@" ;;
  tools)
    compose --profile tools up -d adminer "$@"
    echo "  database browser  http://localhost:$(grep -E '^ADMINER_PORT=' "$ENV_FILE" | cut -d= -f2-)"
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
