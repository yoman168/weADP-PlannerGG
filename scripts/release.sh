#!/usr/bin/env bash
#
# Put one published release on this host's prod stack.
#
#   bash scripts/release.sh sha-1a2b3c4     # pull those images and start them
#   bash scripts/release.sh v1.2.0
#   bash scripts/release.sh rollback        # back to the release before this one
#   bash scripts/release.sh status          # what is running, and what it was released from
#
# Run by .github/workflows/deploy.yml over SSH, and by hand on the host when something has
# to go back in a hurry. It is the only part of the pipeline that runs here, and it holds
# no credentials of its own: a registry token arrives on stdin, and deploy/prod.env — the
# file with the real database password — belongs to this host and is never shipped.
#
# What it does, in order, because the order is the point:
#
#   1. check the web image was built for this host's PUBLIC_API_URL, before anything stops
#   2. write deploy/prod.release.env, keeping the old one as the rollback target
#   3. start the stack on those images
#   4. wait for both containers to be healthy, and undo the release if they are not
#
# The schema is not part of any of that. Flyway runs inside the API at startup and migrates
# forward only, so a rollback returns the code and leaves the database where the release
# left it. A migration that older code cannot read is therefore a migration to think about
# before it ships, not after — add columns, do not repurpose them.
set -euo pipefail
cd "$(dirname "$0")/.."

ENVIRONMENT="${RELEASE_ENVIRONMENT:-prod}"
# shellcheck source=scripts/lib/stack-env.sh
source scripts/lib/stack-env.sh

IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-}"
PREVIOUS_ENV_FILE="deploy/${ENVIRONMENT}.release.previous.env"
ENV_FILE_NAME="${ENVIRONMENT}.env"
COMMAND="${1:-}"

# stack-env.sh decides the compose invocation from the files that exist when it is sourced,
# and this script writes one of them: deploy/<env>.release.env is what layers the published
# images on. Every write to it is followed by this, or the release would be started with the
# stack as it was a moment ago — on a host releasing for the first time, that is the
# build-from-source stack, which would ignore the images just pulled and compile them again.
reload_stack_env() {
  # shellcheck source=scripts/lib/stack-env.sh
  source scripts/lib/stack-env.sh
}

say() { printf '  %s\n' "$*"; }
die() {
  printf '\n  %s\n\n' "$*" >&2
  exit 1
}

# What the stack is running now, for `status` and for the summary after a release.
report() {
  local service container
  say "$STACK_NAME"
  for service in api web; do
    container="$(compose ps -q "$service" 2>/dev/null || true)"
    if [[ -z "$container" ]]; then
      say "  $service        not running"
      continue
    fi
    printf '    %-10s %s  (%s)\n' "$service" \
      "$(docker inspect --format '{{index .Config.Image}}' "$container")" \
      "$(docker inspect --format '{{.State.Status}}{{with .State.Health}}, {{.Status}}{{end}}' "$container")"
  done
  [[ -f "$RELEASE_ENV_FILE" ]] && grep -E '^# Released ' "$RELEASE_ENV_FILE" | sed 's/^# /    /'
  return 0
}

if [[ "$COMMAND" == "status" ]]; then
  report
  exit 0
fi

# `rollback` is the previous release file, replayed. It carries its own image names, so
# nothing has to be remembered or typed — and nothing is pulled that was not already here.
if [[ "$COMMAND" == "rollback" ]]; then
  [[ -f "$PREVIOUS_ENV_FILE" ]] || die "No $PREVIOUS_ENV_FILE — this host has released only once, so there is nothing to go back to."
  TAG="$(grep -E '^RELEASE_TAG=' "$PREVIOUS_ENV_FILE" | head -1 | cut -d= -f2-)"
  say "Rolling back to ${TAG:-the previous release}."
  cp "$PREVIOUS_ENV_FILE" "$RELEASE_ENV_FILE"
  reload_stack_env
  compose up -d --remove-orphans
  report
  exit 0
fi

TAG="$COMMAND"
[[ -n "$TAG" ]] || die "usage: bash scripts/release.sh <image-tag|rollback|status>"
[[ -n "$IMAGE_REPOSITORY" ]] || die "IMAGE_REPOSITORY is unset. The deploy workflow sets it; by hand it is ghcr.io/<owner>/<repo>."

API_IMAGE="$IMAGE_REPOSITORY/api:$TAG"
WEB_IMAGE="$IMAGE_REPOSITORY/web:$TAG"

# The token, if one was piped in. Never an argument: a command line is readable by every
# process on the machine, and this one would have carried it across the SSH session too.
if [[ ! -t 0 ]]; then
  GHCR_TOKEN="$(cat)"
  if [[ -n "$GHCR_TOKEN" ]]; then
    printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-x}" --password-stdin >/dev/null
    say "Signed in to ghcr.io as ${GHCR_USER:-x}."
  fi
fi

