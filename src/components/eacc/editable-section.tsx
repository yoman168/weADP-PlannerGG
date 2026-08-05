'use client';

import { Eye, EyeOff, Settings2, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Badge, Button, Input, Label, Separator, Switch, cn } from '@/components/ui';
import {
  useEdit,
  type CardConfig,
  type ColumnConfig,
  type FilterConfig,
  type SectionConfig,
} from './edit-context';

/* ------------------------------------------------------------------ */
/* EditableSection                                                      */
/* ------------------------------------------------------------------ */

interface EditableSectionProps {
  id: string;
  defaults: SectionConfig;
  children: ReactNode;
  className?: string;
}

/**
 * Registers a section and hands back the layout that is actually in force —
 * the defaults it ships with, plus whatever has been edited on top.
 *
 * A screen reads its own title, columns and filters through this, so an edit in
 * the properties panel changes the screen rather than just the panel.
 */
export function useSectionConfig(id: string, defaults: SectionConfig): SectionConfig {
  const { registerSection, getSection } = useEdit();

  useEffect(() => {
    registerSection(id, defaults);
  }, [id, defaults, registerSection]);

  return getSection(id) ?? defaults;
}

/** Is this column switched on? Unknown keys stay visible. */
export function columnOn(config: SectionConfig, key: string): boolean {
  return config.columns?.find((column) => column.key === key)?.visible ?? true;
}

/** The column's heading, renamed if someone renamed it. */
export function columnLabel(config: SectionConfig, key: string, fallback = ''): string {
  return config.columns?.find((column) => column.key === key)?.label ?? fallback;
}

/** Is this filter switched on? */
export function filterOn(config: SectionConfig, key: string): boolean {
  return config.filters?.find((filter) => filter.key === key)?.visible ?? true;
}

/** Is this summary card switched on? */
export function cardOn(config: SectionConfig, key: string): boolean {
  return config.cards?.find((card) => card.key === key)?.visible ?? true;
}

/** The card's caption, renamed if someone renamed it. */
export function cardLabel(config: SectionConfig, key: string, fallback = ''): string {
  return config.cards?.find((card) => card.key === key)?.label ?? fallback;
}

