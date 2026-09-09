'use client';

import { MessageSquare, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/components/ui';

const MIN_WIDTH = 320;
const MAX_WIDTH = 720;
const DEFAULT_WIDTH = 416; // 26rem

/**
 * A collapsible right-side AI chat panel with a floating toggle button.
 *
 * When closed: content gets full width, a floating "AI Chat" button sits on the
 * right edge. When open: chat panel slides in beside the content with its own
 * header and close button, separated by a border. The left edge is draggable
 * to resize the panel.
 */
export function CollapsibleChatAside({
  open,
  onToggle,
  children,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      startX.current = e.clientX;
      startW.current = width;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [width],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    // Dragging left = wider (because panel is on the right)
    const delta = startX.current - e.clientX;
    setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW.current + delta)));
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title="Open AI chat"
        aria-label="Open AI chat"
        className="fixed right-6 bottom-6 z-40 flex items-center gap-2 rounded-full border bg-background px-3.5 py-2 shadow-lg transition-colors hover:bg-muted"
      >
        <MessageSquare className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium">AI Chat</span>
      </button>
    );
  }

  return (
    <aside
      style={{ width }}
      className={cn(
        'bg-background relative flex shrink-0 flex-col border-l',
        className,
      )}
    >
      {/* Resize handle */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="absolute inset-y-0 -left-1 z-50 w-2 cursor-col-resize select-none hover:bg-primary/10 active:bg-primary/20"
      />
      <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">AI Chat</span>
        <button
          type="button"
          onClick={onToggle}
          title="Close chat"
          aria-label="Close chat"
          className="text-muted-foreground hover:text-foreground rounded p-0.5"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </aside>
  );
}
