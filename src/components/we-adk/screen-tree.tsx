'use client';

/**
 * The folder-and-file tree the Request tab draws, shared with the Sketcher.
 *
 * Both tabs answer the same question — where does this screen sit — so they
 * draw one tree rather than two that nearly agree. Four near-copies of this
 * existed, and a fix to any one of them kept missing the tab someone was
 * actually looking at.
 *
 * The split is the whole point: a folder only folds, a file only opens. A
 * screen that heads a section is both of those at once, and is handed to this
 * component as a folder holding its own page — a single row that folded and
 * opened together is the thing people kept clicking wrong.
 */

import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, Code2, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/components/ui';

/** A page: a row that opens, and never folds. */
export interface ScreenTreeFile {
  /** Stable key; the row reads as open when it matches `activeKey`. */
  key: string;
  /** What it is called as a file, drawn in mono. */
  fileName: string;
  title?: string;
  /** Dimmed — already filed, or not this meeting's own. */
  muted?: boolean;
  /** Trailing markers, drawn after the name. */
  markers?: ReactNode;
  onOpen: () => void;
}

/** A section: a row that folds, and never opens. */
export interface ScreenTreeFolder {
  /** Stable key, which is also what remembers whether it is folded. */
  path: string;
  name: string;
  title?: string;
  folders: ScreenTreeFolder[];
  files: ScreenTreeFile[];
}

/**
 * Wide as its name, never narrower than the panel: a deep row scrolls sideways
 * instead of eliding, and a short one still highlights the full width.
 */
export function screenTreeRowClass(active: boolean): string {
  return cn(
    'group/folder flex w-max min-w-full items-center gap-1 border-l-2 py-1 pr-1.5 pl-1 text-xs',
    active
      ? 'border-primary bg-muted text-foreground'
      : 'border-transparent text-muted-foreground hover:bg-muted/50',
  );
}

/** How many pages sit at or under a folder. */
export function countFiles(folder: ScreenTreeFolder): number {
  return folder.files.length + folder.folders.reduce((sum, child) => sum + countFiles(child), 0);
}

/** What a screen is called as a file: its route, or its name, made filename-ish. */
export function toFileName(routeOrName: string): string {
  const base = routeOrName
    .trim()
    .replace(/^\//, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${base || 'untitled'}.html`;
}

export interface ScreenTreeProps {
  folders: ScreenTreeFolder[];
  /** Pages with no section of their own. */
  files?: ScreenTreeFile[];
  /** The page currently open, when it is one of these. */
  activeKey?: string | null;
  /** Folder paths that are folded shut. */
  collapsed: Set<string>;
  onToggle: (path: string) => void;
}

export function ScreenTree({
  folders,
  files = [],
  activeKey = null,
  collapsed,
  onToggle,
}: ScreenTreeProps) {
  return (
    <>
      {folders.map((folder) => (
        <FolderRow
          key={folder.path}
          folder={folder}
          activeKey={activeKey}
          collapsed={collapsed}
          onToggle={onToggle}
        />
      ))}
      {files.map((file) => (
        <FileRow key={file.key} file={file} active={file.key === activeKey} />
      ))}
    </>
  );
}

function FolderRow({
  folder,
  activeKey,
  collapsed,
  onToggle,
}: {
  folder: ScreenTreeFolder;
  activeKey: string | null;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
}) {
  const isOpen = !collapsed.has(folder.path);
  return (
    <div>
      <div className={screenTreeRowClass(false)}>
        <button
          type="button"
          onClick={() => onToggle(folder.path)}
          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${folder.name}`}
          aria-expanded={isOpen}
          className="hover:text-foreground shrink-0"
        >
          {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => onToggle(folder.path)}
          title={folder.title ?? folder.name}
          aria-expanded={isOpen}
          className="flex flex-1 items-center gap-1.5 text-left"
        >
          {isOpen ? (
            <FolderOpen className="size-3.5 shrink-0" />
          ) : (
            <Folder className="size-3.5 shrink-0" />
          )}
          <span className="flex-1 whitespace-nowrap">{folder.name}</span>
          <span className="shrink-0 font-mono text-[10px]">{countFiles(folder)}</span>
        </button>
      </div>

      {isOpen && (
        <div className="ml-5 border-l">
          <ScreenTree
            folders={folder.folders}
            files={folder.files}
            activeKey={activeKey}
            collapsed={collapsed}
            onToggle={onToggle}
          />
        </div>
      )}
    </div>
  );
}

function FileRow({ file, active }: { file: ScreenTreeFile; active: boolean }) {
  return (
    <div className={screenTreeRowClass(active)}>
      <button
        type="button"
        onClick={file.onOpen}
        title={file.title ?? file.fileName}
        className={cn(
          'flex flex-1 items-center gap-1 py-1 pl-2 text-xs',
          active ? 'font-medium' : 'hover:text-foreground',
        )}
      >
        <Code2 className={cn('size-3.5 shrink-0', file.muted && 'opacity-50')} />
        <span
          className={cn(
            'flex-1 whitespace-nowrap text-left font-mono',
            file.muted && 'opacity-50',
          )}
        >
          {file.fileName}
        </span>
        {file.markers}
      </button>
    </div>
  );
}
