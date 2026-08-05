/**
 * Discovery → design.
 *
 * A project collects meetings: notes, decisions, open questions, reference
 * files, and a pile of concept sketches drawn one meeting at a time. Those
 * sketches overlap and contradict each other, because each was drawn from a
 * single conversation.
 *
 * The design phase is where that becomes one thing. This module assembles
 * everything the project knows into a single context block, and holds the
 * consolidated package Claude returns: one canonical screen set, the decisions
 * that constrain it, and the contradictions a human has to settle.
 */
import { z } from 'zod';
import { mergeReferenceText, type MeetingFile } from '@/lib/we-adk-mock/meeting-files';
import { type DesignFolder, type DesignProject } from '@/lib/we-adk-mock/projects';
import { generatedScreenSchema, type GeneratedScreen } from './sketcher-operations';

/* ------------------------------------------------------------------ */
/* The context that goes in                                            */
/* ------------------------------------------------------------------ */

export interface DesignContextInput {
  project: DesignProject;
  /** Concept folders, one per meeting, with their design files. */
  conceptFolders: DesignFolder[];
  /** Reference files per meeting id, already merged with anything uploaded. */
  filesBySession: Record<string, MeetingFile[]>;
  /** Block kinds per design file id, so the model sees what was actually drawn. */
  blocksByFile: Record<string, string[]>;
  /**
   * Versions added in the Business phase after the baseline. These are drawn on
   * top of every meeting rather than out of one, so they come after the
   * meeting-by-meeting walk.
   */
  versionFolders?: DesignFolder[];
}

export interface DesignContext {
  text: string;
  meetings: number;
  sketches: number;
  referenceFiles: number;
  decisions: number;
  openQuestions: number;
  chars: number;
}

/**
 * Every meeting in order, each with what was said, settled, left open, handed
 * over and drawn. This is the whole project in one block of text.
 */
export function buildDesignContext(input: DesignContextInput): DesignContext {
  const { project, conceptFolders, filesBySession, blocksByFile, versionFolders = [] } = input;
  const parts: string[] = [];

  let sketches = 0;
  let referenceFiles = 0;
  let decisions = 0;
  let openQuestions = 0;

  const ordered = [...project.sessions].sort((a, b) => a.metAt.localeCompare(b.metAt));

  for (const [index, session] of ordered.entries()) {
    const folder = conceptFolders.find((entry) => entry.id === session.id);
    const files = filesBySession[session.id] ?? [];
    const merged = mergeReferenceText(files, 4000);

    decisions += session.decisions?.length ?? 0;
    openQuestions += session.openQuestions?.length ?? 0;
    referenceFiles += files.length;
    sketches += folder?.files.length ?? 0;

    parts.push(
      [
        `### MEETING ${index + 1}: ${session.title} (${session.metAt}${session.kind ? `, ${session.kind}` : ''})`,
        `Attendees: ${session.attendees}`,
        '',
        'Notes:',
        session.notes,
        session.decisions?.length
          ? `\nDecided:\n${session.decisions.map((entry) => `- ${entry}`).join('\n')}`
          : '',
        session.openQuestions?.length
          ? `\nStill open:\n${session.openQuestions.map((entry) => `- ${entry}`).join('\n')}`
          : '',
        folder && folder.files.length > 0
          ? `\nScreens sketched from this meeting:\n${folder.files
              .map((file) => {
                const blocks = blocksByFile[file.id] ?? [];
                const detail = blocks.length > 0 ? ` [${blocks.join(', ')}]` : '';
                const revises = file.basedOnRoute ? ` — revises live ${file.basedOnRoute}` : '';
                return `- "${file.name}" (${file.route ?? 'no route'}, ${file.status.label})${revises}${detail}`;
              })
              .join('\n')}`
          : '\nScreens sketched from this meeting: none',
        merged.text ? `\nReference files:\n${merged.text}` : '',
      ]
        .filter((line) => line !== '')
        .join('\n'),
    );
  }

  for (const folder of versionFolders) {
    if (folder.files.length === 0) continue;
    sketches += folder.files.length;
    parts.push(
      [
        `### ${folder.name.toUpperCase()} (${folder.label})`,
        'Drawn after the meetings, on top of the baseline:',
        ...folder.files.map((file) => {
          const blocks = blocksByFile[file.id] ?? [];
          const detail = blocks.length > 0 ? ` [${blocks.join(', ')}]` : '';
          const revises = file.basedOnRoute ? ` — revises live ${file.basedOnRoute}` : '';
          return `- "${file.name}" (${file.route ?? 'no route'}, ${file.status.label})${revises}${detail}`;
        }),
      ].join('\n'),
    );
  }

  const header = [
    `PROJECT: ${project.name} — ${project.customer}`,
    `Owner: ${project.owner}. Current stage: ${project.stage}.`,
    project.solution
      ? `Live product behind this project: ${project.solution}. Some sketches revise real screens.`
      : 'Nothing is live yet — every sketch is greenfield.',
    `Summary: ${project.summary}`,
  ].join('\n');

  const text = [header, '', ...parts].join('\n\n');

  return {
    text,
    meetings: ordered.length,
    sketches,
    referenceFiles,
    decisions,
    openQuestions,
    chars: text.length,
  };
}

