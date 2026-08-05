'use client';

import { Suspense } from 'react';
import { SketcherEditor } from '@/components/we-adk/sketcher-editor';

/**
 * Full-screen canvas, for screens that have no workspace to sit in — Builder
 * mockups and captured production screens. A project's design files open in the
 * Business workspace instead, where the explorer stays put.
 *
 * useSearchParams needs a Suspense boundary, so the route just wraps the editor.
 */
export default function SketcherPage() {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground flex h-[60vh] items-center justify-center text-sm">
          Loading canvas…
        </div>
      }
    >
      <SketcherEditor />
    </Suspense>
  );
}