say "Pulling $TAG."
docker pull --quiet "$API_IMAGE" >/dev/null
docker pull --quiet "$WEB_IMAGE" >/dev/null

# The check worth doing before anything stops.
#
# NEXT_PUBLIC_API_BASE_URL is inlined into the browser bundle when the web image is built,
# so an image is built for one API URL and cannot be repointed by restarting it. CI stamps
# the URL it built with onto the image; this compares that with what this host serves. A
# mismatch is a workspace whose every request goes to the wrong origin — visible only in a
# browser console, and only after the release is live.
BUILT_FOR="$(docker image inspect --format '{{index .Config.Labels "com.weadk.public-api-url"}}' "$WEB_IMAGE" 2>/dev/null || true)"
HOST_API_URL="$(stack_value PUBLIC_API_URL)"
if [[ -z "$BUILT_FOR" ]]; then
  say "note: $WEB_IMAGE carries no com.weadk.public-api-url label, so the bundle's API URL cannot be checked."
elif [[ -n "$HOST_API_URL" && "$BUILT_FOR" != "$HOST_API_URL" ]]; then
  cat >&2 <<NOTE

  The web image was built for a different API than this host serves.

      image  $BUILT_FOR
      host   $HOST_API_URL  (deploy/$ENV_FILE_NAME)

  Nothing was changed, and nothing can be: the URL is compiled into the browser bundle, so
  restarting cannot move it. Set the PUBLIC_API_URL repository variable to the host value
  above and let CI build the image again.

NOTE
  exit 1
fi

# Keep the outgoing release as the rollback target. Only when there is one, and only when
# it is a different release — re-running the same tag must not overwrite the way back.
if [[ -f "$RELEASE_ENV_FILE" ]] && ! grep -qxF "RELEASE_TAG=$TAG" "$RELEASE_ENV_FILE"; then
  cp "$RELEASE_ENV_FILE" "$PREVIOUS_ENV_FILE"
fi

cat >"$RELEASE_ENV_FILE" <<ENV
# Written by scripts/release.sh on $(date '+%Y-%m-%d %H:%M:%S %Z').
# Released $TAG${RELEASED_FROM:+ from ${RELEASED_FROM:0:7}}
#
# Git-ignored, and rewritten on every release. While it exists, scripts/lib/stack-env.sh
# layers deploy/compose.release.yml on and the stack runs these images instead of building
# from source. Delete it, and 'pnpm stack:prod' builds on this host again.
RELEASE_TAG=$TAG
API_IMAGE=$API_IMAGE
WEB_IMAGE=$WEB_IMAGE
ENV

reload_stack_env

say "Starting."
compose up -d --remove-orphans

# Healthy, not merely started. Both images carry a HEALTHCHECK — the API's is its readiness
# probe, which is false until Flyway has finished and the datasource answers — so this is
# the release actually serving rather than the container having a process in it.
# Five minutes, unless this host needs longer. What is being waited for is the API's
# readiness probe, which stays false until Flyway has finished — and a migration over a
# large table is the one step here that can legitimately take minutes.
HEALTH_TIMEOUT="${RELEASE_HEALTH_TIMEOUT:-300}"

wait_healthy() {
  local service container status attempts
  attempts=$((HEALTH_TIMEOUT / 5))
  ((attempts > 0)) || attempts=1
  for service in api web; do
    container="$(compose ps -q "$service")"
    [[ -n "$container" ]] || {
      echo "  $service did not start at all." >&2
      return 1
    }
    for _ in $(seq 1 "$attempts"); do
      # `none` is a service whose image declares no HEALTHCHECK. Nothing here is in that
      # position, but treating it as a failure would make this script the reason a release
      # could not go out if one ever were.
      status="$(docker inspect --format '{{with .State.Health}}{{.Status}}{{else}}none{{end}}' "$container")"
      # `unhealthy` is not yet fatal: a starting container fails its first probes by design,
      # and Docker says unhealthy once the retries are used up rather than while it waits.
      [[ "$status" == "healthy" || "$status" == "none" ]] && break
      sleep 5
    done
    [[ "$status" == "healthy" || "$status" == "none" ]] || {
      printf '\n  %s is %s after %ss. Its last words:\n\n' "$service" "$status" "$HEALTH_TIMEOUT" >&2
      compose logs --tail=40 "$service" >&2
      return 1
    }
  done
}

if ! wait_healthy; then
  if [[ -f "$PREVIOUS_ENV_FILE" ]]; then
    printf '\n  Rolling back — the release did not come up.\n' >&2
    cp "$PREVIOUS_ENV_FILE" "$RELEASE_ENV_FILE"
    reload_stack_env
    compose up -d --remove-orphans
    report >&2
    die "$TAG failed its health check and the previous release was put back. Note that any migration it ran has NOT been reversed."
  fi
  die "$TAG failed its health check, and there is no previous release on this host to fall back to. The stack is left as it is so it can be looked at."
fi

echo
say "$TAG is live."
report
