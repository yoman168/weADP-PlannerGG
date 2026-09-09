'use client';

/**
 * The round's screens as a flow diagram, with the preview a card opens into.
 *
 * It reads its own rows rather than taking them as a prop. The diagram lives on
 * Main and the sheet those rows are edited in lives on IA, so a pane that loads
 * from the same seed + overlay as the sheet cannot drift from it: both go
 * through `loadIARows`, and a row typed on IA is in this diagram on the next
 * read. Nothing here writes — the flow is a reading of the sheet, not a second
 * place to edit it.
 */

import { X } from 'lucide-react';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';
import { IAScreenFlow } from '@/components/we-adk/ia-screen-flow';
import { LiveScreenPreview, canPreviewLive } from '@/components/we-adk/live-screen-preview';
import { MainViewSwitch } from '@/components/we-adk/main-view-switch';
import { useLocale } from '@/lib/locale';
import { liveScreenRoute } from '@/lib/we-adk/live-screens';
import { PROTOTYPE_FILES, findPrototypeByRoute } from '@/lib/we-adk/prototype';
import { loadRoundFolders } from '@/lib/we-adk/round-screens';
import {
  IA_DEPTH_FIELDS,
  loadDepthConfigs,
  loadIARows,
  loadIdSuffixFormat,
  loadRandomDigits,
  type IARow,
} from '@/lib/we-adk-mock/ia';
import { findProject, type DesignFile, type DesignFolder } from '@/lib/we-adk-mock/projects';

/** The newest round still open, falling back to the newest of any status. */
function pickDefaultVersion(folders: DesignFolder[]): number | null {
  const numbers = folders
    .map((folder) => folder.versionNumber)
    .filter((value): value is number => value !== undefined)
    .sort((a, b) => b - a);
  return (
    numbers.find(
      (version) =>
        folders.find((folder) => folder.versionNumber === version)?.versionStatus !== 'Released',
    ) ??
    numbers[0] ??
    null
  );
}

/** The depth cells of one row that carry something, in order. */
function pathOf(row: IARow): string[] {
  return IA_DEPTH_FIELDS.map((field) => row[field]).filter(Boolean);
}

