'use client';

/**
 * The board under a task's reference files, in two kinds — hand-drawn, or written
 * as a diagram.
 *
 * The empty-state hint next to Attach asks for "a photo of the whiteboard" — so
 * there is a whiteboard here. What it produces is the task's own work rather than
 * a reference somebody handed over, so it is kept as a card under this section
 * instead of being filed with the uploads.
 *
 * Not everything wants to be drawn by hand, though: a flow of steps and decisions
 * is faster to write than to draw, and only stays tidy if something else does the
 * layout. So opening the board asks which kind first — free-form whiteboard, or
 * diagram-as-code — and the two are kept side by side rather than one replacing
 * the other, because a task often needs a sketch *and* a flow.
 *
 * Neither editor is rendered in the task panel. Drawing wants room, and a canvas
 * wedged into a third of a three-column layout gave neither the board nor the
 * task enough of it.
 */
import { Paintbrush, Presentation, Table2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  cn,
} from '@/components/ui';
import { BoardCards } from '@/components/we-adk/board-cards';
import { EntityCanvas } from '@/components/we-adk/entity-canvas';
import { type DesignProject } from '@/lib/we-adk-mock/projects';
import { type BoardArtifact } from '@/lib/we-adk/board-artifacts';
import { clearScene, loadScene, saveScene, sceneCount } from '@/lib/we-adk/board-scene';
import { loadDiagramSource, saveDiagramSource } from '@/lib/we-adk/diagram-source';
import { parseEntityModel } from '@/lib/we-adk/entity-model';
import { clearBoard, loadBoard } from '@/lib/we-adk/whiteboard';

/**
 * Excalidraw is a large dependency that touches `window` as it initialises, so it
 * is fetched when a board is actually opened rather than with the task page.
 */
const ExcalidrawBoard = dynamic(
  () => import('@/components/we-adk/excalidraw-board').then((mod) => mod.ExcalidrawBoard),
  {
    ssr: false,
    loading: () => (
      <p className="text-muted-foreground flex min-h-64 items-center justify-center text-sm">
        Opening the board…
      </p>
    ),
  },
);

/** Which kind of board is open. */
type BoardMode = 'whiteboard' | 'entities';

/**
 * The surface a board draws on, emptied.
 *
 * A board is scratch space, not a document: once its picture is a card on the
 * task, or once it has been closed, the next opening starts clean rather than
 * handing back a drawing whose sitting was over. Returns whether there was
 * anything to empty, so a plain look-and-close says nothing.
 */
function clearSurface(mode: BoardMode, sessionId: string): boolean {
  if (mode === 'whiteboard') {
    const had = sceneCount(sessionId) > 0 || loadBoard(sessionId).length > 0;
    clearScene(sessionId);
    clearBoard(sessionId);
    return had;
  }
  const had = loadDiagramSource(sessionId).trim().length > 0;
  saveDiagramSource(sessionId, '');
  return had;
}

/** How to put back what clearSurface is about to remove. */
function snapshot(mode: BoardMode, sessionId: string): () => void {
  if (mode === 'whiteboard') {
    const scene = loadScene(sessionId);
    return () => {
      if (scene) saveScene(sessionId, scene);
    };
  }
  const source = loadDiagramSource(sessionId);
  return () => saveDiagramSource(sessionId, source);
}

/**
 * The choice, asked once per opening.
 *
 * Each option says what is already there, because "Whiteboard" and
 * "Diagram-as-code" are not a choice between two empty pages once a task has work
 * in one of them — picking is also picking which one to carry on with.
 */
/** How many tables are stored. Only ever asked when there is at least one. */
function tableSummary(count: number): string {
  return `${count} table${count === 1 ? '' : 's'}`;
}

