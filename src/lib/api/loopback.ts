/**
 * Whether a request came from this machine.
 *
 * The AI routes carried this guard when they spawned the local `claude` CLI: the process
 * ran as the host user, and this app has been exposed through a tunnel before, so a
 * request from off-machine was a request to run a subprocess on someone else's behalf.
 *
 * They now forward to the API instead, which has its own authentication and no shell — so
 * the original reason is gone. The guard stays because it is a control someone chose to
 * have, and quietly dropping it would widen what these routes accept without anyone
 * deciding to. `SKETCHER_AI_ALLOW_REMOTE=1` still lifts it, which is how LAN and tunnel
 * access already works in this repo.
 */
import { type NextRequest } from 'next/server';

export function isLoopbackRequest(request: NextRequest): boolean {
  if (process.env.SKETCHER_AI_ALLOW_REMOTE === '1') return true;
  const host = (request.headers.get('host') ?? '').split(':')[0]?.toLowerCase() ?? '';
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
}
