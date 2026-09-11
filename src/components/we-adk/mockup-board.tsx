'use client';

import { ExternalLink, Maximize2, PenLine, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, cn } from '@/components/ui';
import { BlockPreview } from '@/components/we-adk/sketcher/block-preview';
import { StatusChip } from '@/components/we-adk/status-chip';
import { type Chip } from '@/lib/we-adk-mock/types';
import { useLocale } from '@/lib/locale';
import { loadScreenBlocks, type CanvasBlock } from '@/lib/we-adk-mock/sketcher';
import { screenDisplayPath } from '@/lib/we-adk/prototype';

/** The design width every frame is authored at; frames scale down from this. */
const AUTHOR_WIDTH = 1024;

export const CANVAS_ROUTE = '/we-adk/canvas';

export const ZOOM_LEVELS = [
  { id: 'sm', label: '25%', frameWidth: 256, frameHeight: 420 },
  { id: 'md', label: '40%', frameWidth: 410, frameHeight: 620 },
  { id: 'lg', label: '60%', frameWidth: 614, frameHeight: 820 },
] as const;

export type ZoomId = (typeof ZOOM_LEVELS)[number]['id'];

/** Minimum a board needs to know about a screen, whatever tool owns it. */
export interface BoardScreen {
  id: string;
  name: string;
  route?: string;
  seedPattern: string;
  status: Chip;
  updatedAt: string;
  /** Rendered as a variant badge, for alternatives of the same idea. */
  variantOfName?: string;
  /** Production route this screen was copied from. */
  basedOnRoute?: string;
  /** Shows a group label above the frame (e.g. which meeting it came from). */
  groupLabel?: string;
  generated?: boolean;
}

/** Canvas URL for one screen, carrying the project so the editor can get back. */
export function canvasHref(screenId: string, projectId?: string): string {
  return projectId
    ? `${CANVAS_ROUTE}?screen=${screenId}&project=${projectId}`
    : `${CANVAS_ROUTE}?screen=${screenId}`;
}

/**
 * Standalone preview of one design, outside the app shell — the URL to open in
 * a new tab or hand to someone who only needs to look at the screen.
 */
export function previewHref(screenId: string, projectId?: string): string {
  // The id goes in the path, so it has to be escaped: a round's copy of an html
  // file carries `@v2`, and an unescaped `@` comes back out of the router as
  // `%40` — a different id, which resolves to no screen at all.
  const path = `/preview/${encodeURIComponent(screenId)}`;
  return projectId ? `${path}?project=${projectId}` : path;
}

/**
 * A project's design file opens inside the Business workspace, so the project
 * nav and the explorer stay where they are. `folderId` keeps the tree selection.
 */
/**
 * A design file opened for editing — the page it is, not the canvas it used to
 * be built from. Named for what the pane does rather than for the surface,
 * since the surface has now changed once.
 */
export function businessEditHref(
  projectId: string,
  screenId: string,
  folderId?: string | null,
): string {
  const folder = folderId ? `&folder=${folderId}` : '';
  return `/we-adk/projects/${projectId}/sketcher/edit?screen=${screenId}${folder}`;
}

/**
 * Preview of a design file in the pane next to the explorer — the same swap the
 * canvas does, for looking at a screen rather than editing it.
 */
export function businessPreviewHref(
  projectId: string,
  screenId: string,
  folderId?: string | null,
): string {
  const folder = folderId ? `&folder=${folderId}` : '';
  return `/we-adk/projects/${projectId}/sketcher/preview?screen=${screenId}${folder}`;
}

