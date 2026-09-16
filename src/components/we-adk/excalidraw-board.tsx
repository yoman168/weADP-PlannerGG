'use client';

/**
 * The whiteboard, as a real drawing surface.
 *
 * Boards are the task's own work, so they are kept as cards under the board
 * rather than filed under Reference files: a reference is something handed to us,
 * and a board is something we drew.
 *
 * This was a freehand canvas of my own: a pen, five colours and an eraser. What
 * was actually wanted is what a whiteboard tool does — shapes, arrows, text,
 * selection, resizing, layers, zoom, images — and hand-building that would have
 * produced a worse version of Excalidraw rather than a smaller one. So the editor
 * *is* Excalidraw, and this file is only the part that belongs to this app: where
 * the scene is kept, and how a board becomes a reference file on the task.
 *
 * Loaded through next/dynamic with ssr:false — Excalidraw touches `window` on the
 * way up, and there is nothing about a drawing surface worth server-rendering.
 */
import { Excalidraw, convertToExcalidrawElements, exportToCanvas } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawImperativeAPI, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement, NonDeleted } from '@excalidraw/excalidraw/element/types';
import { MessageSquareText, Save, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui';
import { ChatPane, type ChatTurn } from '@/components/we-adk/claude-chat';
import { type DesignProject } from '@/lib/we-adk-mock/projects';
import { addArtifact, replaceArtifact } from '@/lib/we-adk/board-artifacts';
import { loadBoardChat, saveBoardChat } from '@/lib/we-adk/board-chat';
import { clearScene, loadScene, saveScene } from '@/lib/we-adk/board-scene';
import { clearBoard, dataUrlSizeKb, loadBoard, type Stroke } from '@/lib/we-adk/whiteboard';

// Excalidraw fetches its hand-drawn fonts at runtime, from unpkg unless told
// otherwise. They are vendored into public/excalidraw so a board still draws with
// no network. Set before the editor mounts, which is why it sits at module level.
if (typeof window !== 'undefined') {
  (window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = '/excalidraw/';
}

/** A board bigger than this is recorded by name only — see the note it sets. */
const MAX_IMAGE_BYTES = 1_500_000;

/**
 * The board in words, for the chat to read.
 *
 * Counts by shape, plus any text actually drawn on the board — the labels are the
 * part worth quoting, and without them the chat would be answering about a picture
 * it cannot see.
 */
function describeScene(elements: readonly ExcalidrawElement[]): string {
  const live = elements.filter((element) => !element.isDeleted);
  if (live.length === 0) return 'The whiteboard is empty.';

  const counts = new Map<string, number>();
  const labels: string[] = [];
  for (const element of live) {
    counts.set(element.type, (counts.get(element.type) ?? 0) + 1);
    const text = (element as { text?: string }).text?.trim();
    if (text) labels.push(text);
  }

  const parts = [
    `The whiteboard has ${live.length} element${live.length === 1 ? '' : 's'}: ` +
      [...counts.entries()].map(([type, count]) => `${type} ×${count}`).join(', ') +
      '.',
  ];
  if (labels.length > 0)
    parts.push('', 'Text on the board:', ...labels.map((label) => `- ${label}`));
  return parts.join('\n');
}
/** Excalidraw only knows three stroke widths; a legacy nib maps onto the nearest. */
function nibWidth(width: number): number {
  if (width <= 3) return 1;
  if (width <= 8) return 2;
  return 4;
}

/**
 * Freehand strokes from the previous whiteboard, as Excalidraw elements.
 *
 * A stroke was already a list of points drawn as a polyline, so a `line` element
 * carries it across exactly rather than approximately. Without this, opening the
 * new board would silently show an empty page to anyone who had drawn on the old
 * one.
 */
function strokesAsElements(strokes: Stroke[]): ExcalidrawElement[] {
  const skeletons = strokes
    .filter((stroke) => stroke.points.length >= 4)
    .map((stroke) => {
      const originX = stroke.points[0]!;
      const originY = stroke.points[1]!;
      const points: [number, number][] = [];
      for (let i = 0; i < stroke.points.length; i += 2) {
        points.push([stroke.points[i]! - originX, stroke.points[i + 1]! - originY]);
      }
      return {
        type: 'line' as const,
        x: originX,
        y: originY,
        points,
        strokeColor: stroke.color,
        strokeWidth: nibWidth(stroke.width),
        backgroundColor: 'transparent',
        roughness: 0,
      };
    });
  return skeletons.length > 0 ? convertToExcalidrawElements(skeletons) : [];
}

export function ExcalidrawBoard({
  sessionId,
  project,
  uploadedBy,
  onSaved,
  replaceId,
}: {
  /** The key this task's work is stored under. */
  sessionId: string;
  /** For the chat pane, which answers in the project's terms. */
  project: DesignProject;
  uploadedBy: string;
  /**
   * Called only when a board was actually saved, with the line to show for it.
   * The board closes on the way out, so this is what the task says instead.
   */
  onSaved: (message: string) => void;
  /** Set when a card was reopened: saving updates it instead of adding another. */
  replaceId?: string;
}) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  /**
   * Where to put a ✕ on Excalidraw's own dialogs — Help, Shortcuts — or null
   * while none is open.
   *
   * Excalidraw renders a close button only on a mobile viewport: its `Dialog`
   * gates one on `isFullscreen`, so on a desktop the element is never in the DOM
   * and there is no prop or stylesheet that brings it back. That leaves Escape
   * and a click on the backdrop, neither of which is visible, so the dialog
   * reads as having no way out.
   *
   * The dialogs are portaled to `document.body` rather than into the Excalidraw
   * container, so they are outside this component's tree and have to be found by
   * watching the body. The node wanted is `.Island`, which Excalidraw styles
   * `position: relative` — so its own `.Dialog__close` rule places our button in
   * the corner it already reserved for one.
   */
  const [dialogIsland, setDialogIsland] = useState<HTMLElement | null>(null);
  const [caption, setCaption] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [empty, setEmpty] = useState(true);
  /** What the chat is told about the board. Updated with the same debounce as the
   *  scene write, since onChange fires on every pointer move. */
  const [scene, setScene] = useState('The whiteboard is empty.');
  const [chatTurns] = useState<ChatTurn[]>(() => loadBoardChat(sessionId));
  const writeTimer = useRef<number | null>(null);

  /**
   * What the board opens with, decided once.
   *
   * Read straight out of storage rather than in an effect: this component never
   * renders on the server, so there is no first paint to match.
   */
  const [initial] = useState(() => {
    const scene = loadScene(sessionId);
    if (scene)
      return { elements: scene.elements as ExcalidrawElement[], files: scene.files, carried: 0 };
    const strokes = loadBoard(sessionId);
    if (strokes.length === 0) return { elements: [] as ExcalidrawElement[], files: {}, carried: 0 };
    const elements = strokesAsElements(strokes);
    // Convert once. Keeping the strokes would re-import them over whatever gets
    // drawn next time the board is opened.
    saveScene(sessionId, { elements, files: {} });
    clearBoard(sessionId);
    return { elements, files: {}, carried: strokes.length };
  });

  useEffect(() => {
    if (initial.carried > 0) {
      setNote(
        `Brought ${initial.carried} stroke${initial.carried === 1 ? '' : 's'} over from the old board.`,
      );
    }
    setEmpty(initial.elements.length === 0);
  }, [initial]);

  /* Watch the body for one of Excalidraw's dialogs opening or closing, so the ✕
     below can be portaled into it. See `dialogIsland`. A MutationObserver rather
     than a poll: the dialog appears on a click, and anything slower than the
     paint would show the corner empty first. */
  useEffect(() => {
    const find = () =>
      setDialogIsland(
        document.querySelector<HTMLElement>('.excalidraw-modal-container .Modal .Island'),
      );
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // Excalidraw reports every pointer move, so writes are trailing-edge only.
  const persist = useCallback(
    (elements: readonly ExcalidrawElement[], files: BinaryFiles) => {
      const live = elements.filter((element) => !element.isDeleted);
      setEmpty(live.length === 0);
      if (writeTimer.current !== null) window.clearTimeout(writeTimer.current);
      writeTimer.current = window.setTimeout(() => {
        setScene(describeScene(live));
        if (live.length === 0) {
          clearScene(sessionId);
          return;
        }
        const ok = saveScene(sessionId, {
          elements: live as unknown[],
          files: files as unknown as Record<string, unknown>,
        });
        if (!ok) {
          setNote('This board is too big for browser storage — attach it before you close it.');
        }
      }, 500);
    },
    [sessionId],
  );

  useEffect(
    () => () => {
      if (writeTimer.current !== null) window.clearTimeout(writeTimer.current);
    },
    [],
  );

  /** Flatten the scene to a PNG and keep it as one of the task's boards. */
  const save = async () => {
    if (!api) return;
    const elements = api.getSceneElements();
    if (elements.length === 0) return;

    const canvas = await exportToCanvas({
      elements: elements as readonly NonDeleted<ExcalidrawElement>[],
      files: api.getFiles(),
      appState: { ...api.getAppState(), exportBackground: true, viewBackgroundColor: '#ffffff' },
      // Big enough to read a label on, small enough to keep in workspace state.
      maxWidthOrHeight: 1600,
      exportPadding: 16,
    });
    const dataUrl = canvas.toDataURL('image/png');
    const oversized = dataUrl.length > MAX_IMAGE_BYTES;
    const trimmed = caption.trim();

    const fields = {
      kind: 'whiteboard' as const,
      sizeKb: dataUrlSizeKb(dataUrl),
      ...(oversized ? {} : { dataUrl }),
      ...(trimmed ? { caption: trimmed } : {}),
      // The scene, so the card can be opened and drawn on again. Bigger than the
      // picture, and the reason a save can be refused for storage — which the
      // failure path below reports rather than swallowing.
      scene: {
        elements: elements.filter((element) => !element.isDeleted) as unknown[],
        files: api.getFiles() as unknown as Record<string, unknown>,
      },
      createdBy: uploadedBy,
    };
    const today = new Date().toISOString().slice(0, 10);
    const saved = replaceId
      ? replaceArtifact(sessionId, replaceId, fields, today)
      : addArtifact(sessionId, fields, today);
    if (!saved) {
      // The board stays open: this is the one outcome the author has to see, and
      // dismissing it would take the message with it.
      setNote('Browser storage is full, so this board could not be kept.');
      return;
    }
    // Cancel any write still queued from the last stroke. The surface is cleared
    // as this returns, and a late write would restore what was just cleared.
    if (writeTimer.current !== null) {
      window.clearTimeout(writeTimer.current);
      writeTimer.current = null;
    }
    const verb = replaceId ? 'Updated' : 'Saved';
    onSaved(
      oversized
        ? `${verb} ${saved.title}, but the picture was too large to keep — only the card survived.`
        : `${verb} ${saved.title}.`,
    );
  };

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      {/* The ✕ Excalidraw does not draw on a desktop — see `dialogIsland`.
          `Dialog__close` is Excalidraw's own class, so this inherits the
          position and hover colours it already defines. Closing goes through
          the backdrop `Modal` wires to `onCloseRequest`, which is the same path
          a click outside takes, rather than reaching for Excalidraw's state. */}
      {dialogIsland &&
        createPortal(
          <button
            type="button"
            className="Dialog__close"
            title="Close"
            aria-label="Close"
            onClick={() =>
              dialogIsland
                .closest('.Modal')
                ?.querySelector<HTMLElement>('.Modal__background')
                ?.click()
            }
          >
            <X className="size-5" />
          </button>,
          dialogIsland,
        )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Excalidraw fills whatever box it is given and needs a real height. */}
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
          <Excalidraw
            excalidrawAPI={setApi}
            theme="light"
            initialData={{
              elements: initial.elements,
              files: initial.files as BinaryFiles,
              appState: { viewBackgroundColor: '#ffffff' },
              scrollToContent: true,
            }}
            onChange={(elements, _appState, files) => persist(elements, files)}
            UIOptions={{ tools: { image: false }, canvasActions: { export: false } }}
            libraryReturnUrl=""
          />
        </div>

        {/* One line under the canvas, gathered at the right.
          Two reasons it sits there rather than spanning the width: a caption is a
          short sentence, and a field stretched across a full-screen board is a
          metre of empty box; and the bottom-left corner is where floating things
          live — the zoom controls above it, the dev badge over it — so anything
          started there gets sat on. Grouped by the primary action, it also
          balances the close control at the top right. */}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 px-1">
          <p className="text-muted-foreground min-w-0 truncate text-[11px]">
            {note ?? 'A caption is optional, and is read with the brief.'}
          </p>

          <label className="flex min-w-0 items-center gap-2">
            <MessageSquareText className="text-muted-foreground size-3.5 shrink-0" />
            <input
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="What does this board show?"
              aria-label="Board caption, optional — read with the brief"
              className="bg-background h-8 w-[22rem] min-w-0 max-w-full rounded-md border px-2.5 text-xs"
            />
          </label>

          <Button
            size="sm"
            className="h-8 shrink-0 gap-1.5 px-3 text-xs"
            disabled={empty}
            onClick={() => void save()}
          >
            <Save className="size-3.5" />
            Save board
          </Button>
        </div>
      </div>

      {/* Claude beside the board, the same pane the task and the preview use.
          Hidden below xl: on a narrow window the drawing needs the width more than
          the conversation does, and a 26rem column would leave neither usable. */}
      {/* No header of its own: the pane says what it can see in its own greeting,
          and a "Claude Code · whiteboard · local CLI" bar above it repeated the
          dialog's own title for no gain. */}
      <aside className="hidden w-[26rem] shrink-0 flex-col border-l pl-3 xl:flex">
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatPane
            project={project}
            // What is on the board, refreshed as it is drawn — see describeScene.
            contextText={scene}
            folderLabel="whiteboard"
            greeting="Ask about this board"
            greetingHint="What you have drawn is in context — the shapes and any text on them."
            initialTurns={chatTurns}
            onPersist={(turns) => saveBoardChat(sessionId, turns)}
          />
        </div>
      </aside>
    </div>
  );
}