export function EditableSection({ id, defaults, children, className }: EditableSectionProps) {
  const { editMode, selectedId, setSelectedId, registerSection, getSection } = useEdit();

  useEffect(() => {
    registerSection(id, defaults);
  }, [id, defaults, registerSection]);

  const config = getSection(id) ?? defaults;
  if (!config.visible && !editMode) return null;

  if (!editMode) {
    return <div className={className}>{children}</div>;
  }

  const isSelected = selectedId === id;

  return (
    <div
      className={cn(
        'group relative cursor-pointer rounded-lg transition-all',
        isSelected
          ? 'ring-2 ring-blue-500 ring-offset-2'
          : 'hover:ring-2 hover:ring-blue-300 hover:ring-offset-1',
        !config.visible && 'opacity-50',
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedId(isSelected ? null : id);
      }}
    >
      {/* Edit badge */}
      <div
        className={cn(
          'absolute -top-2.5 right-2 z-10 flex items-center gap-1 rounded-full border bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm transition-opacity',
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        <Settings2 className="size-2.5" />
        {config.label ?? defaults.label ?? 'Section'}
      </div>

      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PropertiesPanel                                                      */
/* ------------------------------------------------------------------ */

export function PropertiesPanel() {
  const {
    editMode,
    selectedId,
    setSelectedId,
    getSection,
    updateSection,
    updateColumn,
    updateCard,
    updateFilter,
  } = useEdit();

  if (!editMode || !selectedId) return null;

  const config = getSection(selectedId);
  if (!config) return null;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l bg-background">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Settings2 className="text-primary size-4" />
          <span className="text-sm font-semibold">Properties</span>
        </div>
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Section label */}
        <div>
          <p className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wider">
            Section
          </p>
          <Badge variant="secondary" className="text-xs">
            {config.label ?? selectedId}
          </Badge>
        </div>

        <Separator />

        {/* Visibility */}
        <div className="flex items-center justify-between">
          <Label className="text-sm">Visible</Label>
          <Switch
            checked={config.visible}
            onCheckedChange={(v) => updateSection(selectedId, { visible: v })}
          />
        </div>

        {/* Header fields */}
        {config.sectionType === 'header' && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                Content
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Title</Label>
                <Input
                  value={config.title ?? ''}
                  onChange={(e) => updateSection(selectedId, { title: e.target.value })}
                  className="h-8 text-sm"
                  placeholder="Page title"
                />
              </div>
              {config.subtitle !== undefined && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Subtitle</Label>
                  <Input
                    value={config.subtitle}
                    onChange={(e) => updateSection(selectedId, { subtitle: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="Subtitle text"
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Table columns */}
        {config.sectionType === 'table' && config.columns && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                Columns
              </p>
              {config.columns.map((col) => (
                <ColumnRow
                  key={col.key}
                  col={col}
                  onVisibilityChange={(v) => updateColumn(selectedId, col.key, { visible: v })}
                  onLabelChange={(label) => updateColumn(selectedId, col.key, { label })}
                />
              ))}
            </div>
          </>
        )}

        {/* Stats cards */}
        {config.sectionType === 'stats' && config.cards && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                Cards
              </p>
              {config.cards.map((card) => (
                <CardRow
                  key={card.key}
                  card={card}
                  onVisibilityChange={(v) => updateCard(selectedId, card.key, { visible: v })}
                  onLabelChange={(label) => updateCard(selectedId, card.key, { label })}
                />
              ))}
            </div>
          </>
        )}

        {/* Filters */}
        {config.sectionType === 'filters' && config.filters && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                Filters
              </p>
              {config.filters.map((filter) => (
                <FilterRow
                  key={filter.key}
                  filter={filter}
                  onVisibilityChange={(v) => updateFilter(selectedId, filter.key, { visible: v })}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Row components                                                       */
/* ------------------------------------------------------------------ */

function ColumnRow({
  col,
  onVisibilityChange,
  onLabelChange,
}: {
  col: ColumnConfig;
  onVisibilityChange: (v: boolean) => void;
  onLabelChange: (label: string) => void;
}) {
  return (
    <div className={cn('space-y-1.5 rounded-md border p-2', !col.visible && 'opacity-50')}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{col.key}</span>
        <button
          type="button"
          onClick={() => onVisibilityChange(!col.visible)}
          className="text-muted-foreground hover:text-foreground"
        >
          {col.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </button>
      </div>
      <Input
        value={col.label}
        onChange={(e) => onLabelChange(e.target.value)}
        className="h-6 text-xs"
        disabled={!col.visible}
      />
    </div>
  );
}

function CardRow({
  card,
  onVisibilityChange,
  onLabelChange,
}: {
  card: CardConfig;
  onVisibilityChange: (v: boolean) => void;
  onLabelChange: (label: string) => void;
}) {
  return (
    <div
      className={cn('flex items-center gap-2 rounded-md border p-2', !card.visible && 'opacity-50')}
    >
      <button
        type="button"
        onClick={() => onVisibilityChange(!card.visible)}
        className="text-muted-foreground hover:text-foreground shrink-0"
      >
        {card.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      </button>
      <Input
        value={card.label}
        onChange={(e) => onLabelChange(e.target.value)}
        className="h-6 flex-1 text-xs"
        disabled={!card.visible}
      />
    </div>
  );
}

function FilterRow({
  filter,
  onVisibilityChange,
}: {
  filter: FilterConfig;
  onVisibilityChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-2">
      <span className={cn('text-xs', !filter.visible && 'text-muted-foreground line-through')}>
        {filter.label}
      </span>
      <Switch checked={filter.visible} onCheckedChange={onVisibilityChange} className="scale-75" />
    </div>
  );
}
