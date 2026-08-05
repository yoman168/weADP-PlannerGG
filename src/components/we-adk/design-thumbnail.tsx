'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/components/ui';
import { BlockPreview } from '@/components/we-adk/sketcher/block-preview';
import { loadScreenBlocks, type CanvasBlock } from '@/lib/we-adk-mock/sketcher';

/** The width a canvas is drawn at, before it is scaled down to fit a card. */
const AUTHOR_WIDTH = 1024;

/**
 * A design at postage-stamp size — the real blocks, drawn at author width and
 * scaled down, the same way the board draws its frames. It is the fastest way
 * to see whether a proposed screen is the screen you meant.
 *
 * Blocks live in localStorage, so they arrive after mount; until then the card
 * holds its space rather than jumping.
 */
export function DesignThumbnail({
  screenId,
  width = 320,
  height = 200,
  blocks,
  className,
}: {
  screenId: string;
  width?: number;
  height?: number;
  /** Pass blocks in to skip the read — otherwise they load from the canvas. */
  blocks?: CanvasBlock[];
  className?: string;
}) {
  const [loaded, setLoaded] = useState<CanvasBlock[] | null>(blocks ?? null);

  useEffect(() => {
    if (blocks) {
      setLoaded(blocks);
      return;
    }
    setLoaded(loadScreenBlocks(screenId, 'listPage'));
  }, [screenId, blocks]);

  const visible = (loaded ?? []).filter((block) => !block.hidden);

  return (
    <div
      style={{ width, height }}
      className={cn('bg-background relative shrink-0 overflow-hidden rounded-md border', className)}
    >
      {loaded === null ? (
        <div className="text-muted-foreground flex h-full items-center justify-center text-[11px]">
          Loading…
        </div>
      ) : visible.length === 0 ? (
        <div className="text-muted-foreground flex h-full items-center justify-center text-[11px]">
          Empty screen
        </div>
      ) : (
        <div
          aria-hidden
          className="pointer-events-none flex flex-col gap-3 p-5"
          style={{
            width: AUTHOR_WIDTH,
            transform: `scale(${width / AUTHOR_WIDTH})`,
            transformOrigin: 'top left',
          }}
        >
          {visible.map((block) => (
            <BlockPreview key={block.id} block={block} />
          ))}
        </div>
      )}
      {/* The screen is taller than the card; fade the cut rather than slice it. */}
      <span className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t to-transparent" />
    </div>
  );
}
