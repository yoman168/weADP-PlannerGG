'use client';

/**
 * The app frame a generated screen sits in.
 *
 * A screen drawn as a bare column of blocks reads as a fragment. Real products
 * have a name, a sidebar and a current place in it, and a mockup that shows
 * none of those does not look like the thing being designed.
 *
 * `DesignChromeFrame` already does this for the app's own pages, but it is the
 * eACC nav specifically — the right frame for a prototype of that app and the
 * wrong one for a customer's POS. This draws the frame the screen itself
 * carries, in an `appShell` block, so it can be edited like any other block
 * rather than being a property of which route the file happens to be for.
 */

import { cn } from '@/components/ui';
import type { CanvasBlock, PairEntry } from '@/lib/we-adk-mock/sketcher';

/** One nav heading and the items filed under it. */
export interface ShellGroup {
  label: string;
  items: string[];
}

/**
 * Splits a screen into its frame and its contents.
 *
 * The first `appShell` wins; a second one is left in the content stack, where
 * it draws as a plain sidebar card. That is deliberate — silently dropping a
 * block the canvas holds would make it impossible to delete.
 */
export function splitShell(blocks: CanvasBlock[]): {
  shell: CanvasBlock | null;
  content: CanvasBlock[];
} {
  const index = blocks.findIndex((block) => block.kind === 'appShell' && !block.hidden);
  if (index === -1) return { shell: null, content: blocks };
  return {
    shell: blocks[index] ?? null,
    content: blocks.filter((_, position) => position !== index),
  };
}

/** Consecutive pairs sharing a key are one group, in the order given. */
export function shellGroups(pairs: PairEntry[] | undefined): ShellGroup[] {
  const groups: ShellGroup[] = [];
  for (const pair of pairs ?? []) {
    const heading = (pair.key ?? '').trim();
    const item = (pair.value ?? '').trim();
    if (!item) continue;
    const last = groups[groups.length - 1];
    if (last && last.label === heading) last.items.push(item);
    else groups.push({ label: heading, items: [item] });
  }
  return groups;
}

/** The app's initial, standing in for a logo nobody has drawn yet. */
function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || 'A';
}

export function ScreenShell({
  block,
  selected,
  onSelect,
  children,
  className,
}: {
  block: CanvasBlock;
  /** Whether the sidebar is the current selection in the editor. */
  selected?: boolean;
  /** Click the sidebar to edit it. Omitted in preview, where nothing selects. */
  onSelect?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const name = block.props.label?.trim() || 'App';
  const groups = shellGroups(block.props.pairs);
  // A flat counter across groups, so `activeIndex` means the nth nav item
  // rather than the nth item of some group.
  const active = typeof block.props.activeIndex === 'number' ? block.props.activeIndex : 0;
  let counter = -1;

  return (
    /*
     * A floor under the whole frame, not just the content: the sidebar is a
     * fixed width, so in a narrow pane — the editor with its inspector open —
     * a flexible content column would be squeezed to nothing and the screen
     * would read as a sidebar and no screen. Below this the frame scrolls
     * sideways in whatever is holding it instead.
     */
    <div className={cn('bg-background flex min-h-0 min-w-[640px] flex-1', className)}>
      <aside
        // The sidebar is a block, so in the editor it selects like one. It is
        // not a button: it wraps the nav, and a button around a list of
        // buttons is invalid markup.
        role={onSelect ? 'button' : undefined}
        tabIndex={onSelect ? 0 : undefined}
        onClick={
          onSelect
            ? (event) => {
                event.stopPropagation();
                onSelect();
              }
            : undefined
        }
        onKeyDown={
          onSelect
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect();
                }
              }
            : undefined
        }
        className={cn(
          'flex w-56 shrink-0 flex-col gap-5 border-r bg-[#fbfbfc] py-4 dark:bg-[#0f131a]',
          onSelect && 'cursor-pointer',
          selected && 'ring-primary/60 ring-2 ring-inset',
        )}
      >
        <div className="flex items-center gap-2.5 px-4">
          <span className="bg-foreground text-background flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold">
            {initialOf(name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight">{name}</p>
            {block.props.subtitle && (
              <p className="text-muted-foreground truncate text-[10px]">{block.props.subtitle}</p>
            )}
          </div>
        </div>

        <nav className="flex flex-col gap-4">
          {groups.map((group, groupIndex) => (
            <div key={`${group.label}-${groupIndex}`} className="flex flex-col gap-0.5">
              {group.label && (
                <p className="text-muted-foreground px-4 pb-1 text-[10px] font-semibold tracking-wider uppercase">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                counter += 1;
                const isActive = counter === active;
                return (
                  <span
                    key={`${item}-${counter}`}
                    className={cn(
                      'mx-2 truncate rounded-md px-2.5 py-1.5 text-[13px]',
                      isActive
                        ? 'bg-foreground/[0.06] text-foreground font-semibold'
                        : 'text-muted-foreground',
                    )}
                  >
                    {item}
                  </span>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 overflow-auto bg-[#f7f8fa] dark:bg-[#0b0e14]">{children}</div>
    </div>
  );
}
