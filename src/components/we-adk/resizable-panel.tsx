'use client';

/**
 * A side panel the reader can widen by dragging its border.
 *
 * The versions rail could already be dragged, and the explorer trees could
 * not — same problem, since a name is as long as somebody decided to make it
 * and no fixed width is right for every project. The trees make it worse: they
 * nest, so depth eats the width before the name does. This is the rail's
 * handle, lifted out so all three behave the same way and there is one place
 * to fix how a panel resizes.
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/components/ui';
import { workspaceStore } from '@/lib/api/workspace-store';

/** How far one arrow-key press moves the border. */
const KEYBOARD_STEP = 16;

/**
 * A panel's width, remembered.
 *
 * Kept per key and globally rather than per project: it is a preference about
 * this person's screen, not a fact about the work. Read after mount, like
 * everything else out of storage, so the server pass and the first client
 * render agree on the default.
 */
function usePanelWidth(
  storageKey: string | undefined,
  defaultWidth: number,
  minWidth: number,
  maxWidth: number,
): [number, (next: number) => void, (next: number) => void] {
  const [width, setWidth] = useState(defaultWidth);
  const clamp = useCallback(
    (value: number) => Math.min(Math.max(Math.round(value), minWidth), maxWidth),
    [minWidth, maxWidth],
  );

  // Plain numbers as the dependencies, so this reads storage once rather than
  // on every render — re-reading mid-drag would snap the border back.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const parsed = Number(workspaceStore.getItem(storageKey));
      if (Number.isFinite(parsed) && parsed > 0) setWidth(clamp(parsed));
    } catch {
      // Storage unavailable — the default width is a fine answer.
    }
  }, [storageKey, clamp]);

  /** While dragging: on screen only, so a drag is not a hundred writes. */
  const preview = (next: number) => setWidth(clamp(next));

  /** On release: this is the width from now on. */
  const commit = (next: number) => {
    const value = clamp(next);
    setWidth(value);
    if (!storageKey) return;
    try {
      workspaceStore.setItem(storageKey, String(value));
    } catch {
      // Storage unavailable — it just will not survive a reload.
    }
  };

  return [width, preview, commit];
}

export interface ResizablePanelProps {
  /** Width before anyone drags, and the width a double-click returns to. */
  defaultWidth: number;
  /** Narrow enough to get out of the way, wide enough to still read a name. */
  minWidth?: number;
  maxWidth?: number;
  /** Where the chosen width is remembered. Omitted, it lasts for the visit. */
  storageKey?: string;
  /** Which edge carries the handle — the free one, away from the window. */
  side?: 'right' | 'left';
  className?: string;
  /** Names the handle for anyone resizing it by keyboard. */
  label?: string;
  /** The landmark this panel is, for panels that are one. */
  as?: 'div' | 'nav' | 'aside';
  'aria-label'?: string;
  children: ReactNode;
}

export function ResizablePanel({
  defaultWidth,
  minWidth = 160,
  maxWidth = 560,
  storageKey,
  side = 'right',
  className,
  label = 'panel',
  as: Tag = 'div',
  'aria-label': ariaLabel,
  children,
}: ResizablePanelProps) {
  const [width, previewWidth, commitWidth] = usePanelWidth(
    storageKey,
    defaultWidth,
    minWidth,
    maxWidth,
  );
  /** Where the drag started, so the border tracks the cursor from there. */
  const drag = useRef<{ x: number; width: number } | null>(null);

  /** Rightwards widens a left-hand panel and narrows a right-hand one. */
  const widthAt = (clientX: number) => {
    const start = drag.current;
    if (!start) return width;
    const moved = clientX - start.x;
    return start.width + (side === 'right' ? moved : -moved);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      commitWidth(widthAt(event.clientX));
      drag.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <Tag aria-label={ariaLabel} style={{ width }} className={cn('relative shrink-0', className)}>
      {children}

      {/* The drag handle: a hair of hit area straddling the border, so the
          border itself is what you reach for. It is a `separator` with a value
          rather than a bare div — the width is adjustable, and a pointer is not
          the only way people adjust things, so the arrow keys move it too. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${label}`}
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        style={{ touchAction: 'none' }}
        onPointerDown={(event) => {
          // Stops the drag selecting the panel's text on its way past.
          event.preventDefault();
          drag.current = { x: event.clientX, width };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current) previewWidth(widthAt(event.clientX));
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => commitWidth(defaultWidth)}
        onKeyDown={(event) => {
          const grow = side === 'right' ? 'ArrowRight' : 'ArrowLeft';
          const shrink = side === 'right' ? 'ArrowLeft' : 'ArrowRight';
          if (event.key === grow) commitWidth(width + KEYBOARD_STEP);
          else if (event.key === shrink) commitWidth(width - KEYBOARD_STEP);
          else if (event.key === 'Home') commitWidth(minWidth);
          else if (event.key === 'End') commitWidth(maxWidth);
          else if (event.key === 'Enter') commitWidth(defaultWidth);
          else return;
          event.preventDefault();
        }}
        className={cn(
          'hover:bg-primary/30 focus-visible:bg-primary/40 absolute inset-y-0 z-20 w-2 cursor-col-resize transition-colors focus-visible:outline-none',
          side === 'right' ? '-right-1' : '-left-1',
        )}
      />
    </Tag>
  );
}
