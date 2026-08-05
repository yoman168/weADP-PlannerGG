'use client';

import {
  Check,
  ClipboardList,
  Code2,
  ExternalLink,
  MonitorPlay,
  PenLine,
  Sparkles,
  SquareTerminal,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge, Button } from '@/components/ui';
import { useBusinessWorkspace } from '@/components/we-adk/business-workspace';
import { ChatPane } from '@/components/we-adk/claude-chat';
import { DesignHtmlButton } from '@/components/we-adk/design-html-button';
import { TaskFormDialog } from '@/components/we-adk/task-form-dialog';
import { canPreviewLive } from '@/components/we-adk/live-screen-preview';
import {
  businessCanvasHref,
  businessPreviewHref,
  previewHref,
} from '@/components/we-adk/mockup-board';
import {
  DeviceSwitcher,
  PreviewEditTabs,
  PreviewModeSwitcher,
  ScreenPreviewSurface,
  type PreviewMode,
} from '@/components/we-adk/screen-preview';
import { useLocale } from '@/lib/locale';
import { isHtmlDesignFile } from '@/lib/we-adk/design-html';
import { liveScreenRoute } from '@/lib/we-adk/live-screens';
import {
  findPrototypeByRoute,
  findPrototypeFile,
  isPrototypeFile,
  readPrototypeId,
  versionedPrototypeId,
} from '@/lib/we-adk/prototype';
import { prototypeDesignBlocks } from '@/lib/we-adk/prototype-design';
import { resolveScreen, type ResolvedScreen } from '@/lib/we-adk/screen-registry';
import { describeCanvas } from '@/lib/we-adk/sketcher-operations';
import { loadScreenBlocks, type DevicePresetId } from '@/lib/we-adk-mock/sketcher';
import { createTask } from '@/lib/we-adk-mock/tasks';

/**
 * A design file previewed inside the workspace: the explorer stays where it is,
 * only this pane changes — the same swap the canvas does, so you can walk a
 * version folder file by file without losing the tree.
 *
 * For an html file of the prototype this is also where it is edited: Edit UI in
 * the preview's own header turns the screen into something you can click apart,
 * section by section.
 */
