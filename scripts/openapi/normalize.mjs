#!/usr/bin/env node
/**
 * Canonicalises an OpenAPI document so `openapi/openapi.json` is byte-stable:
 * object keys sorted recursively, array order kept (it is meaningful for
 * `required`, `enum`, `parameters`), and the `servers` block pinned to `/` so
 * the host the document was fetched from never leaks into the contract.
 *
 *   curl -s http://localhost:8080/v3/api-docs | node scripts/openapi/normalize.mjs > openapi/openapi.json
 */
import { readFileSync } from 'node:fs';

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])]),
    );
  }
  return value;
}

const input = readFileSync(process.argv[2] ?? 0, 'utf8');
const document = JSON.parse(input);
document.servers = [{ url: '/' }];
process.stdout.write(`${JSON.stringify(sortKeys(document), null, 2)}\n`);
