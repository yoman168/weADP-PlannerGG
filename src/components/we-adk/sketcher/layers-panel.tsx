'use client';

import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input, cn } from '@/components/ui';
import { useLocale } from '@/lib/locale';
import { type CanvasBlock } from '@/lib/we-adk-mock/sketcher';

export const LAYER_DRAG_PREFIX = 'layer:';

function LayerRow({
  block,
  selected,
  onSelect,
  onRename,
  onToggleHidden,
  onDelete,
}: {
  block: CanvasBlock;
  selected: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onToggleHidden: () => void;
  onDelete: () => void;
}) {
  const { t } = useLocale();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${LAYER_DRAG_PREFIX}${block.id}`,
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== block.name) onRename(trimmed);
    else setDraft(block.name);
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-center gap-1 rounded px-1 py-1 text-xs',
        selected ? 'bg-primary/10 text-key-accent' : 'hover:bg-muted',
        isDragging && 'opacity-40',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t('misc.dragToReorder')}
        className="text-muted-foreground/60 hover:text-foreground shrink-0 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="size-3" />
      </button>

      {editing ? (
        <Input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitRename();
            if (event.key === 'Escape') {
              setDraft(block.name);
              setEditing(false);
            }
          }}
          className="h-6 flex-1 px-1 text-xs"
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={() => {
            setDraft(block.name);
            setEditing(true);
          }}
          className={cn('flex-1 truncate text-left', block.hidden && 'line-through opacity-50')}
          title={t('misc.clickToSelect')}
        >
          {block.name}
        </button>
      )}

      <button
        type="button"
        aria-label={block.hidden ? t('misc.showBlock') : t('misc.hideBlock')}
        onClick={onToggleHidden}
        className={cn(
          'text-muted-foreground hover:text-foreground shrink-0 p-0.5',
          !block.hidden && 'opacity-0 group-hover:opacity-100',
        )}
      >
        {block.hidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
      </button>
      <button
        type="button"
        aria-label={t('misc.deleteBlock')}
        onClick={onDelete}
        className="text-muted-foreground hover:text-destructive shrink-0 p-0.5 opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

export function LayersPanel({
  blocks,
  selectedId,
  onSelect,
  onRename,
  onToggleHidden,
  onDelete,
}: {
  blocks: CanvasBlock[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onToggleHidden: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (blocks.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-8 text-center text-xs">
        No layers yet. Add a block from the Blocks tab.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-2 py-2">
      <p className="text-muted-foreground px-1 pb-1 text-[10px]">
        Drag to reorder · double-click to rename
      </p>
      <SortableContext
        items={blocks.map((block) => `${LAYER_DRAG_PREFIX}${block.id}`)}
        strategy={verticalListSortingStrategy}
      >
        {blocks.map((block) => (
          <LayerRow
            key={block.id}
            block={block}
            selected={block.id === selectedId}
            onSelect={() => onSelect(block.id)}
            onRename={(name) => onRename(block.id, name)}
            onToggleHidden={() => onToggleHidden(block.id)}
            onDelete={() => onDelete(block.id)}
          />
        ))}
      </SortableContext>
    </div>
  );
}
