'use client';

/**
 * Saying what a control opens, wherever the screen is being read.
 *
 * The wiring lives in the page as `data-screen="<screen name>"`, so it travels
 * with the file: a screen wired in a Customer meeting arrives in Request wired,
 * and reaches Main the same way. What does not travel is the chance to fix it —
 * the meeting is often finished by the time someone notices a dead sidebar, and
 * "go back to the Customer project and regenerate" is not a repair.
 *
 * So the same gesture works in every tab that shows a screen: turn on wiring,
 * click the control, pick what it opens. This is the picker half of it; the
 * outlining half is `pick` on the preview surface.
 */

import { useMemo } from 'react';
import { Link2 } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, cn } from '@/components/ui';
import { listPageControls, setPageControlTargets } from '@/lib/we-adk/mockup-pages';
import { loadDesignHtml } from '@/lib/we-adk/design-html';
import { workspaceStore } from '@/lib/api/workspace-store';

export interface LinkTarget {
  id: string;
  name: string;
  /** Shown beside the name, so a popup is not mistaken for a page. */
  kind?: string;
}

/**
 * Writes what one control opens, into the page itself.
 *
 * The stored page is the only copy that every preview reads, so this is both
 * the save and the publish. The event is what tells the surfaces on screen to
 * re-read it.
 */
export function saveScreenLink(screenId: string, index: number, name: string): boolean {
  const html = loadDesignHtml(screenId);
  if (!html) return false;
  try {
    workspaceStore.setItem(
      `we-adk:design-html:${screenId}`,
      setPageControlTargets(html, { [index]: name }),
    );
  } catch {
    return false;
  }
  window.dispatchEvent(new Event('we-adk:html-updated'));
  return true;
}

export function ScreenLinkPicker({
  screenId,
  index,
  targets,
  onClose,
  onSaved,
}: {
  screenId: string;
  /** The control that was clicked, by its ordinal in the page. */
  index: number;
  /** The screens it could open. */
  targets: LinkTarget[];
  onClose: () => void;
  onSaved?: (name: string) => void;
}) {
  const control = useMemo(() => {
    const html = loadDesignHtml(screenId);
    return html ? listPageControls(html).find((entry) => entry.index === index) : undefined;
  }, [screenId, index]);

  const save = (name: string) => {
    if (saveScreenLink(screenId, index, name)) onSaved?.(name);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Link2 className="size-4" />
            What does this open?
          </DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground shrink-0 truncate text-xs" title={control?.label}>
          {control?.label ?? 'That control'}
          {control?.tag ? ` · ${control.tag}` : ''}
        </p>

        <div className="flex min-h-0 flex-col gap-1 overflow-auto pr-0.5">
          {targets.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-xs">
              No other screen to open.
            </p>
          ) : (
            targets.map((target) => (
              <button
                key={target.id}
                type="button"
                onClick={() => save(target.name)}
                className={cn(
                  'hover:border-primary hover:bg-primary/5 flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  control?.opens === target.name && 'border-primary bg-primary/5 font-medium',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{target.name}</span>
                {target.kind && target.kind !== 'Screen' && (
                  <span className="text-muted-foreground shrink-0 text-[10px]">{target.kind}</span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => save('')}>
            Opens nothing
          </Button>
          <span className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
