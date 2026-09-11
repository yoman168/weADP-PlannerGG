/**
 * What a folder's Claude Code terminal knows. Each chat is pinned to one
 * folder, so the context is that folder's slice of the project: the meeting
 * behind a concept folder, the consolidated package behind the design folder,
 * the captured screens behind real-screens.
 *
 * It reads the same workspace state the rest of Sketcher uses.
 */
import {
  loadUploadedFiles,
  mergeReferenceText,
  sessionFiles,
} from '@/lib/we-adk-mock/meeting-files';
import {
  DESIGN_FOLDER_ID,
  REAL_FOLDER_ID,
  type DesignFolder,
  type DesignProject,
} from '@/lib/we-adk-mock/projects';
import { BASELINE_VERSION } from '@/lib/we-adk-mock/versions';
import { loadDesignPackage } from '@/lib/we-adk/design-phase';

const MAX_CONTEXT_CHARS = 14_000;

function fileLines(folder: DesignFolder): string {
  if (folder.files.length === 0) return 'Design files in this folder: none yet.';
  return [
    'Design files in this folder:',
    ...folder.files.map((file) => {
      const revises = file.basedOnRoute ? ` — revises live ${file.basedOnRoute}` : '';
      return `- ${file.fileName} "${file.name}" (${file.route ?? 'no route'}, ${file.status.label})${revises}`;
    }),
  ].join('\n');
}

export function buildFolderChatContext(project: DesignProject, folder: DesignFolder): string {
  const parts: string[] = [
    `Project: ${project.name} — ${project.customer}. Owner ${project.owner}, stage ${project.stage}.`,
  ];

  if (folder.kind === 'concept' && folder.session) {
    const session = folder.session;
    parts.push(
      `Folder: ${folder.name}/ — the meeting "${session.title}" (${session.metAt}${session.kind ? `, ${session.kind}` : ''}).`,
      `Attendees: ${session.attendees}`,
      '',
      'Meeting notes:',
      session.notes,
    );
    if (session.decisions?.length) {
      parts.push('', 'Decided:', ...session.decisions.map((entry) => `- ${entry}`));
    }
    if (session.openQuestions?.length) {
      parts.push('', 'Still open:', ...session.openQuestions.map((entry) => `- ${entry}`));
    }
    parts.push('', fileLines(folder));

    const merged = mergeReferenceText(
      sessionFiles(session.id, loadUploadedFiles(session.id)),
      6_000,
    );
    if (merged.text) parts.push('', 'Reference files:', merged.text);
  } else if (folder.id === DESIGN_FOLDER_ID) {
    parts.push(
      `Folder: ${folder.name}/ — the consolidated design set, produced from every meeting.`,
      '',
      fileLines(folder),
    );
    const pkg = loadDesignPackage(project.id);
    if (pkg) {
      parts.push('', `Consolidation summary (${pkg.generatedAt}):`, pkg.summary);
      if (pkg.conflicts?.length) {
        parts.push('', 'Unsettled conflicts:', ...pkg.conflicts.map((entry) => `- ${entry.issue}`));
      }
      if (pkg.risks?.length) {
        parts.push('', 'Designed on assumptions:', ...pkg.risks.map((entry) => `- ${entry}`));
      }
    }
  } else if (folder.kind === 'version') {
    const baseline = folder.versionNumber === BASELINE_VERSION;
    parts.push(
      `Folder: ${folder.name}/ — ${folder.label}.`,
      baseline
        ? 'This is the read-only baseline: every concept design the customer meetings produced. Later versions are the rounds of change on top of it.'
        : 'This is a round of change on top of the baseline in version 1.',
      ...(folder.versionStatus
        ? [
            folder.versionStatus === 'Released'
              ? 'This round is released — it is what the product is now.'
              : 'This round is in progress — it has not shipped yet.',
          ]
        : []),
      '',
      fileLines(folder),
    );
    if (baseline) {
      const ordered = [...project.sessions].sort((a, b) => a.metAt.localeCompare(b.metAt));
      for (const session of ordered) {
        parts.push(
          '',
          `Meeting "${session.title}" (${session.metAt}${session.kind ? `, ${session.kind}` : ''}):`,
          session.notes,
        );
        if (session.decisions?.length) {
          parts.push('Decided:', ...session.decisions.map((entry) => `- ${entry}`));
        }
        if (session.openQuestions?.length) {
          parts.push('Still open:', ...session.openQuestions.map((entry) => `- ${entry}`));
        }
      }
    }
  } else if (folder.id === REAL_FOLDER_ID) {
    parts.push(
      `Folder: ${folder.name}/ — screens captured from the live product${project.solution ? ` (${project.solution})` : ''}.`,
      'These show what exists in production today; concept work revises copies of them.',
      '',
      fileLines(folder),
    );
  } else {
    parts.push(`Folder: ${folder.name}/ — ${folder.label}.`, '', fileLines(folder));
  }

  return parts.join('\n').slice(0, MAX_CONTEXT_CHARS);
}
