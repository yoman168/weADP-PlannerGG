#!/usr/bin/env bash
# Exports the running API's OpenAPI document into openapi/openapi.json.
#
#   API_BASE_URL=http://localhost:8080 pnpm api:export
#
# Run `pnpm api:types` afterwards to regenerate src/lib/api/schema.d.ts. CI runs
# both and fails when either committed file is behind the Java controllers.
set -euo pipefail
cd "$(dirname "$0")/../.."
API_BASE_URL="${API_BASE_URL:-${NEXT_PUBLIC_API_BASE_URL:-http://localhost:8080}}"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
if ! curl -sSf -m 20 "${API_BASE_URL%/}/v3/api-docs" -o "$tmp"; then
  echo "Could not fetch ${API_BASE_URL%/}/v3/api-docs — is the backend running?" >&2
  exit 1
fi
node scripts/openapi/normalize.mjs "$tmp" > openapi/openapi.json
echo "Wrote openapi/openapi.json from ${API_BASE_URL%/}/v3/api-docs"
