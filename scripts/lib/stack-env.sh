# Sourced, so it has no shebang of its own; this says which shell it is written for.
# shellcheck shell=bash

# How to address one stack, for the scripts that drive it.
#
# Sourced, not run. The caller sets ENVIRONMENT to dev or prod and cds to the repo root
# first; this defines `compose`, which every command in stack.sh and tunnel.sh goes
# through. Both scripts talk to the same project, and a difference between them in the
# project name or the layered env files would show up as two stacks that each believe they
# are the only one.
#
# Env files, in the order compose reads them — later wins:
#
#   deploy/<env>.env            committed; ports and throwaway credentials
#   deploy/<env>.local.env      written by scripts/tunnel.sh; the hostnames it captured
#   deploy/<env>.secrets.env    yours, and never written by a script: CLAUDE_CODE_OAUTH_TOKEN
#   deploy/<env>.release.env    written by scripts/release.sh; the two images CI published
#
# The last three are git-ignored by `deploy/*.env`. They are separate files because each is
# owned by something different — tunnel.sh rewrites its one on every run, release.sh rewrites
# its one on every deploy, and a token kept in either would be thrown away with them.
#
# The release file is also what decides the stack's shape: while it exists, compose.release.yml
# is layered on and the services run those published images instead of building from source.
# Delete it to go back to building.

ENV_FILE="deploy/${ENVIRONMENT}.env"
LOCAL_ENV_FILE="deploy/${ENVIRONMENT}.local.env"
SECRETS_ENV_FILE="deploy/${ENVIRONMENT}.secrets.env"
RELEASE_ENV_FILE="deploy/${ENVIRONMENT}.release.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE." >&2
  [[ "$ENVIRONMENT" == "prod" ]] &&
    echo "Copy deploy/prod.env.example to it and fill in the credentials." >&2
  exit 1
fi

ENV_FILES=(--env-file "$ENV_FILE")
[[ -f "$LOCAL_ENV_FILE" ]] && ENV_FILES+=(--env-file "$LOCAL_ENV_FILE")
[[ -f "$SECRETS_ENV_FILE" ]] && ENV_FILES+=(--env-file "$SECRETS_ENV_FILE")
[[ -f "$RELEASE_ENV_FILE" ]] && ENV_FILES+=(--env-file "$RELEASE_ENV_FILE")

# The dev stack layers its overrides on top of the base file; prod is the base file alone.
FILES=(-f deploy/compose.yml)
[[ "$ENVIRONMENT" == "dev" ]] && FILES+=(-f deploy/compose.dev.yml)
# Last, so it wins: while a release has been pulled, the services run those images and the
# `build:` blocks above are removed rather than overridden. scripts/release.sh writes it.
[[ -f "$RELEASE_ENV_FILE" ]] && FILES+=(-f deploy/compose.release.yml)

# Read the project name out of the env file rather than guessing it, so the name in
# `docker ps` is the one the file declares.
STACK_NAME="$(grep -E '^STACK_NAME=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
STACK_NAME="${STACK_NAME:-weadk-$ENVIRONMENT}"

compose() {
  docker compose "${ENV_FILES[@]}" -p "$STACK_NAME" "${FILES[@]}" "$@"
}

# The value the stack was actually given for a variable. The local files first, so what is
# printed is what won.
#
# Never fails, whatever is missing. These run under `set -euo pipefail`, where a grep that
# matches nothing or a cat of a file that is not there is enough to end the script — and
# both are ordinary here: the local files are optional, and a variable may simply be unset.
stack_value() {
  local file value
  for file in "$RELEASE_ENV_FILE" "$SECRETS_ENV_FILE" "$LOCAL_ENV_FILE" "$ENV_FILE"; do
    [[ -f "$file" ]] || continue
    value="$(grep -E "^$1=" "$file" | head -1 | cut -d= -f2- || true)"
    if [[ -n "$value" ]]; then
      printf '%s' "$value"
      return 0
    fi
  done
  return 0
}

# The hostname a running quick tunnel is serving, or nothing when that service is not up.
#
# Read from the container's log rather than from dev.local.env. The log is what cloudflared
# is doing; the env file is only what the stack was last told, and the two part company the
# moment a tunnel is restarted without the file being rewritten.
#
# The LAST hostname in the log, not the first. A restarted container keeps its log, and
# every start mints a new hostname — so `head -1` answers with the one from before the
# restart. That is worse than answering nothing: the URL looks right, resolves, and times
# out, and what it poisons is deploy/dev.local.env and from there the API URL baked into
# the workspace, which then cannot reach the API from any origin at all.
tunnel_hostname() {
  compose logs --no-log-prefix "$1" 2>/dev/null |
    grep -oE 'https://[a-z0-9]+(-[a-z0-9]+){3}\.trycloudflare\.com' | tail -1 || true
}