export function IAScreenFlowPane() {
  const { t } = useLocale();
  const params = useParams<{ projectId: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [folders, setFolders] = useState<DesignFolder[]>([]);
  const [rows, setRows] = useState<IARow[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** The row whose screen is open in the preview dialog, if any. */
  const [flowPreview, setFlowPreview] = useState<IARow | null>(null);
  /**
   * The screen the dialog is currently showing. It starts as the card's own
   * screen but follows links inside the preview, so clicking the product's
   * sidebar moves to that screen *within* the dialog rather than navigating the
   * browser out of Main and into the full app.
   */
  const [flowScreen, setFlowScreen] = useState<string | null>(null);

  const folderParam = searchParams.get('folder');
  const fromFolder = folderParam?.startsWith('version-')
    ? Number.parseInt(folderParam.slice('version-'.length), 10)
    : Number.NaN;

  // Read after mount — everything here lives in localStorage — and again on
  // every navigation into the view, so a file added on Main shows up here too.
  useEffect(() => {
    const project = findProject(params.projectId);
    if (!project) return;
    const nextFolders = loadRoundFolders(project.id);
    setFolders(nextFolders);

    const version = nextFolders.some((folder) => folder.versionNumber === fromFolder)
      ? fromFolder
      : pickDefaultVersion(nextFolders);
    const folder = nextFolders.find((entry) => entry.versionNumber === version);
    setRows(
      version === null
        ? []
        : loadIARows(
            project.id,
            version,
            folder,
            project.name,
            loadIdSuffixFormat(project.id),
            loadRandomDigits(project.id),
            loadDepthConfigs(project.id),
          ),
    );
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.projectId, pathname, searchParams]);

  const activeVersion = folders.some((folder) => folder.versionNumber === fromFolder)
    ? fromFolder
    : pickDefaultVersion(folders);
  const activeFolder = folders.find((folder) => folder.versionNumber === activeVersion);

  /**
   * The design files this round holds, by id — what a card's name resolves
   * against, so a screen renamed in the file list is renamed on its card.
   */
  const filesById = useMemo(() => {
    const map = new Map<string, DesignFile>();
    for (const child of activeFolder?.children ?? []) {
      for (const file of child.files) map.set(file.id, file);
    }
    for (const file of activeFolder?.files ?? []) map.set(file.id, file);
    return map;
  }, [activeFolder]);

  const fileOf = useCallback(
    (row: IARow): DesignFile | undefined => (row.fileId ? filesById.get(row.fileId) : undefined),
    [filesById],
  );
  const labelOf = useCallback((row: IARow) => row.workItem || fileOf(row)?.name || '', [fileOf]);

  /**
   * The canvas id a card previews, or null when the row stands for a screen
   * that does not exist yet — a hand-typed row has nothing to render.
   */
  const flowScreenId = useCallback(
    (row: IARow): string | null => fileOf(row)?.id ?? null,
    [fileOf],
  );

  /**
   * The route shown on a card. The sheet's own Link column wins when someone
   * filled it in; otherwise the bound file answers, since a design copied from
   * a live screen already knows the route it came from.
   */
  const flowRoute = useCallback(
    (row: IARow): string => {
      if (row.link.trim()) return row.link.trim();
      const file = fileOf(row);
      if (!file) return '';
      return file.route ?? file.basedOnRoute ?? liveScreenRoute(file.id) ?? '';
    },
    [fileOf],
  );

  /** The one-line description under a card's name. */
  const flowDescription = useCallback(
    (row: IARow): string => labelOf(row) || row.menuGroup || '',
    [labelOf],
  );

  /** Opens the preview dialog on a card's own screen. */
  const openFlowPreview = useCallback(
    (row: IARow) => {
      setFlowPreview(row);
      setFlowScreen(fileOf(row)?.id ?? null);
    },
    [fileOf],
  );

  const closePreview = () => {
    setFlowPreview(null);
    setFlowScreen(null);
  };

  if (!loaded) return null;

  const project = findProject(params.projectId);
  if (!project || activeVersion === null || !activeFolder) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="text-muted-foreground text-sm">{t('explorer.noVersions')}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Only the switch. A heading here said "Screen Flow" to someone who had
          just pressed Screen Flow, and the diagram carries its own screen
          totals — so the bar holds the one thing this view cannot do without,
          which is the way back to the files. */}
      <header className="bg-background flex shrink-0 items-center border-b px-3 py-2">
        <MainViewSwitch projectId={project.id} active="flow" folderId={activeFolder.id} />
      </header>

      <IAScreenFlow
        rows={rows}
        routeOf={flowRoute}
        screenIdOf={flowScreenId}
        descriptionOf={flowDescription}
        onOpen={openFlowPreview}
        emptyLabel={t('ia.flowEmpty')}
        otherLabel={t('ia.flowOther')}
      />

      {/* Opening a flow card shows the screen itself, not another sheet of text. */}
      <Dialog open={flowPreview !== null} onOpenChange={(open) => !open && closePreview()}>
        {/*
          The built-in close is hidden and replaced by one in the header: a
          previewed screen renders the product's own chrome, whose fixed header
          sits over the dialog's top-right corner and swallows the default
          button.
        */}
        <DialogContent className="flex h-[85vh] w-[95vw] !max-w-[95vw] flex-col gap-0 overflow-hidden p-0 [&>button:last-child]:hidden">
          <DialogHeader className="!flex-row shrink-0 items-center justify-between gap-2 border-b px-4 py-2.5">
            {/* Follows the navigation, so the header always names the screen on
                show rather than the card the dialog was opened from. */}
            {(() => {
              const proto = flowScreen
                ? PROTOTYPE_FILES.find((file) => file.id === flowScreen)
                : undefined;
              const name =
                proto?.name ??
                (flowPreview
                  ? labelOf(flowPreview) || pathOf(flowPreview).pop() || flowPreview.screenId
                  : '');
              const route = proto?.route ?? (flowPreview ? flowRoute(flowPreview) : '');
              return (
                <DialogTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <span className="truncate">{name}</span>
                  {route && (
                    <>
                      <span className="bg-border mx-1 h-4 w-px shrink-0" />
                      <span className="text-muted-foreground shrink-0 font-mono text-[11px] font-normal">
                        {route}
                      </span>
                    </>
                  )}
                </DialogTitle>
              );
            })()}
            <button
              type="button"
              onClick={closePreview}
              className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 rounded p-1 transition-colors"
            >
              <X className="size-4" />
              <span className="sr-only">{t('ia.close')}</span>
            </button>
          </DialogHeader>
          {(() => {
            const screenId = flowScreen;
            if (!screenId || !canPreviewLive(screenId)) {
              return (
                <div className="text-muted-foreground flex flex-1 items-center justify-center text-xs">
                  {t('ia.flowNoPreview')}
                </div>
              );
            }
            return (
              <LiveScreenPreview
                key={screenId}
                screenId={screenId}
                chrome
                showEditToggle={false}
                hrefForRoute={(route) => route}
                onNavigate={(route) => {
                  // Stay inside the dialog: swap to the screen the link points
                  // at when the prototype has one, and ignore it otherwise
                  // rather than letting the browser leave Main.
                  const proto = findPrototypeByRoute(route);
                  if (proto) setFlowScreen(proto.id);
                }}
                className="min-h-0 flex-1"
              />
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
