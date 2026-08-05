'use client';

/**
 * The Development view's workspace — the round's files, running for real.
 *
 * Where the old editor shell showed the HTML a design exports to, this shows
 * the screen itself: each file in the round renders through the same live
 * preview surface the Preview tab uses, so a developer reading Claude's answer
 * sees the actual running page — the real `/eacc/…` route where one exists,
 * the design in the app's frame where one doesn't.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileCode2 } from 'lucide-react';
import { Badge, cn } from '@/components/ui';
import { previewHref } from '@/components/we-adk/mockup-board';
import {
  DeviceSwitcher,
  ScreenPreviewSurface,
} from '@/components/we-adk/screen-preview';
import { type DevicePresetId } from '@/lib/we-adk-mock/sketcher';
import { designHtmlFileName } from '@/lib/we-adk/design-html';

export interface WorkspaceFile {
  id: string;
  name: string;
  route?: string;
}

export function LiveWorkspace({
  files,
  projectId,
  emptyHint,
  children,
}: {
  files: WorkspaceFile[];
  projectId: string;
  /** Shown when the round has no files to run. */
  emptyHint: string;
  /** The right dock — Claude Code. */
  children: React.ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [device, setDevice] = useState<DevicePresetId>('full');

  // Landing on the first file beats an empty pane, which reads as broken.
  useEffect(() => {
    if (activeId === null && files[0]) setActiveId(files[0].id);
  }, [files, activeId]);

  const active = files.find((file) => file.id === activeId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* The round's files */}
      <aside className="bg-background flex w-56 shrink-0 flex-col border-r">
        <p className="text-muted-foreground shrink-0 px-4 py-2 text-[11px] font-semibold tracking-wider uppercase">
          Round designs
        </p>
        <ul className="min-h-0 flex-1 overflow-y-auto pb-2">
          {files.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                onClick={() => setActiveId(file.id)}
                title={file.route ?? file.name}
                aria-pressed={file.id === activeId}
                className={cn(
                  'flex w-full items-center gap-1.5 px-4 py-1 text-left text-[13px]',
                  file.id === activeId
                    ? 'bg-primary/10 text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}
              >
                <FileCode2 className="size-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
                <span className="min-w-0 flex-1 truncate">{designHtmlFileName(file.name)}</span>
              </button>
            </li>
          ))}
          {files.length === 0 && (
            <li className="text-muted-foreground px-4 py-2 text-[11px]">no files</li>
          )}
        </ul>
      </aside>

      {/* The screen, running */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#f4f5f7] dark:bg-[#0b0e14]">
        {active && (
          <header className="bg-background flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
            <span className="truncate text-sm font-medium">{active.name}</span>
            {active.route && (
              <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                {active.route}
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-2">
              <DeviceSwitcher device={device} onChange={setDevice} />
              <Link
                href={previewHref(active.id, projectId)}
                target="_blank"
                title="Open in its own tab"
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
              >
                <ExternalLink className="size-3.5" />
                Open
              </Link>
            </div>
          </header>
        )}

        <main
          className={cn(
            'flex min-h-0 flex-1 justify-center overflow-y-auto',
            device === 'full' ? 'p-0' : 'p-5',
          )}
        >
          {active === null ? (
            <p className="text-muted-foreground px-6 py-10 text-sm">{emptyHint}</p>
          ) : (
            <ScreenPreviewSurface
              // Remount per file so one screen's scroll and edit state does not
              // leak into the next.
              key={active.id}
              screenId={active.id}
              seedPattern="listPage"
              route={active.route}
              device={device}
              mode="live"
              className={device === 'full' ? 'rounded-none border-0 shadow-none' : undefined}
            />
          )}
        </main>
      </div>

      {/* Claude Code dock */}
      <aside className="bg-background flex w-[30rem] shrink-0 flex-col border-l max-xl:w-80">
        {children}
      </aside>
    </div>
  );
}
