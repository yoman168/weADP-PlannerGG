'use client';

/**
 * Main's Screen Flow view — the round's screens as the diagram they make.
 *
 * Deliberately outside the `(workspace)` group, the same way the board is: a
 * flow diagram wants the whole width, and inside that group it would be sharing
 * the row with a 16rem explorer and the chat aside. The rounds rail and tab bar
 * still come from the Business layout above, so this reads as Main rather than
 * as somewhere else.
 */

import { Suspense } from 'react';
import { IAScreenFlowPane } from '@/components/we-adk/ia-screen-flow-pane';

export default function MainFlowPage() {
  return (
    <Suspense>
      <IAScreenFlowPane />
    </Suspense>
  );
}
