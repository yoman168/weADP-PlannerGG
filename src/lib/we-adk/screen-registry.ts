/**
 * One place to resolve a screen id, whichever tool owns it. The canvas editor
 * is shared, so it needs to answer "what am I editing?" for Builder work
 * mockups, design files inside a Sketcher project, and AI-generated screens
 * alike.
 */
import { findMockupScreen } from '@/lib/we-adk-mock/builder';
import { findProductionScreen } from '@/lib/we-adk-mock/production-screens';
import {
  findCreatedScreen,
  findProjectScreen,
  projectForSolution,
} from '@/lib/we-adk-mock/projects';
import { type SeedPattern } from '@/lib/we-adk-mock/sketches';
import { designHtmlFileName } from './design-html';
import { BASELINE_VERSION, findVersionScreen, versionFolderId } from '@/lib/we-adk-mock/versions';
import { PROTOTYPE_PROJECT_ID, findPrototypeFile, readPrototypeId } from './prototype';

/** Business lists design files by version, so that is where a breadcrumb goes. */
function versionHref(projectId: string, version: number): string {
  return `/we-adk/projects/${projectId}/sketcher?folder=${versionFolderId(version)}`;
}

/**
 * Where a concept design can actually be found.
 *
 * The eACC project's baseline is the html prototype, so its meeting designs are
 * not in the version tree — they are on the board, next to the notes that
 * produced them. Pointing a breadcrumb at version 1 would send someone to a
 * folder that no longer holds the file.
 */
function conceptHref(projectId: string, version: number): string {
  return projectId === PROTOTYPE_PROJECT_ID
    ? `/we-adk/projects/${projectId}/sketcher/board`
    : versionHref(projectId, version);
}

export interface ResolvedScreen {
  id: string;
  name: string;
  /**
   * The file's name in the tree, for anything that lives in a version folder.
   * Set means "this is an html file" — the baseline's pages and a round's own
   * designs alike. Absent for a Builder mockup or a captured screen.
   */
  fileName?: string;
  route?: string;
  seedPattern: string;
  /** Where this screen lives, for the editor breadcrumb. */
  parentLabel: string;
  parentHref: string;
  origin: 'builder' | 'sketch' | 'generated' | 'production' | 'prototype';
}

/**
 * Files the user created are workspace state, held in the API.
 *
 * `projectId` is the project the editor was opened from. Sketcher and real
 * screens know their own project from the data; Builder work mockups are shared
 * sample data, so they rely on this to find their way back.
 */
export function resolveScreen(screenId: string, projectId?: string): ResolvedScreen | null {
  // An html file of the eACC prototype — the baseline of that project, or a
  // later round's copy of one.
  const prototype = findPrototypeFile(screenId);
  if (prototype) {
    // The id has to stay the one that was asked for. `proto-login@v2` is the
    // round's own copy, with its own canvas under its own key; answering with
    // the baseline id would point every round's editor at the baseline's canvas
    // — so a change made in a round would land on the read-only version 1.
    const round = readPrototypeId(screenId).version ?? BASELINE_VERSION;
    return {
      id: screenId,
      name: prototype.name,
      fileName: prototype.fileName,
      route: prototype.route,
      seedPattern: 'listPage',
      parentLabel: `eACC Cloud · version ${round} · ${prototype.fileName}`,
      parentHref: versionHref(PROTOTYPE_PROJECT_ID, round),
      origin: 'prototype',
    };
  }

  const sketch = findProjectScreen(screenId);
  if (sketch) {
    return {
      id: sketch.screen.id,
      name: sketch.screen.name,
      route: sketch.screen.route,
      seedPattern: sketch.screen.seedPattern,
      parentLabel: `${sketch.project.name} · ${sketch.session.title}`,
      parentHref: conceptHref(sketch.project.id, BASELINE_VERSION),
      origin: 'sketch',
    };
  }

  const production = findProductionScreen(screenId);
  if (production) {
    const owner = projectForSolution(production.solution);
    return {
      id: production.id,
      name: production.path,
      route: production.route,
      seedPattern: production.seedPattern,
      parentLabel: owner ? `${owner.name} · real screens` : `Production · ${production.solution}`,
      parentHref: owner ? `/we-adk/projects/${owner.id}/sketcher/research` : '/we-adk/production',
      origin: 'production',
    };
  }

  const mockup = findMockupScreen(screenId);
  if (mockup) {
    return {
      id: mockup.screen.id,
      name: mockup.screen.name,
      route: mockup.screen.route,
      seedPattern: mockup.screen.seedPattern,
      parentLabel: mockup.mockup.title,
      parentHref: projectId
        ? `/we-adk/projects/${projectId}/builder/${mockup.mockup.id}`
        : '/we-adk',
      origin: 'builder',
    };
  }

  if (typeof window !== 'undefined') {
    const created = findCreatedScreen(screenId);
    if (created) {
      return {
        id: created.screen.id,
        name: created.screen.name,
        route: created.screen.route,
        seedPattern: created.screen.seedPattern as SeedPattern,
        parentLabel: `${created.project.name} · ${created.session.title}`,
        parentHref: conceptHref(created.project.id, BASELINE_VERSION),
        origin: 'generated',
      };
    }

    // Anything drawn after the baseline belongs to the version it was made in.
    const versioned = findVersionScreen(screenId);
    if (versioned) {
      return {
        id: versioned.screen.id,
        name: versioned.screen.name,
        // A round names its own designs the way the baseline's are named.
        fileName: designHtmlFileName(versioned.screen.name),
        route: versioned.screen.route,
        seedPattern: versioned.screen.seedPattern,
        parentLabel: `${versioned.project.name} · version ${versioned.version}`,
        parentHref: versionHref(versioned.project.id, versioned.version),
        origin: 'generated',
      };
    }
  }

  return null;
}
