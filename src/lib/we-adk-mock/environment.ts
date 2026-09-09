/**
 * The environment a project needs running, as the monorepo analysis reads it.
 *
 * A round's screens are only half the product — behind them the monorepo
 * declares the processes the product actually runs on: the Next.js app, the
 * Nest API it calls, the Postgres the Prisma schema names, a queue, object
 * storage. The Monitor tab lists exactly these, the way `docker compose ps`
 * would, and runs them as one stack.
 *
 * Kept as data per project rather than parsed live: this mockup has no
 * monorepo on disk to walk, so the result of that analysis is recorded here.
 * Each service carries its evidence — `source` is the file the analysis found
 * it in, `note` is why the project needs it — so the list reads as a finding,
 * not a guess. Swapping this for a real analyzer changes this module and
 * nothing in the components.
 */

export type ServiceRole = 'frontend' | 'backend' | 'database' | 'cache' | 'storage' | 'worker';

export const ROLE_LABELS: Record<ServiceRole, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  database: 'Database',
  cache: 'Cache',
  storage: 'Object storage',
  worker: 'Worker',
};

export interface EnvironmentService {
  /** Service name as compose spells it — `web`, `api`, `db`. */
  id: string;
  role: ServiceRole;
  /** What the container runs: a registry image, or the monorepo's own build. */
  image: string;
  /** `host:container` port mappings. Empty for a process nothing connects to. */
  ports: string[];
  /** Where in the monorepo the analysis found this service — the evidence. */
  source: string;
  /** Why the project needs it, one line. */
  note: string;
}

export interface ProjectEnvironment {
  /** Compose project name — what container names hang off. */
  stack: string;
  /** Boot order: dependencies first, the app that needs them last. */
  services: EnvironmentService[];
}

/* ------------------------------------------------------------------ */
/* The services the analysis knows how to find                         */
/* ------------------------------------------------------------------ */

/**
 * Factories rather than literals per project: every monorepo names its
 * Postgres in the same schema file, so spelling that out six times is how one
 * project's evidence quietly drifts from the others'. App services are built
 * from the monorepo, so their image carries the stack's own tag.
 */
function postgres(): EnvironmentService {
  return {
    id: 'db',
    role: 'database',
    image: 'postgres:16-alpine',
    ports: ['5432:5432'],
    source: 'apps/api/prisma/schema.prisma',
    note: 'Postgres behind Prisma — the schema names it as the datasource.',
  };
}

function redis(note: string): EnvironmentService {
  return {
    id: 'cache',
    role: 'cache',
    image: 'redis:7-alpine',
    ports: ['6379:6379'],
    source: 'apps/api/src/queue/queue.module.ts',
    note,
  };
}

function minio(note: string): EnvironmentService {
  return {
    id: 'storage',
    role: 'storage',
    image: 'minio/minio:latest',
    ports: ['9000:9000', '9001:9001'],
    source: 'apps/api/src/documents/storage.ts',
    note,
  };
}

function api(stack: string): EnvironmentService {
  return {
    id: 'api',
    role: 'backend',
    image: `${stack}-api:dev`,
    ports: ['4000:4000'],
    source: 'apps/api/src/main.ts',
    note: 'The NestJS API every screen calls.',
  };
}

function worker(stack: string, note: string): EnvironmentService {
  return {
    id: 'worker',
    role: 'worker',
    image: `${stack}-worker:dev`,
    ports: [],
    source: 'apps/worker/src/main.ts',
    note,
  };
}

function web(stack: string): EnvironmentService {
  return {
    id: 'web',
    role: 'frontend',
    image: `${stack}-web:dev`,
    ports: ['3000:3000'],
    source: 'apps/web/next.config.ts',
    note: "The screens themselves — Next.js serves the round's builds.",
  };
}

/* ------------------------------------------------------------------ */
/* Per project: what the analysis found                                */
/* ------------------------------------------------------------------ */

/** `proj-eacc-cloud` → `eacc-cloud`, the compose project name. */
function stackName(projectId: string): string {
  return projectId.replace(/^proj-/, '');
}

/**
 * What each project's monorepo asks for, beyond the web/api/db every one of
 * them has. Keyed by the need the screens make visible: multi-tenant sessions
 * queue on Redis, a document checklist lands files in object storage, voucher
 * issuing drains through a worker.
 */
function extras(projectId: string, stack: string): EnvironmentService[] {
  switch (projectId) {
    case 'proj-eacc-cloud':
      return [redis('Sessions and the approval queue — multi-tenant, so state lives off-process.')];
    case 'proj-nonghyup-loan':
      return [minio('The document checklist uploads — identity papers land in object storage.')];
    case 'proj-voucher-issuing':
      return [
        redis('The issuing queue — vouchers are written as jobs, not in the request.'),
        worker(stack, 'Drains the issuing queue and writes the vouchers.'),
      ];
    default:
      return [];
  }
}

/**
 * The stack the Monitor runs: dependencies first, `web` last, because that is
 * the order they have to come up in.
 */
export function projectEnvironment(projectId: string): ProjectEnvironment {
  const stack = stackName(projectId);
  return {
    stack,
    services: [postgres(), ...extras(projectId, stack), api(stack), web(stack)],
  };
}

/** `eacc-cloud-web-1` — the name compose gives the running container. */
export function containerName(stack: string, service: EnvironmentService): string {
  return `${stack}-${service.id}-1`;
}