/* ------------------------------------------------------------------ */
/* The package that comes back                                         */
/* ------------------------------------------------------------------ */

export const consolidatedScreenSchema = generatedScreenSchema.extend({
  /** Names of the meeting sketches this screen replaces. */
  sources: z.array(z.string().max(160)).max(12).optional(),
  /** Decisions from the meetings that this screen has to honour. */
  constraints: z.array(z.string().max(300)).max(8).optional(),
});

export type ConsolidatedScreen = z.infer<typeof consolidatedScreenSchema>;

export const designPackageSchema = z.object({
  summary: z.string().min(1).max(2000),
  screens: z.array(consolidatedScreenSchema).max(20),
  /** Places where two meetings asked for different things. */
  conflicts: z
    .array(
      z.object({
        issue: z.string().max(400),
        meetings: z.array(z.string().max(160)).max(6).optional(),
        recommendation: z.string().max(400).optional(),
      }),
    )
    .max(12)
    .optional(),
  /** What is still unanswered and therefore risky to design against. */
  risks: z.array(z.string().max(400)).max(12).optional(),
  /** Sketches that the consolidation drops, with a reason. */
  dropped: z
    .array(z.object({ name: z.string().max(160), reason: z.string().max(300) }))
    .max(20)
    .optional(),
});

export type DesignPackage = z.infer<typeof designPackageSchema>;

export interface StoredDesignPackage extends DesignPackage {
  generatedAt: string;
  /** Counts of what went in, so a stale package is obvious. */
  inputs: { meetings: number; sketches: number; referenceFiles: number };
}

export function parseDesignPackage(input: unknown): DesignPackage | null {
  const parsed = designPackageSchema.safeParse(input);
  if (!parsed.success || parsed.data.screens.length === 0) return null;
  return parsed.data;
}

/* ------------------------------------------------------------------ */
/* Persistence (browser-only, like the rest of the mockup)             */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'we-adk:design-phase';

function storeKey(projectId: string): string {
  return `${STORAGE_KEY}:${projectId}`;
}

export function loadDesignPackage(projectId: string): StoredDesignPackage | null {
  try {
    const raw = window.localStorage.getItem(storeKey(projectId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const pkg = designPackageSchema.safeParse(parsed);
    if (!pkg.success) return null;
    const meta = parsed as { generatedAt?: unknown; inputs?: unknown };
    return {
      ...pkg.data,
      generatedAt: typeof meta.generatedAt === 'string' ? meta.generatedAt : 'unknown',
      inputs:
        typeof meta.inputs === 'object' && meta.inputs !== null
          ? (meta.inputs as StoredDesignPackage['inputs'])
          : { meetings: 0, sketches: 0, referenceFiles: 0 },
    };
  } catch {
    return null;
  }
}

export function saveDesignPackage(projectId: string, pkg: StoredDesignPackage): void {
  try {
    window.localStorage.setItem(storeKey(projectId), JSON.stringify(pkg));
  } catch {
    // Storage unavailable — the package just won't survive a reload.
  }
}

export function clearDesignPackage(projectId: string): void {
  try {
    window.localStorage.removeItem(storeKey(projectId));
  } catch {
    // ignore
  }
}

/** A project is ready for design once the conversation has actually happened. */
export const DESIGN_READY_MEETINGS = 2;

export function designReadiness(context: Pick<DesignContext, 'meetings' | 'sketches'>): {
  ready: boolean;
  reason: string;
} {
  if (context.meetings < DESIGN_READY_MEETINGS) {
    return {
      ready: false,
      reason: `Only ${context.meetings} meeting${context.meetings === 1 ? '' : 's'} so far — consolidating this early just repeats one conversation.`,
    };
  }
  if (context.sketches === 0) {
    return {
      ready: false,
      reason: 'No concept screens sketched yet — generate some from the meeting notes first.',
    };
  }
  return {
    ready: true,
    reason: `${context.meetings} meetings and ${context.sketches} concept screens to consolidate.`,
  };
}

export type { GeneratedScreen };