function Frame({
  screen,
  blocks,
  frameWidth,
  frameHeight,
  projectId,
  hrefFor,
  onDelete,
}: {
  screen: BoardScreen;
  blocks: CanvasBlock[] | null;
  frameWidth: number;
  frameHeight: number;
  projectId?: string;
  hrefFor?: (screenId: string) => string;
  onDelete?: (screen: BoardScreen) => void;
}) {
  const { t } = useLocale();
  const scale = frameWidth / AUTHOR_WIDTH;
  const visible = (blocks ?? []).filter((block) => !block.hidden);
  const href = hrefFor ? hrefFor(screen.id) : canvasHref(screen.id, projectId);

  return (
    <div className="group flex shrink-0 flex-col gap-1.5" style={{ width: frameWidth }}>
      <div className="flex items-center gap-1.5">
        <Link href={href} className="truncate text-xs font-medium hover:underline">
          {screen.name}
        </Link>
        <StatusChip {...screen.status} className="shrink-0" />
        {screen.variantOfName && (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {t('board.variant')}
          </Badge>
        )}
        <span className="text-muted-foreground ml-auto shrink-0 font-mono text-[10px]">
          {visible.length} {t('board.blocks')}
        </span>
        <a
          href={previewHref(screen.id, projectId)}
          target="_blank"
          rel="noreferrer"
          title={`Preview ${screen.name} in a new browser tab`}
          aria-label={`Preview ${screen.name} in a new browser tab`}
          className="text-muted-foreground hover:text-foreground shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <ExternalLink className="size-3" />
        </a>
        {onDelete && (
          <button
            type="button"
            aria-label={`Delete ${screen.name}`}
            onClick={() => onDelete(screen)}
            className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>

      <Link
        href={href}
        title={`Open ${screen.name} in the canvas editor`}
        className="group-hover:border-primary/60 group-hover:ring-primary/20 relative block overflow-hidden rounded-lg border bg-background shadow-sm transition-all group-hover:ring-2"
        style={{ height: frameHeight }}
      >
        {blocks === null ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
            {t('board.loading')}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
            {t('board.emptyScreen')}
          </div>
        ) : (
          <div
            className="pointer-events-none flex flex-col gap-3 p-5"
            style={{
              width: AUTHOR_WIDTH,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {visible.map((block) => (
              <BlockPreview key={block.id} block={block} />
            ))}
          </div>
        )}

        <span className="bg-foreground text-background absolute bottom-2 right-2 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-100">
          <PenLine className="size-3" />
          {t('board.openCanvas')}
        </span>
      </Link>

      <p className="text-muted-foreground truncate text-[10px]">
        {screen.basedOnRoute
          ? `${t('board.fromProduction')}${screenDisplayPath(screen.id, screen.basedOnRoute) || screen.basedOnRoute}`
          : screen.variantOfName
            ? `${t('board.variantOf')}${screen.variantOfName}`
            : (screenDisplayPath(screen.id, screen.route) || screen.route || '—')}
      </p>
    </div>
  );
}

export function ZoomControl({
  zoom,
  onChange,
}: {
  zoom: ZoomId;
  onChange: (zoom: ZoomId) => void;
}) {
  return (
    <div className="bg-muted flex rounded-md p-0.5">
      {ZOOM_LEVELS.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onChange(entry.id)}
          aria-pressed={zoom === entry.id}
          aria-label={`Zoom ${entry.label}`}
          className={cn(
            'rounded px-2 py-1 text-[11px]',
            zoom === entry.id ? 'bg-background shadow-xs' : 'text-muted-foreground',
          )}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Figma-style board of screen frames. Each frame renders that screen's real
 * saved canvas, so edits made in the editor show up here.
 */
export function MockupBoard({
  screens,
  zoom,
  emptyMessage,
  projectId,
  hrefFor,
  onDelete,
  footnote,
}: {
  screens: BoardScreen[];
  zoom: ZoomId;
  emptyMessage?: string;
  /** Project the board belongs to — carried into the canvas breadcrumb. */
  projectId?: string;
  /** Where a frame opens. Defaults to the full-screen canvas. */
  hrefFor?: (screenId: string) => string;
  onDelete?: (screen: BoardScreen) => void;
  footnote?: string;
}) {
  const { t } = useLocale();
  const [blocksByScreen, setBlocksByScreen] = useState<Record<string, CanvasBlock[]> | null>(null);

  // the store is filled before first render, but a canvas is still read in an effect so the SSR markup stays stable.
  const signature = screens.map((screen) => screen.id).join(',');
  useEffect(() => {
    const loaded: Record<string, CanvasBlock[]> = {};
    for (const screen of screens) {
      loaded[screen.id] = loadScreenBlocks(screen.id, screen.seedPattern);
    }
    setBlocksByScreen(loaded);
    // Reload only when the set of screens changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const level = ZOOM_LEVELS.find((entry) => entry.id === zoom) ?? ZOOM_LEVELS[1];

  // Group frames when the caller supplies group labels (e.g. per meeting).
  const groups = screens.reduce<{ label: string | undefined; items: BoardScreen[] }[]>(
    (acc, screen) => {
      const last = acc.at(-1);
      if (last && last.label === screen.groupLabel) last.items.push(screen);
      else acc.push({ label: screen.groupLabel, items: [screen] });
      return acc;
    },
    [],
  );

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#f4f5f7] p-8 dark:bg-[#0b0e14]">
      {screens.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          {emptyMessage ?? t('board.noScreens')}
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group, index) => (
            <div key={`${group.label ?? 'ungrouped'}-${index}`} className="flex flex-col gap-3">
              {group.label && (
                <p className="text-muted-foreground text-xs font-medium">{group.label}</p>
              )}
              <div className="flex flex-wrap items-start gap-8">
                {group.items.map((screen) => (
                  <Frame
                    key={screen.id}
                    screen={screen}
                    blocks={blocksByScreen?.[screen.id] ?? null}
                    frameWidth={level.frameWidth}
                    frameHeight={level.frameHeight}
                    projectId={projectId}
                    hrefFor={hrefFor}
                    onDelete={screen.generated ? onDelete : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-muted-foreground mt-8 flex items-center gap-1.5 text-[10px]">
        <Maximize2 className="size-3" />
        {footnote ?? t('board.footnote')}
      </p>
    </div>
  );
}
