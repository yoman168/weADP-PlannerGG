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
#
# The last two are git-ignored by `deploy/*.env`. They are separate files because tunnel.sh
# rewrites its one on every run, and a token kept there would be thrown away with the
# hostnames.

ENV_FILE="deploy/${ENVIRONMENT}.env"
LOCAL_ENV_FILE="deploy/${ENVIRONMENT}.local.env"
SECRETS_ENV_FILE="deploy/${ENVIRONMENT}.secrets.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE." >&2
  [[ "$ENVIRONMENT" == "prod" ]] &&
    echo "Copy deploy/prod.env.example to it and fill in the credentials." >&2
  exit 1
fi

ENV_FILES=(--env-file "$ENV_FILE")
[[ -f "$LOCAL_ENV_FILE" ]] && ENV_FILES+=(--env-file "$LOCAL_ENV_FILE")
[[ -f "$SECRETS_ENV_FILE" ]] && ENV_FILES+=(--env-file "$SECRETS_ENV_FILE")

# The dev stack layers its overrides on top of the base file; prod is the base file alone.
FILES=(-f deploy/compose.yml)
[[ "$ENVIRONMENT" == "dev" ]] && FILES+=(-f deploy/compose.dev.yml)

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
  for file in "$SECRETS_ENV_FILE" "$LOCAL_ENV_FILE" "$ENV_FILE"; do
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
tunnel_hostname() {
  compose logs --no-log-prefix "$1" 2>/dev/null |
    grep -oE 'https://[a-z0-9]+(-[a-z0-9]+){3}\.trycloudflare\.com' | head -1 || true
}