/* ------------------------------------------------------------------ */
/* Logs                                                                */
/* ------------------------------------------------------------------ */

export interface LogLine {
  /** Wall-clock ms the line was emitted at. */
  at: number;
  text: string;
  level: 'info' | 'warn';
}

/**
 * What a service prints as it comes up, as offsets from the moment it started.
 *
 * Each service speaks its own dialect, because that is the point of reading a
 * log: Postgres announcing it accepts connections and Next reporting a compile
 * are different facts, and a generic "service started" line would tell the
 * reader nothing they could not see from the status column. Ports come from the
 * service definition rather than being repeated here, so a port change cannot
 * leave the log claiming the old one.
 */
function bootLog(service: EnvironmentService): { atMs: number; text: string }[] {
  const port = service.ports[0]?.split(':')[1] ?? '';

  switch (service.role) {
    case 'database':
      return [
        { atMs: 0, text: `starting PostgreSQL, listening on 0.0.0.0:${port}` },
        { atMs: 320, text: 'database system was shut down cleanly; starting up' },
        { atMs: 780, text: 'checkpoint record found, redo is not required' },
        { atMs: 1100, text: 'database system is ready to accept connections' },
      ];
    case 'cache':
      return [
        { atMs: 0, text: `Redis starting, mode=standalone port=${port}` },
        { atMs: 240, text: 'no RDB file found, DB loaded from an empty dataset' },
        { atMs: 610, text: 'Ready to accept connections tcp' },
      ];
    case 'storage':
      return [
        { atMs: 0, text: 'MinIO Object Storage Server starting' },
        { atMs: 380, text: `API: http://0.0.0.0:${port}` },
        { atMs: 640, text: `Console: http://0.0.0.0:${service.ports[1]?.split(':')[1] ?? ''}` },
        { atMs: 900, text: 'bucket "documents" found, 0 objects pending scan' },
      ];
    case 'worker':
      return [
        { atMs: 0, text: 'worker starting' },
        { atMs: 460, text: 'connected to cache:6379' },
        { atMs: 880, text: 'listening on queue "issuing", concurrency 4' },
      ];
    case 'backend':
      return [
        { atMs: 0, text: 'Starting Nest application' },
        { atMs: 350, text: 'InstanceLoader — dependencies initialized' },
        { atMs: 720, text: 'PrismaService — connected to db:5432' },
        { atMs: 980, text: 'RoutesResolver — 34 routes mapped' },
        { atMs: 1240, text: `Nest application successfully started on port ${port}` },
      ];
    case 'frontend':
      return [
        { atMs: 0, text: `next dev — local http://localhost:${port}` },
        { atMs: 520, text: 'loading env from .env.local' },
        { atMs: 1150, text: 'ready in 1.1s' },
        { atMs: 1900, text: 'compiled / in 340ms' },
      ];
  }
}

/**
 * The line a service repeats while it is up, and how often.
 *
 * A log that stops after boot reads as a service that died. The interval is per
 * role because it is what the service actually has to say: a database
 * checkpoints on its own schedule, a web server only speaks when a request
 * arrives.
 */
function heartbeat(service: EnvironmentService): { everyMs: number; text: (n: number) => string } {
  switch (service.role) {
    case 'database':
      return {
        everyMs: 30_000,
        text: (n) => `checkpoint complete: wrote ${48 + n * 17} buffers`,
      };
    case 'cache':
      return { everyMs: 45_000, text: (n) => `DB saved on disk (${n + 1} changes)` };
    case 'storage':
      return { everyMs: 60_000, text: () => 'scanner: bucket "documents" ok' };
    case 'worker':
      return { everyMs: 20_000, text: () => 'queue empty — waiting' };
    case 'backend':
      return {
        everyMs: 12_000,
        text: (n) => `GET /api/expenses 200 — ${14 + ((n * 7) % 23)}ms`,
      };
    case 'frontend':
      return { everyMs: 15_000, text: (n) => `GET / 200 — ${28 + ((n * 11) % 40)}ms` };
  }
}

/** How many lines a panel keeps. Old enough to scroll back, not unbounded. */
const LOG_LIMIT = 200;

/**
 * The log a running service has produced by `now`.
 *
 * Derived from the start time rather than accumulated in state: the lines are a
 * function of how long the thing has been up, so there is nothing to keep in
 * sync and no buffer that survives a service the user stopped. A stopped
 * service has no log, which is the honest answer for a mock that is not
 * actually capturing output.
 */
export function serviceLog(service: EnvironmentService, startedAt: number, now: number): LogLine[] {
  const elapsed = Math.max(0, now - startedAt);
  const lines: LogLine[] = [];

  for (const entry of bootLog(service)) {
    if (entry.atMs > elapsed) break;
    lines.push({ at: startedAt + entry.atMs, text: entry.text, level: 'info' });
  }

  const beat = heartbeat(service);
  for (let n = 0; (n + 1) * beat.everyMs <= elapsed; n += 1) {
    lines.push({
      at: startedAt + (n + 1) * beat.everyMs,
      text: beat.text(n),
      level: 'info',
    });
  }

  return lines.slice(-LOG_LIMIT);
}

/** `14:32:07` — the clock a log line is stamped with. */
export function logStamp(at: number): string {
  return new Date(at).toTimeString().slice(0, 8);
}
