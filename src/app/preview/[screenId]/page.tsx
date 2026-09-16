'use client';

import { PenLine } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Badge, Button, cn } from '@/components/ui';
import { businessEditHref, canvasHref, previewHref } from '@/components/we-adk/mockup-board';
import { DesignHtmlButton } from '@/components/we-adk/design-html-button';
import { canPreviewLive } from '@/components/we-adk/live-screen-preview';
import {
  DeviceSwitcher,
  PreviewModeSwitcher,
  ScreenPreviewSurface,
  type PreviewMode,
} from '@/components/we-adk/screen-preview';
import { type DevicePresetId } from '@/lib/we-adk-mock/sketcher';
import { liveScreenRoute } from '@/lib/we-adk/live-screens';
import { isHtmlDesignFile } from '@/lib/we-adk/design-html';
import { WorkspaceProvider } from '@/lib/api/workspace-provider';
import {
  findPrototypeByRoute,
  findPrototypeFile,
  readPrototypeId,
  versionedPrototypeId,
} from '@/lib/we-adk/prototype';
import { resolveScreen, type ResolvedScreen } from '@/lib/we-adk/screen-registry';

/** A path segment that was never escaped decodes to itself; a broken one is kept. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * A design on its own, outside the app shell: no project nav, no explorer, no
 * editor panels — just the screen, at a chosen device width. This is what
 * "open in browser" hands to someone who only needs to look at it.
 *
 * Files that stand for a page of the live eACC app show that page; the toggle
 * switches back to the wireframe the canvas drew. The bar at the top is
 * deliberately thin and can be dropped with `?bare=1`, for pasting into a slide
 * or a screenshot.
 */
function Preview() {
  const params = useParams<{ screenId: string }>();
  const searchParams = useSearchParams();
  const bare = searchParams.get('bare') === '1';
  const projectId = searchParams.get('project');
  // `useParams` hands back the raw path segment, so a round's copy arrives as
  // `proto-tax-invoice%40v2`. Left as-is it matches no prototype, and the page
  // falls back to a wireframe — the reason a version 2 file opened in a tab
  // looked nothing like the same file in the workspace.
  const screenId = decodeSegment(params.screenId);

  // Its own tab is the widest room a screen ever gets, so take all of it: no
  // width cap, full height, no frame. The pane in the workspace is framed
  // because it shares its row with the explorer and the chat; here there is
  // nothing to share with. `?device=desktop` (or the switcher) caps it again.
  const [device, setDevice] = useState<DevicePresetId>(
    (searchParams.get('device') as DevicePresetId | null) ?? 'full',
  );
  const [mode, setMode] = useState<PreviewMode>(
    searchParams.get('mode') === 'wireframe' ? 'wireframe' : 'live',
  );
  // A created file's identity is workspace state, so resolve after mount.
  const [opened, setOpened] = useState<ResolvedScreen | null>(null);

  useEffect(() => {
    setOpened(resolveScreen(screenId, projectId ?? undefined));
  }, [screenId, projectId]);

  const hasLive = canPreviewLive(screenId);
  const liveRoute = liveScreenRoute(screenId);
  const prototype = findPrototypeFile(screenId);
  // Every file in a version folder is an html file, so a design drawn in a
  // round gets the name and the export the baseline's pages get.
  const isHtml = isHtmlDesignFile(screenId, opened?.fileName);

  // A project's design edits inside the Business workspace; a Builder mockup or a
  // captured production screen has no workspace, so it takes the full-screen canvas.
  const inWorkspace =
    projectId !== null &&
    (opened === null || opened.origin === 'sketch' || opened.origin === 'generated');
  const editHref = inWorkspace
    ? businessEditHref(projectId, screenId)
    : canvasHref(screenId, projectId ?? undefined);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#f4f5f7] dark:bg-[#191024]">
      {!bare && (
        <header className="bg-background flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{opened?.name ?? 'Design preview'}</span>
            {opened?.route && (
              <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                {opened.route}
              </Badge>
            )}
            <Badge variant="outline" className="shrink-0 text-[10px]">
              preview
            </Badge>
            {isHtml && opened?.fileName ? (
              <Badge variant="info" className="shrink-0 text-[10px]" title={liveRoute ?? ''}>
                {opened.fileName}
              </Badge>
            ) : (
              hasLive &&
              mode === 'live' && (
                <Badge variant="success" className="shrink-0 text-[10px]" title={liveRoute ?? ''}>
                  live screen
                </Badge>
              )
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {hasLive && !prototype && <PreviewModeSwitcher mode={mode} onChange={setMode} />}
            <DeviceSwitcher device={device} onChange={setDevice} />
            {isHtml && (
              <DesignHtmlButton
                screenId={screenId}
                name={opened?.name ?? screenId}
                route={opened?.route}
                seedPattern={opened?.seedPattern}
                origin={opened?.parentLabel}
              />
            )}
            {!prototype && (
              <Button variant="outline" size="sm" asChild>
                <Link href={editHref}>
                  <PenLine className="size-3.5" />
                  Edit
                </Link>
              </Button>
            )}
          </div>
        </header>
      )}

      {/* Full width sits flush against the window; every other preset keeps the
          padding the workspace pane uses, so the frame is the same one. */}
      <main
        className={cn(
          'flex min-h-0 flex-1 justify-center overflow-y-auto',
          device === 'full' ? 'p-0' : 'p-5',
        )}
      >
        <ScreenPreviewSurface
          screenId={screenId}
          seedPattern={opened?.seedPattern ?? 'listPage'}
          route={opened?.route}
          device={device}
          mode={mode}
          className={device === 'full' ? 'rounded-none border-0 shadow-none' : undefined}
          editable
          hrefForRoute={(target) => {
            const page = findPrototypeByRoute(target);
            if (!page) return null;
            // Stay in whichever round this file belongs to, rather than
            // dropping back to the baseline page the route names.
            const version = readPrototypeId(screenId).version;
            const id = version === null ? page.id : versionedPrototypeId(page.id, version);
            return previewHref(id, projectId ?? undefined);
          }}
        />
      </main>
    </div>
  );
}

export default function DesignPreviewPage() {
  return (
    // This route has no shell of its own, so it mounts the provider itself. The design it
    // renders is workspace state, and resolving a file id before that state has arrived
    // would report a screen that exists as missing.
    <WorkspaceProvider>
      <Suspense
        fallback={
          <div className="text-muted-foreground flex min-h-dvh items-center justify-center text-sm">
            Loading the design…
          </div>
        }
      >
        <Preview />
      </Suspense>
    </WorkspaceProvider>
  );
}
