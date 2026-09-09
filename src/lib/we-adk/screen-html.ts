/**
 * A screen's page, wherever it has to come from.
 *
 * The Page editor edits an HTML document, and a design file does not always
 * have one. Three cases, in order:
 *
 * 1. It was generated as a page — from a customer task, or by the chat beside
 *    the preview — and the page is stored. That page is the screen.
 * 2. It is one of the prototype's own html files, or a wireframe drawn in a
 *    round. Those are blocks, and `designToHtml` renders blocks as a document,
 *    so the blocks are materialised into a page the first time it is opened.
 * 3. It is neither and has no blocks either, in which case there is nothing to
 *    edit and the caller says so.
 *
 * Case 2 is the reason the Page tab can replace the canvas at all: without a
 * blocks-to-document renderer, every block-native file would have arrived at
 * the editor empty.
 */

import { designToHtml } from '@/lib/we-adk/design-html';
import { prototypeDesignBlocks } from '@/lib/we-adk/prototype-design';
import { isPrototypeFile } from '@/lib/we-adk/prototype';
import { loadScreenBlocks, type CanvasBlock } from '@/lib/we-adk-mock/sketcher';

function key(screenId: string): string {
  return `we-adk:design-html:${screenId}`;
}

/** The stored page for a screen, if one was ever generated or saved. */
export function loadScreenHtml(screenId: string): string | null {
  try {
    return window.localStorage.getItem(key(screenId));
  } catch {
    return null;
  }
}

/**
 * Saves a screen's page.
 *
 * Announced on `we-adk:html-updated`, which is what the preview surface listens
 * to — so an edit shows up next door without a reload. Deliberately does not
 * touch the screen's blocks: `htmlToBlocks` would parse this document back into
 * a single header and overwrite whatever the thumbnails and the IA board draw
 * from.
 */
export function saveScreenHtml(screenId: string, html: string): void {
  try {
    window.localStorage.setItem(key(screenId), html);
    window.dispatchEvent(new Event('we-adk:html-updated'));
  } catch {
    /* storage full — the edit stays on screen but is not kept */
  }
}

/** The blocks behind a screen, seeded the way the preview surface seeds them. */
export function screenBlocks(screenId: string, seedPattern?: string): CanvasBlock[] {
  return loadScreenBlocks(screenId, seedPattern ?? 'listPage', () =>
    isPrototypeFile(screenId) ? prototypeDesignBlocks(screenId) : null,
  );
}

/**
 * The page to open in the editor, rendering it from blocks if need be.
 *
 * Returns `null` only when the screen has neither a page nor a single visible
 * block — a file with nothing in it yet.
 */
export function resolveScreenHtml(input: {
  screenId: string;
  name: string;
  seedPattern?: string;
  route?: string;
  origin?: string;
}): string | null {
  const stored = loadScreenHtml(input.screenId);
  if (stored) return stored;

  const blocks = screenBlocks(input.screenId, input.seedPattern);
  if (blocks.filter((block) => !block.hidden).length === 0) return null;

  return designToHtml({
    name: input.name,
    blocks,
    route: input.route,
    origin: input.origin,
  });
}
