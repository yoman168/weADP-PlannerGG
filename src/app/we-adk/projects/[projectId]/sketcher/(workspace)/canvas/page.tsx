'use client';

import { Suspense } from 'react';
import { SketcherEditor } from '@/components/we-adk/sketcher-editor';

/**
 * A design file opened from the explorer. The workspace layout keeps the project
 * nav and the file tree on screen; only this pane changes.
 */
export default function BusinessCanvasPage() {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
          Loading canvas…
        </div>
      }
    >
      <SketcherEditor embedded />
    </Suspense>
  );
}
