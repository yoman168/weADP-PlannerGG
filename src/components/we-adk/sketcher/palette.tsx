'use client';

import { useDraggable } from '@dnd-kit/core';
import {
  AlignLeft,
  Calendar,
  CalendarRange,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleDot,
  Gauge,
  Heading,
  Inbox,
  LayoutTemplate,
  Minus,
  MousePointerClick,
  Rows3,
  Search,
  SquareStack,
  Tag,
  TextCursorInput,
  ToggleLeft,
  Type as TypeIcon,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/components/ui';
import {
  BLOCK_CATALOG,
  PALETTE_GROUPS,
  PATTERN_CATALOG,
  type BlockKind,
  type IconKey,
  type PaletteEntry,
} from '@/lib/we-adk-mock/sketcher';

export const PALETTE_DRAG_PREFIX = 'palette:';

const ICONS: Record<IconKey, typeof TypeIcon> = {
  heading: Heading,
  text: AlignLeft,
  caption: TypeIcon,
  divider: Minus,
  spacer: Rows3,
  input: TextCursorInput,
  textarea: AlignLeft,
  select: ChevronsUpDown,
  search: Search,
  calendar: Calendar,
  range: CalendarRange,
  radio: CircleDot,
  checkbox: CheckSquare,
  switch: ToggleLeft,
  segment: SquareStack,
  button: MousePointerClick,
  table: Rows3,
  stat: Gauge,
  keyValue: AlignLeft,
  empty: Inbox,
  tabs: SquareStack,
  badge: Tag,
  progress: Gauge,
  pattern: LayoutTemplate,
};

function entryMeta(entry: PaletteEntry): { id: string; label: string; icon: IconKey } {
  if (entry.type === 'pattern') {
    const pattern = PATTERN_CATALOG.find((item) => item.id === entry.patternId);
    return {
      id: `pattern:${entry.patternId}`,
      label: pattern?.label ?? entry.patternId,
      icon: 'pattern',
    };
  }
  const definition = BLOCK_CATALOG[entry.kind];
  return { id: `block:${entry.kind}`, label: definition.label, icon: definition.icon };
}

function PaletteItem({ entry, onQuickAdd }: { entry: PaletteEntry; onQuickAdd: () => void }) {
  const meta = entryMeta(entry);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${PALETTE_DRAG_PREFIX}${meta.id}`,
    data: { palette: meta.id },
  });
  const Icon = ICONS[meta.icon];

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={onQuickAdd}
      title={`Drag onto the canvas, or click to append`}
      className={cn(
        'text-muted-foreground hover:bg-muted hover:text-foreground flex w-full cursor-grab items-center gap-2 rounded px-2 py-1.5 text-left text-xs active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{meta.label}</span>
    </button>
  );
}

export function Palette({
  onAddBlock,
  onAddPattern,
}: {
  onAddBlock: (kind: BlockKind) => void;
  onAddPattern: (patternId: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(PALETTE_GROUPS.filter((group) => group.defaultExpanded).map((group) => group.label)),
  );

  const toggle = (label: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-0.5 px-2 py-2">
      <p className="text-muted-foreground px-2 pb-1 text-[10px] leading-relaxed">
        Drag a block onto the canvas, or click to append it.
      </p>
      {PALETTE_GROUPS.map((group) => {
        const isOpen = expanded.has(group.label);
        return (
          <div key={group.label}>
            <button
              type="button"
              onClick={() => toggle(group.label)}
              aria-expanded={isOpen}
              className="hover:bg-muted flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-sm font-medium"
            >
              {isOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              {group.label}
              <span className="text-muted-foreground ml-auto text-[10px]">
                {group.entries.length}
              </span>
            </button>
            {isOpen && (
              <div className="flex flex-col gap-0.5 py-0.5 pl-4">
                {group.entries.map((entry) => (
                  <PaletteItem
                    key={entryMeta(entry).id}
                    entry={entry}
                    onQuickAdd={() =>
                      entry.type === 'pattern'
                        ? onAddPattern(entry.patternId)
                        : onAddBlock(entry.kind)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
