/**
 * Projects you make yourself, alongside the seeded ones.
 *
 * The samples in `PROJECTS` are fixed: they carry meetings, captured screens and
 * a spend history, which is what makes them worth demonstrating. A project you
 * create has none of that and never will — it starts empty and fills up as you
 * work — so it is stored as the handful of fields a person actually supplies,
 * and everything constant about a new project is rebuilt on the way out.
 *
 * That is deliberate rather than lazy. A record that also stored `stage`,
 * `status` and `sessions` would let a value written by an older build come back
 * as a stage that no longer exists, and the crash would land in a card render
 * far from here. What isn't stored can't rot.
 *
 * Types only from `./projects` — that module reads this one, and a value import
 * either way round would close the loop at module-init time.
 */

import type { DesignProject, ProjectAccent, ProjectLinkKind } from './projects';
import { STORE_CHANGED_EVENT, workspaceStore } from '@/lib/api/workspace-store';

const KEY = 'we-adk:projects';

/**
 * Says the project list moved.
 *
 * The header's workspace counts are derived from this list but rendered outside the
 * page that edits it, so without this they would sit stale until the next navigation.
 */
function announceChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STORE_CHANGED_EVENT));
}

/** What a person types. Everything else about a new project is the same. */
export interface NewProjectFields {
  name: string;
  customer: string;
  /** What kind of business a customer is; unused on a product. */
  companyType?: string;
  owner: string;
  summary: string;
  /** The product a customer engagement is for — set once, at creation or first edit. */
  relatedProductId?: string;
  linkKind?: ProjectLinkKind;
  featureArea?: string;
}

/** What is kept on disk: the fields above, plus identity and a date. */
interface StoredProject extends NewProjectFields {
  id: string;
  accent: ProjectAccent;
  createdAt: string;
  archived?: boolean;
}

export const MAX_PROJECT_NAME = 60;

/** Listed rather than imported, to keep this module's import of `./projects` type-only. */
const ACCENTS: ProjectAccent[] = ['indigo', 'violet', 'green', 'teal', 'amber', 'slate'];

/**
 * Tile colour, from the name.
 *
 * Derived rather than random so it is stable across a reload, and so two people
 * creating the same project get the same tile.
 */
function accentFor(name: string): ProjectAccent {
  let sum = 0;
  for (const char of name) sum += char.codePointAt(0) ?? 0;
  // The list is non-empty and the index is in range, but `noUncheckedIndexedAccess`
  // does not know that, and the fallback costs nothing.
  return ACCENTS[sum % ACCENTS.length] ?? 'indigo';
}

/**
 * A readable id from the name — `Fleet portal` becomes `proj-fleet-portal`.
 *
 * The id ends up in URLs, in branch names and as the key for every piece of
 * mock state the project accumulates, so it is worth being legible. Names that
 * slug to nothing (Korean, punctuation) fall back to a counter, and a collision
 * takes a numeric suffix rather than merging into the existing project.
 */
function projectIdFor(name: string, taken: ReadonlySet<string>): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const base = `proj-${slug || 'project'}`;
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** The constant half of a created project, rebuilt every load. */
function inflate(entry: StoredProject): DesignProject {
  return {
    id: entry.id,
    name: entry.name,
    customer: entry.customer,
    companyType: entry.companyType,
    owner: entry.owner,
    summary: entry.summary,
    accent: entry.accent,
    updatedAt: entry.createdAt,
    archived: entry.archived === true,
    relatedProductId: entry.relatedProductId,
    linkKind: entry.linkKind,
    featureArea: entry.featureArea,
    // Blue, the tone this app uses for work that is under way.
    status: { label: 'New', tone: 'blue' },
    // The first thing a project needs is a brief, and nothing has been written
    // yet — so the pipeline starts at its start.
    stage: 'Project Brief',
    saved: false,
    spend: 0,
    // No meetings held, and no live product to capture screens from. Both fill
    // in through the app rather than being seeded here.
    sessions: [],
  };
}

function isStored(value: unknown): value is StoredProject {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<StoredProject>;
  return (
    typeof entry.id === 'string' &&
    entry.id !== '' &&
    typeof entry.name === 'string' &&
    entry.name !== ''
  );
}

