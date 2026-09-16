'use client';

import {
  Check,
  Code2,
  ExternalLink,
  MessageSquare,
  MonitorPlay,
  MousePointer2,
  PenLine,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, cn } from '@/components/ui';
import { useBusinessWorkspace } from '@/components/we-adk/business-workspace';
import { ChatPane } from '@/components/we-adk/claude-chat';
import { DesignHtmlButton } from '@/components/we-adk/design-html-button';
import { ScreenLinkPicker } from '@/components/we-adk/screen-link-picker';
import { saveHtmlAndBlocks } from '@/lib/we-adk/html-to-blocks';
import { showToast } from '@/components/ui/toast';
import {
  businessEditHref,
  businessPreviewHref,
  previewHref,
} from '@/components/we-adk/mockup-board';
import {
  DeviceSwitcher,
  PreviewEditTabs,
  ScreenPreviewSurface,
  type PreviewMode,
} from '@/components/we-adk/screen-preview';
import { useLocale } from '@/lib/locale';
import { isHtmlDesignFile, loadDesignHtml } from '@/lib/we-adk/design-html';
import { openFlowDocument } from '@/lib/we-adk/mockup-pages';
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
  const [mode] = useState<PreviewMode>('wireframe');
  const [chrome, setChrome] = useState(true);
  /** The question Improve by AI hands to the chat pane beside the screen. */
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  const [chatCollapsed, setChatCollapsed] = useState(true);
  /** Wiring: the mode, and the control waiting to be told what it opens. */
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);

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

  const prototype = findPrototypeFile(screenId);
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
   * The screen in its own tab — and the round with it, wired.
   *
   * These pages link to each other: the model writes `data-screen` where a
   * real product would have an href, and the workspace turns that into
   * navigation. Handing over the one page being looked at gives a screen with
   * a drawn, dead sidebar, so the whole round goes instead and the tab opens on
   * this screen. `openFlowDocument` builds it from the stored pages.
   *
   * The fallback is the route this button has always opened. A screen with no
   * stored page — a baseline html file, which the server renders — has nothing
   * to put in a standalone document, and showing someone a flow that does not
   * contain the screen they were on would be worse than not linking at all.
   */
  const openInBrowser = () => {
    if (loadDesignHtml(screenId)) {
      const set = folders
        .flatMap((entry) => [...entry.files, ...(entry.children ?? []).flatMap((c) => c.files)])
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          html: loadDesignHtml(entry.id) ?? undefined,
        }));
      if (openFlowDocument(set, round?.name ?? screenName, screenId)) return;
    }
    window.open(previewHref(screenId, project.id), '_blank', 'noopener');
  };

  /**
   * Whether the screen on show is frozen.
   *
   * The workspace's own `isReleased` reads the round that is *open*, which is
   * not necessarily the round this screen belongs to — open a released file
   * with no round open and that flag is false while the file is still locked.
   * The round in the URL is the authority when there is one.
   */
  const releasedRound = round ? round.versionStatus === 'Released' : isReleased;

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
            {/* Preview is the screen; Page is the document it is, edited in place. */}
            <PreviewEditTabs
              active="preview"
              released={releasedRound}
              previewHref={businessPreviewHref(project.id, screenId, folderId)}
              editHref={businessEditHref(project.id, screenId, folderId)}
            />
            {/* The same wiring gesture the Customer side has. A round's
                screens link to each other too, and this is where someone
                notices that one of them doesn't. A released round is the
                record of what shipped, so it is not wired here. */}
            {!releasedRound && (
              <button
                type="button"
                onClick={() => {
                  setPicking((current) => !current);
                  setPicked(null);
                }}
                aria-pressed={picking}
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-colors',
                  picking
                    ? 'bg-indigo-500 text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
                title="Click a control on the screen to say what it opens"
              >
                <MousePointer2 className="size-3.5" />
                {picking ? 'Picking…' : 'Link'}
              </button>
            )}
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
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={openInBrowser}
            >
              <ExternalLink className="size-3" />
              {t('view.openBrowser')}
            </Button>
          </div>
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
            <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-[#f4f5f7] p-5 dark:bg-[#191024]">
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
                /*
                 * The round's own screens, so a page wired to another one
                 * still reaches it here. The wiring travels in the page as
                 * screen names; this is what those names resolve against.
                 */
                links={folders
                  .flatMap((entry) => [...entry.files, ...(entry.children ?? []).flatMap((c) => c.files)])
                  .map((entry) => ({ id: entry.id, name: entry.name }))}
                onOpenScreen={(id) => router.push(businessPreviewHref(project.id, id, folderId))}
                pick={picking}
                onPickControl={setPicked}
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
                </div>
              </div>
            )}
          </div>
          <p className="text-muted-foreground bg-background flex shrink-0 flex-wrap items-center gap-1 border-t px-4 py-2 text-[10px]">
            {isReleased
              ? t('preview.releasedHint')
              : prototype
                ? t('preview.prototypeHint', { summary: prototype.summary })
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

        {/* AI Chat — collapsible, same pattern as the task tab */}
        {chatCollapsed ? (
          <button
            type="button"
            onClick={() => setChatCollapsed(false)}
            title="Open AI chat"
            aria-label="Open AI chat"
            className="fixed right-6 bottom-6 z-40 flex items-center gap-2 rounded-full border bg-background px-3.5 py-2 shadow-lg transition-colors hover:bg-muted"
          >
            <MessageSquare className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium">AI Chat</span>
          </button>
        ) : (
          <aside className="bg-background flex w-[26rem] shrink-0 flex-col border-l">
            <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">AI Chat</span>
              <button
                type="button"
                onClick={() => setChatCollapsed(true)}
                title="Close chat"
                aria-label="Close chat"
                className="text-muted-foreground hover:text-foreground rounded p-0.5"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <ChatPane
              project={project}
              contextText={screenContext}
              folderLabel={`preview/${file?.fileName ?? screenId}`}
              greeting={t('chat.askAbout', { name: prototype?.name ?? file?.name ?? 'this screen' })}
              greetingHint="Ask to generate or improve a page — Claude will create both HTML preview and canvas blocks."
              initialTurns={[]}
              pendingPrompt={aiPrompt}
              onPromptHandled={() => setAiPrompt(null)}
              onPersist={() => {}}
              onResponse={(responseText) => {
                if (!screenId) return;
                const match = responseText.match(/```html\s*\n([\s\S]*?)```/);
                if (match?.[1]) saveHtmlAndBlocks(screenId, match[1].trim());
              }}
            />
          </aside>
        )}
      </div>

      {/* The control just clicked, and what it should open. */}
      {picked !== null && (
        <ScreenLinkPicker
          screenId={screenId}
          index={picked}
          targets={folders
            .flatMap((entry) => [...entry.files, ...(entry.children ?? []).flatMap((c) => c.files)])
            .filter((entry) => entry.id !== screenId)
            .map((entry) => ({ id: entry.id, name: entry.name }))}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );
}
