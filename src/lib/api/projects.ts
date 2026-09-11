/**
 * Projects, from the API.
 *
 * The workspace currently reads projects from `@/lib/we-adk-mock/projects` and
 * `created-projects`, which keeps them in `localStorage`. These are the calls that replace
 * that, shape for shape, so a screen can be moved across one at a time rather than in one
 * commit: `DesignProject` is what the UI renders, and `toDesignProject` maps an API row
 * onto it.
 *
 * The fields the mock derives rather than stores — `sessions`, `stage` for a new project —
 * are derived here too, from the same rules, so a project that came from the API and one
 * that came from the mock render identically.
 */
import type { Chip, ChipTone } from '@/lib/we-adk-mock/types';
import type { DesignProject, ProjectAccent, ProjectStage } from '@/lib/we-adk-mock/projects';
import { PROJECT_STAGES } from '@/lib/we-adk-mock/projects';
import { api, unwrap, type Schema } from './client';

export type ProjectView = Schema<'ProjectView'>;
export type ProjectCreate = Schema<'ProjectCreate'>;
export type ProjectUpdate = Schema<'ProjectUpdate'>;

const ACCENTS: ProjectAccent[] = ['indigo', 'violet', 'green', 'teal', 'amber', 'slate'];
const TONES: ChipTone[] = ['neutral', 'blue', 'amber', 'green', 'red', 'slate', 'violet'];

/** A stored value from an older build must not arrive as a stage that no longer exists. */
function stageOf(value: string | undefined): ProjectStage {
  const found = PROJECT_STAGES.find((stage) => stage === value);
  return found ?? 'Project Brief';
}

function chipOf(view: ProjectView): Chip {
  const tone = TONES.find((candidate) => candidate === view.statusTone);
  return { label: view.statusLabel ?? 'In progress', tone: tone ?? 'blue' };
}

function accentOf(view: ProjectView): ProjectAccent {
  const named = ACCENTS.find((candidate) => candidate === view.accent);
  if (named) return named;
  // Derived from the name rather than random, so it is stable across a reload and two
  // people looking at the same project see the same tile.
  let sum = 0;
  for (const char of view.name ?? '') sum += char.codePointAt(0) ?? 0;
  return ACCENTS[sum % ACCENTS.length] ?? 'indigo';
}

/** An API row as the workspace's own project shape. */
export function toDesignProject(view: ProjectView): DesignProject {
  return {
    id: view.id ?? '',
    name: view.name ?? '',
    customer: view.customer ?? '',
    owner: view.owner ?? '',
    summary: view.summary ?? '',
    status: chipOf(view),
    stage: stageOf(view.stage),
    accent: accentOf(view),
    updatedAt: (view.updatedAt ?? '').slice(0, 10),
    spend: typeof view.spend === 'number' ? view.spend : 0,
    archived: view.archived === true,
    ...(view.solution ? { solution: view.solution as DesignProject['solution'] } : {}),
    // Meetings are a separate resource; a caller that needs them fetches them.
    sessions: [],
  };
}

export async function listProjects(archived?: boolean): Promise<DesignProject[]> {
  const rows = await unwrap(
    api.GET('/api/projects', {
      params: { query: archived === undefined ? {} : { archived } },
    }),
  );
  return (rows ?? []).map(toDesignProject);
}

export async function getProject(id: string): Promise<DesignProject> {
  return toDesignProject(await unwrap(api.GET('/api/projects/{id}', { params: { path: { id } } })));
}

export async function createProject(body: ProjectCreate): Promise<DesignProject> {
  return toDesignProject(await unwrap(api.POST('/api/projects', { body })));
}

export async function updateProject(id: string, body: ProjectUpdate): Promise<DesignProject> {
  return toDesignProject(
    await unwrap(api.PATCH('/api/projects/{id}', { params: { path: { id } }, body })),
  );
}

export async function deleteProject(id: string): Promise<void> {
  await unwrap(api.DELETE('/api/projects/{id}', { params: { path: { id } } }));
}

/** Archiving is a field, not a route: an archived project is a Customer project. */
export async function setArchived(id: string, archived: boolean): Promise<DesignProject> {
  return updateProject(id, { archived });
}