function read(): StoredProject[] {
  try {
    const raw = workspaceStore.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStored).map((entry) => ({
      id: entry.id,
      name: entry.name.slice(0, MAX_PROJECT_NAME),
      // The optional half of the form. A blank is a blank, not a crash.
      customer: typeof entry.customer === 'string' ? entry.customer : '',
      companyType: typeof entry.companyType === 'string' ? entry.companyType : undefined,
      owner: typeof entry.owner === 'string' ? entry.owner : '',
      summary: typeof entry.summary === 'string' ? entry.summary : '',
      accent: ACCENTS.includes(entry.accent) ? entry.accent : accentFor(entry.name),
      createdAt: /^\d{4}-\d{2}-\d{2}$/.test(entry.createdAt) ? entry.createdAt : '2026-01-01',
      archived: entry.archived === true,
      relatedProductId:
        typeof entry.relatedProductId === 'string' ? entry.relatedProductId : undefined,
      linkKind:
        entry.linkKind === 'new-build' || entry.linkKind === 'feature-improvement'
          ? entry.linkKind
          : undefined,
      featureArea: typeof entry.featureArea === 'string' ? entry.featureArea : undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * The same object back for the same stored record.
 *
 * Not an optimisation — a correctness requirement. A seeded project is one
 * object in a module array, so `findProject` returns an identical reference
 * every time it is called, and the whole app is built on that: effects and memos
 * all over the workspace list `project` in their dependencies. Inflating a fresh
 * object per call makes every one of those fire on every render, and the six
 * `setState` calls in the Business explorer's effect turn that into an infinite
 * render loop.
 *
 * Keyed on the record's own JSON, so an edit still produces a new object and
 * those same effects still notice it.
 */
const identity = new Map<string, { raw: string; project: DesignProject }>();

function stable(entry: StoredProject): DesignProject {
  const raw = JSON.stringify(entry);
  const cached = identity.get(entry.id);
  if (cached && cached.raw === raw) return cached.project;
  const project = inflate(entry);
  identity.set(entry.id, { raw, project });
  return project;
}

/**
 * Every project someone has created here, newest last.
 *
 * Browser-only, like the rest of this mock layer: called during a server render
 * it answers "none", which is what keeps the first paint of a page matching the
 * markup the server sent.
 */
export function loadCreatedProjects(): DesignProject[] {
  if (typeof window === 'undefined') return [];
  return read().map(stable);
}

/**
 * Create one, and hand back the project it became.
 *
 * `taken` is the set of ids already in use — the seeded ones included, which is
 * why it is passed in rather than read here.
 */
export function createProject(
  fields: NewProjectFields,
  today: string,
  taken: ReadonlySet<string>,
): DesignProject {
  const name = fields.name.trim().slice(0, MAX_PROJECT_NAME);
  const stored = read();
  const entry: StoredProject = {
    id: projectIdFor(name, new Set([...taken, ...stored.map((p) => p.id)])),
    name,
    customer: fields.customer.trim(),
    companyType: fields.companyType?.trim() || undefined,
    owner: fields.owner.trim(),
    summary: fields.summary.trim(),
    accent: accentFor(name),
    createdAt: today,
    relatedProductId: fields.relatedProductId,
    linkKind: fields.linkKind,
    featureArea: fields.featureArea?.trim() || undefined,
  };
  try {
    workspaceStore.setItem(KEY, JSON.stringify([...stored, entry]));
  } catch {
    // Storage unavailable — the project works for this session and is gone on
    // reload. Better than refusing to create it.
  }
  announceChange();
  // Through the cache, so the object handed to the page that created it is the
  // same one every later lookup returns.
  return stable(entry);
}

/** Update a created project's editable fields. */
export function updateProject(projectId: string, fields: NewProjectFields): DesignProject | null {
  const stored = read();
  const index = stored.findIndex((entry) => entry.id === projectId);
  if (index === -1) return null;
  const entry = stored[index]!;
  const updated: StoredProject = {
    ...entry,
    name: fields.name.trim().slice(0, MAX_PROJECT_NAME),
    customer: fields.customer.trim(),
    companyType: fields.companyType?.trim() || undefined,
    owner: fields.owner.trim(),
    summary: fields.summary.trim(),
  };
  stored[index] = updated;
  try {
    workspaceStore.setItem(KEY, JSON.stringify(stored));
  } catch {
    /* */
  }
  announceChange();
  return stable(updated);
}

/** Delete a created project from storage. */
export function deleteProject(projectId: string): void {
  const stored = read().filter((entry) => entry.id !== projectId);
  try {
    workspaceStore.setItem(KEY, JSON.stringify(stored));
  } catch {
    /* */
  }
  identity.delete(projectId);
  announceChange();
}

/**
 * Link a customer project to the product it's for — set at creation, or here
 * when an older customer project predates having one.
 */
export function linkProjectToProduct(
  projectId: string,
  productId: string,
  kind: ProjectLinkKind,
  featureArea?: string,
): DesignProject | null {
  const stored = read();
  const index = stored.findIndex((entry) => entry.id === projectId);
  if (index === -1) return null;
  const entry = stored[index]!;
  const updated: StoredProject = {
    ...entry,
    relatedProductId: productId,
    linkKind: kind,
    featureArea: kind === 'feature-improvement' ? featureArea?.trim() || undefined : undefined,
  };
  stored[index] = updated;
  try {
    workspaceStore.setItem(KEY, JSON.stringify(stored));
  } catch {
    /* */
  }
  announceChange();
  return stable(updated);
}

/** Toggle the archived flag on a created project. */
export function toggleArchiveProject(projectId: string): DesignProject | null {
  const stored = read();
  const index = stored.findIndex((entry) => entry.id === projectId);
  if (index === -1) return null;
  const entry = stored[index]!;
  const updated: StoredProject = { ...entry, archived: !entry.archived };
  stored[index] = updated;
  try {
    workspaceStore.setItem(KEY, JSON.stringify(stored));
  } catch {
    /* */
  }
  announceChange();
  return stable(updated);
}
