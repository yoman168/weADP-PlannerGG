'use client';

import { Suspense, type ReactNode } from 'react';
import { BusinessWorkspace } from '@/components/we-adk/business-workspace';

/**
 * Toolbar and version explorer for the Business workspace. Living in a layout is
 * the point: navigating between the file table and an open design file swaps only
 * the pane on the right, so the explorer keeps its scroll position and its
 * expanded folders.
 *
 * The board is deliberately outside this group — it carries its own chrome.
 */
export default function BusinessWorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground py-16 text-center text-sm">Loading project…</p>}
    >
      <BusinessWorkspace>{children}</BusinessWorkspace>
    </Suspense>
  );
}