export default function BusinessPreviewPage() {
  const { t } = useLocale();
  const { project, folders, isReleased, saveFile, changes } = useBusinessWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const screenId = searchParams.get('screen');
  const folderId = searchParams.get('folder');

  const [device, setDevice] = useState<DevicePresetId>('full');
  const [mode, setMode] = useState<PreviewMode>('live');
  const [chrome, setChrome] = useState(true);
  /** The question Improve by AI hands to the chat pane beside the screen. */
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);

  // Preview and Design are the same screen — Design just lets you change it.
  const designing = searchParams.get('edit') === '1';

  const file = screenId
    ? folders
        .flatMap((folder) => [...folder.files, ...(folder.children ?? []).flatMap((c) => c.files)])
        .find((entry) => entry.id === screenId)
    : undefined;

  // A link can point at a design that is not in this project's tree — a concept
  // from the meetings, say, now that the baseline is the html prototype. Resolve
  // it anyway, so the pane names what it is showing instead of an id.
  const [elsewhere, setElsewhere] = useState<ResolvedScreen | null>(null);
  useEffect(() => {
    setElsewhere(!screenId || file ? null : resolveScreen(screenId, project.id));
  }, [screenId, file, project.id]);

  if (!screenId) {
    return (
      <div className="text-muted-foreground flex min-w-0 flex-1 items-center justify-center text-sm">
        {t('chat.pickFile')}
      </div>
    );
  }

  const hasLive = canPreviewLive(screenId);
  const liveRoute = liveScreenRoute(screenId);
  const prototype = findPrototypeFile(screenId);
  const showingLive = hasLive && mode === 'live';
  // A round's own designs are html files too, so they read and export the way
  // the baseline's pages do.
  const isHtml = isHtmlDesignFile(screenId, file?.fileName);

  // What the two floating buttons are acting on: this screen, in this round.
  const screenName = prototype?.name ?? file?.name ?? elsewhere?.name ?? screenId;
  const screenRoute = prototype?.route ?? file?.route ?? elsewhere?.route;
  const round = folders
    .flatMap((folder) => [folder, ...(folder.children ?? [])])
    .find((folder) => folder.id === folderId);
  const where = `${screenName}${screenRoute ? ` (${screenRoute})` : ''}${
    round ? ` in ${round.name}` : ''
  }`;

  /**
   * What the chat beside the screen can see. The sections themselves have to be
   * in here: with only a name to go on, the model has nothing to answer from.
   */
  const screenContext = [
    `Screen: ${screenName}${screenRoute ? ` (route ${screenRoute})` : ''}`,
    round ? `Round: ${round.name} — ${round.label}` : '',
    prototype ? `An html page of the working prototype. ${prototype.summary}` : '',
    '',
    'Its sections, top to bottom:',
    describeCanvas(
      loadScreenBlocks(screenId, file?.seedPattern ?? 'listPage', () =>
        isPrototypeFile(screenId) ? prototypeDesignBlocks(screenId) : null,
      ),
    ),
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 14_000);

  /**
   * A link inside the previewed screen stays in the round you are reading.
   *
   * The routes resolve to the baseline page — that is the only thing a route
   * knows about — so following one out of a round landed on version 1's file
   * with the round's folder still selected: version 1's layout, labelled as
   * this round's. Carrying the round across keeps the click inside it.
   */
  const roundCopyOf = (baseId: string): string => {
    const version = readPrototypeId(screenId).version;
    return version === null ? baseId : versionedPrototypeId(baseId, version);
  };

  /** Improve by AI is a question asked of the pane already open beside it. */
  const improvePrompt = [
    `Improve ${where}, working from the sections listed in the context above.`,
    'Suggest concrete changes to its layout, information hierarchy, wording and empty or error',
    'states. Answer as a short prioritised list — for each, name the section it applies to and',
    'what it buys the person using it. Do not redesign the screen from scratch.',
  ].join(' ');

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/* One row across the top: the screen's toolbar and the chat's header are
          cells of the same row, so they are the same height however the
          toolbar wraps. */}
      <div className="bg-background flex shrink-0 border-b">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 px-4 py-2">
          {prototype ? (
            <Code2 className="text-muted-foreground size-3.5 shrink-0" />
          ) : (
            <MonitorPlay className="text-muted-foreground size-3.5 shrink-0" />
          )}
          <span className="truncate font-mono text-xs font-medium">
            {file?.fileName ?? elsewhere?.name ?? screenId}
          </span>
          {(file?.name ?? elsewhere?.route) && (
            <span className="text-muted-foreground truncate text-xs">
              {file?.name ?? elsewhere?.route}
            </span>
          )}
          {isHtml ? (
            <Badge variant="info" className="shrink-0 text-[10px]" title={liveRoute ?? ''}>
              {t('badge.html')}
            </Badge>
          ) : showingLive ? (
            <Badge variant="success" className="shrink-0 text-[10px]" title={liveRoute ?? ''}>
              {t('badge.liveScreen')}
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {t('badge.wireframe')}
            </Badge>
          )}

          {/* Save: this round is where it should be, so clear its A and M
              markers and start counting changes from here. A released round
              cannot change, so there is nothing to save. */}
          {round?.versionNumber !== undefined && !isReleased && screenId && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              disabled={!changes[screenId]}
              onClick={() => saveFile(screenId)}
            >
              <Check className="size-3" />
              {t('file.save')}
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Preview is the screen; Edit is the canvas it is built from. */}
            <PreviewEditTabs
              active="preview"
              previewHref={businessPreviewHref(project.id, screenId, folderId)}
              editHref={businessCanvasHref(project.id, screenId, folderId)}
            />
            {hasLive && !prototype && <PreviewModeSwitcher mode={mode} onChange={setMode} />}
            <DeviceSwitcher device={device} onChange={setDevice} />
            {isHtml && (
              <DesignHtmlButton
                screenId={screenId}
                name={screenName}
                route={screenRoute}
                seedPattern={file?.seedPattern}
                origin={round?.name}
                className="h-7 gap-1 px-2 text-xs"
              />
            )}
            <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
              <a href={previewHref(screenId, project.id)} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3" />
                {t('view.openBrowser')}
              </a>
            </Button>
          </div>
        </div>

        <div className="flex w-[26rem] shrink-0 items-center gap-2 border-l px-3 py-2">
          <SquareTerminal className="text-primary size-4 shrink-0" />
          <span className="text-sm font-semibold">{t('chat.claudeCode')}</span>
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
            {file?.fileName ?? elsewhere?.name ?? screenId}
          </span>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {t('badge.localCli')}
          </Badge>
        </div>
      </div>

      {/* Below it: the screen on the left, the conversation on the right. */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* The scrolling screen, and the bar that floats over it. The bar is
              positioned against this wrapper rather than against the scroll
              area, so it stays centred over the screen and never drifts with
              the scroll. */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-[#f4f5f7] p-5 dark:bg-[#0b0e14]">
              <ScreenPreviewSurface
                screenId={screenId}
                seedPattern={file?.seedPattern ?? 'listPage'}
                route={screenRoute}
                device={device}
                mode={mode}
                chrome={chrome}
                // A released round is read-only, so Edit UI is not offered —
                // its sections are the record of what shipped.
                editable={!isReleased}
                startEditing={designing && !isReleased}
                hrefForRoute={(route) => {
                  const target = findPrototypeByRoute(route);
                  return target
                    ? businessPreviewHref(project.id, roundCopyOf(target.id), folderId)
                    : null;
                }}
              />
            </div>

            {/* Floating action bar — hidden for released versions. The strip
                itself lets clicks and scrolls through; only the pill catches
                them. */}
            {!isReleased && (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center">
                <div className="bg-background pointer-events-auto flex items-center gap-2 rounded-full border px-2 py-1.5 shadow-lg">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-full"
                    onClick={() => setAiPrompt(improvePrompt)}
                    title={`Ask Claude how to improve ${screenName}`}
                  >
                    <Sparkles className="size-3.5" />
                    {t('action.improveAi')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-full"
                    onClick={() => setTaskOpen(true)}
                    title={`Raise a task about ${screenName}`}
                  >
                    <ClipboardList className="size-3.5" />
                    {t('action.createTask')}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <p className="text-muted-foreground bg-background flex shrink-0 flex-wrap items-center gap-1 border-t px-4 py-2 text-[10px]">
            {isReleased
              ? // A released round has no Edit UI to point at — saying otherwise
                // sends people looking for a button that is deliberately gone.
                t('preview.releasedHint')
              : prototype
                ? t('preview.prototypeHint', { summary: prototype.summary })
                : hasLive
                  ? t('preview.liveHint')
                  : t('preview.wireframeHint')}
            {/* The link that got here may predate the html prototype, so say where
              the file actually lives now rather than leaving the tree blank. */}
            {elsewhere && (
              <>
                <span>{t('preview.notInVersion')}</span>
                <Link href={elsewhere.parentHref} className="underline underline-offset-2">
                  {elsewhere.parentLabel}
                </Link>
              </>
            )}
          </p>
        </div>

        {/* Claude sits beside every screen — part of the workspace, not
            something to go and open. */}
        <aside className="bg-background flex w-[26rem] shrink-0 flex-col border-l">
          <ChatPane
            project={project}
            contextText={screenContext}
            folderLabel={`preview/${file?.fileName ?? screenId}`}
            greeting={t('chat.askAbout', { name: prototype?.name ?? file?.name ?? 'this screen' })}
            greetingHint={t('chat.greetingHint')}
            initialTurns={[]}
            pendingPrompt={aiPrompt}
            onPromptHandled={() => setAiPrompt(null)}
            onPersist={() => {}}
          />
        </aside>
      </div>

      {/* Create task — the same form the Task tab uses, opened with the screen
          already written into it. Saving lands on the task itself. */}
      <TaskFormDialog
        open={taskOpen}
        defaults={{
          title: `Improve ${screenName}`,
          status: 'Request',
          priority: 2,
          category: 'Design',
          description: `Raised from the preview of ${file?.fileName ?? screenName}${
            screenRoute ? ` (${screenRoute})` : ''
          }${round ? ` in ${round.name}` : ''}.`,
          tags: ['design'],
        }}
        onClose={() => setTaskOpen(false)}
        onSave={(fields) => {
          const task = createTask(project.id, fields);
          setTaskOpen(false);
          router.push(`/we-adk/projects/${project.id}/sketcher/task?task=${task.id}`);
        }}
      />
    </div>
  );
}