function BoardModeDialog({
  open,
  existing,
  boardCount,
  tableCount,
  onPick,
  onClose,
}: {
  open: boolean;
  /** Whether anything is already stored — the title says open, not new. */
  existing: boolean;
  boardCount: number;
  tableCount: number;
  onPick: (mode: BoardMode) => void;
  onClose: () => void;
}) {
  const options: {
    mode: BoardMode;
    icon: typeof Paintbrush;
    title: string;
    body: string;
    /** What is already there, or null when nothing is — an "empty" chip beside
     *  every option on a fresh task was a column of noise saying nothing. */
    state: string | null;
  }[] = [
    {
      mode: 'whiteboard',
      icon: Paintbrush,
      title: 'Whiteboard',
      body: 'Shapes, arrows, text, images and freehand, with selection, layers and zoom. Best for rough journeys and anything you would sketch on a wall.',
      state: boardCount > 0 ? `${boardCount} item${boardCount === 1 ? '' : 's'}` : null,
    },
    {
      mode: 'entities',
      icon: Table2,
      title: 'Entity model',
      body: 'Tables, typed fields, keys and cardinality, built from a form. The picture is generated from the model, so it stays consistent — nothing to align by hand.',
      state: tableCount > 0 ? tableSummary(tableCount) : null,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? 'Open board' : 'New board'}</DialogTitle>
          <DialogDescription>
            Pick how you want to draw it. Both stay on the task, so this is not a one-way door.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {options.map((option) => (
            <button
              key={option.mode}
              type="button"
              onClick={() => onPick(option.mode)}
              className="hover:bg-muted/50 hover:border-foreground/20 flex min-w-0 items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors"
            >
              <option.icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{option.title}</span>
                  {option.state && (
                    <span className="text-muted-foreground ml-auto shrink-0 font-mono text-[10px]">
                      {option.state}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
                  {option.body}
                </span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WhiteboardPanel({
  sessionId,
  project,
  uploadedBy,
  onSaved,
  className,
  whiteboardOnly,
}: {
  /** The same key the reference files use, so boards attach to this task. */
  sessionId: string;
  /** Passed to the board's chat pane, which answers in the project's terms. */
  project: DesignProject;
  uploadedBy: string;
  /** Optional: the task page no longer needs this, since the cards live here. */
  onSaved?: () => void;
  className?: string;
  /** Skip the mode picker and go straight to the whiteboard. */
  whiteboardOnly?: boolean;
}) {
  const [mode, setMode] = useState<BoardMode | null>(null);
  const [picking, setPicking] = useState(false);
  /** The card being edited, when the board was opened from one. */
  const [editing, setEditing] = useState<string | null>(null);
  /**
   * What just happened, said here because the board itself has gone. Carries a way
   * back when the thing that happened was a discard.
   */
  const [flash, setFlash] = useState<{ message: string; restore?: () => void } | null>(null);
  const flashTimer = useRef<number | null>(null);
  /** Bumped when the surface changes underneath, so the counts are re-read. */
  const [rev, setRev] = useState(0);
  /** What is stored for this task. Read after mount — both are workspace state. */
  const [boardCount, setBoardCount] = useState(0);
  const [tableCount, setTableCount] = useState(0);

  // Counted after mount, and again when a board closes, which is the only time
  // either can have changed while this panel was on screen.
  useEffect(() => {
    // A board drawn before the editor changed still counts: its strokes are
    // converted the first time it is opened.
    setBoardCount(sceneCount(sessionId) || loadBoard(sessionId).length);

    setTableCount(parseEntityModel(loadDiagramSource(sessionId)).entities.length);
  }, [sessionId, mode, rev]);

  const announce = (message: string, restore?: () => void) => {
    setFlash({ message, ...(restore ? { restore } : {}) });
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), restore ? 12_000 : 6000);
  };

  /**
   * A save is the end of the sitting: the board closes and its surface is cleared,
   * because the picture is now a card on the task and a second copy of it sitting
   * on the board is just something else to tidy up.
   *
   * Only reached when the save actually worked — a board that could not be stored
   * keeps its window, its message and its drawing.
   */
  const finish = (message: string) => {
    const closing = mode;
    onSaved?.();
    if (closing) clearSurface(closing, sessionId);
    setMode(null);
    setEditing(null);
    setRev((value) => value + 1);
    announce(`${message} The board is clear for the next one.`);
  };

  /**
   * Reopen a card on the board it came from.
   *
   * The card's model goes back onto the working surface, which is empty in the
   * ordinary case because saving clears it — but not always, so whatever was there
   * is snapshotted first and the Undo puts it back. Saving from here updates the
   * card rather than adding a second one beside it.
   */
  const startEdit = (artifact: BoardArtifact) => {
    const target: BoardMode = artifact.kind === 'whiteboard' ? 'whiteboard' : 'entities';
    const restore = snapshot(target, sessionId);
    const displaced = clearSurface(target, sessionId);

    if (artifact.kind === 'whiteboard' && artifact.scene) {
      saveScene(sessionId, { elements: artifact.scene.elements, files: artifact.scene.files });
    } else if (artifact.source !== undefined) {
      saveDiagramSource(sessionId, artifact.source);
    }

    setEditing(artifact.id);
    setMode(target);
    setRev((value) => value + 1);
    if (displaced) {
      announce(`Opened ${artifact.title}. The board's unsaved work was set aside.`, restore);
    } else {
      setFlash(null);
    }
  };

  /**
   * Closed without saving. The surface is cleared for the same reason, but nothing
   * was kept — so this offers the way back, because a stray click on the backdrop
   * should not be able to destroy an afternoon's drawing.
   */
  const dismiss = () => {
    const closing = mode;
    setMode(null);
    setEditing(null);
    if (!closing) return;
    const restore = snapshot(closing, sessionId);
    const had = clearSurface(closing, sessionId);
    setRev((value) => value + 1);
    if (had) {
      announce(closing === 'whiteboard' ? 'Board cleared.' : 'Diagram cleared.', restore);
    } else {
      setFlash(null);
    }
  };

  const undoClear = () => {
    flash?.restore?.();
    setFlash(null);
    setRev((value) => value + 1);
  };

  useEffect(
    () => () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  const waiting = [
    boardCount > 0 ? `a whiteboard (${boardCount} item${boardCount === 1 ? '' : 's'})` : null,
    tableCount > 0 ? `an entity model (${tableSummary(tableCount)})` : null,
  ].filter(Boolean);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Presentation className="size-4" />
        <p className="text-sm font-semibold">Whiteboard</p>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-7 gap-1 px-2 text-xs"
          onClick={() => whiteboardOnly ? setMode('whiteboard') : setPicking(true)}
        >
          <Paintbrush className="size-3" />
          {/* "Draw" was wrong for a section that also writes diagrams. */}
          {waiting.length > 0 ? 'Open board' : 'New board'}
        </Button>
      </div>

      {flash && (
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          {flash.message}
          {flash.restore && (
            <button
              type="button"
              onClick={undoClear}
              className="hover:text-foreground underline underline-offset-2"
            >
              Undo
            </button>
          )}
        </p>
      )}

      <p className="text-muted-foreground text-xs">
        {waiting.length > 0
          ? `Waiting here: ${waiting.join(' and ')}. Open it to carry on, or save what is there.`
          : 'Sketch it by hand on the whiteboard, or build an entity model from a form and let it draw itself. Whatever you save shows up as a card here.'}
      </p>

      {/* What the board made, and the way back into it. */}
      <BoardCards sessionId={sessionId} refreshKey={rev} onEdit={startEdit} />

      <BoardModeDialog
        open={picking}
        existing={waiting.length > 0}
        boardCount={boardCount}
        tableCount={tableCount}
        onPick={(picked) => {
          setMode(picked);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />

      {/* `modal` is off for the whiteboard, and only for it.

          Radix's modal mode wraps the content in react-remove-scroll, which
          blocks wheel and touch scrolling everywhere outside that subtree — and
          Excalidraw portals its own dialogs into `document.body` rather than
          into its container (`useCreatePortalContainer` with no parentSelector),
          so Help and Shortcuts land outside it and cannot be scrolled at all.

          The entity model keeps modal semantics. It is a form, so its focus trap
          is worth more than it is to a canvas that already fills the screen. */}
      <Dialog
        modal={mode !== 'whiteboard'}
        open={mode !== null}
        onOpenChange={(next) => !next && dismiss()}
      >
        {/* The whiteboard takes the whole screen: it is a drawing tool, and every
            edge of a dialog is canvas you do not have. The entity model is a form
            beside a preview and reads better boxed. */}
        <DialogContent
          // Escape belongs to the board while the board is open: it is how you
          // finish a text label or drop a selection in Excalidraw, and it was
          // closing the whole window instead. Use the ✕ to close.
          onEscapeKeyDown={(event) => {
            if (mode === 'whiteboard') event.preventDefault();
          }}
          // The other half of turning `modal` off: Excalidraw's dialogs are
          // portaled to the body, so this dialog counts them as outside itself
          // and a click inside Help would dismiss the whole board. Same rule as
          // Escape above — while the board is open, the ✕ closes it.
          onInteractOutside={(event) => {
            if (mode === 'whiteboard') event.preventDefault();
          }}
          className={cn(
            'flex flex-col overflow-hidden',
            // Both boards are canvases now, and a canvas wants the screen. Undoes
            // the dialog's centred box: no inset, no rounding, no border, and the
            // translate that centres it cancelled.
            'inset-0 top-0 left-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-2 rounded-none border-0 p-4 sm:max-w-none',
          )}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {mode === 'entities' ? (
                <Table2 className="size-4" />
              ) : (
                <Presentation className="size-4" />
              )}
              {mode === 'entities' ? 'Entity model' : 'Whiteboard'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'entities'
                ? 'Arrange tables and join them. Saving keeps the picture and the model as a card on the task.'
                : 'Draw the idea. Saving keeps it as a card on the task.'}
            </DialogDescription>
          </DialogHeader>

          {mode === 'entities' && (
            <EntityCanvas
              sessionId={sessionId}
              project={project}
              uploadedBy={uploadedBy}
              onSaved={finish}
              {...(editing ? { replaceId: editing } : {})}
            />
          )}

          {mode === 'whiteboard' && (
            <ExcalidrawBoard
              sessionId={sessionId}
              project={project}
              uploadedBy={uploadedBy}
              onSaved={finish}
              {...(editing ? { replaceId: editing } : {})}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
