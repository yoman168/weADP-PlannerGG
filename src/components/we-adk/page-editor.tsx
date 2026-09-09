'use client';

/**
 * Editing the generated page itself.
 *
 * A generated screen is a document, not a tree of blocks. Anyone who wants to
 * shorten a heading, recolour a button or drop a section is describing an edit
 * to that document, and routing it through a block schema loses whatever the
 * schema has no word for. So this edits the document: the page renders in an
 * iframe, clicking picks the element under the cursor, typing changes it in
 * place, and Save serialises the live DOM back to HTML.
 *
 * Two things are easy to get wrong here and both have bitten this file:
 *
 * - The DOM is the truth, not any string the component holds. An earlier
 *   version cleaned up a copy of the *original* HTML on save, so everything
 *   typed into the page was silently thrown away. `serialize` reads the
 *   document.
 * - Undo must not reload the frame. Re-setting `srcDoc` flashes, scrolls back
 *   to the top and drops focus. Snapshots are `documentElement.innerHTML` and
 *   are restored in place; the listeners are delegated on the document, so
 *   they survive the swap.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronRight,
  Copy,
  CornerLeftUp,
  Hand,
  Italic,
  Loader2,
  Monitor,
  MoveDown,
  MoveUp,
  Palette,
  Plus,
  Redo2,
  Save,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Type,
  Underline,
  Undo2,
} from 'lucide-react';
import { Button, cn } from '@/components/ui';
import { claudeHeaders } from '@/lib/we-adk/claude-account';
import { readChatEvent } from '@/components/we-adk/claude-chat';

/* ------------------------------------------------------------------ */
/* Page plumbing                                                       */
/* ------------------------------------------------------------------ */

/** Marks everything this editor adds to the page, so save can take it out. */
const MARK = 'data-page-editor';
const SELECTED = 'page-editor-selected';
const HOVER = 'page-editor-hover';

const OVERLAY_CSS = `
  .${HOVER} { outline: 1px dashed #60a5fa !important; outline-offset: 1px; }
  .${SELECTED} { outline: 2px solid #3b82f6 !important; outline-offset: 1px; }
  .${SELECTED}[contenteditable="true"] { cursor: text; }
  [${MARK}-empty] { min-height: 1.2em; }
  /* Clicking through the page: no editor marks, and the page's own cursors. */
  html[${MARK}-interact] .${HOVER},
  html[${MARK}-interact] .${SELECTED} { outline: none !important; }
`;

/** Structural nodes that are page furniture rather than content. */
const SKIP = new Set(['HTML', 'BODY', 'HEAD', 'SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE']);

const DEVICES = [
  { id: 'full', label: 'Desktop', icon: Monitor, width: 0 },
  { id: 'tablet', label: 'Tablet', icon: Tablet, width: 820 },
  { id: 'mobile', label: 'Mobile', icon: Smartphone, width: 420 },
] as const;
type DeviceId = (typeof DEVICES)[number]['id'];

/** What the AI actions ask for, kept short so the reply is a fragment. */
const AGENTS = [
  { id: 'improve', label: 'Improve', prompt: 'Improve this element: better layout, spacing and visual hierarchy. Keep the same content and the same outermost tag.' },
  { id: 'restyle', label: 'Restyle', prompt: 'Restyle this element — colours, borders, shadows, typography — so it looks more polished. Keep the same content and structure.' },
  { id: 'rewrite', label: 'Rewrite text', prompt: 'Rewrite the text in this element to be clearer and more professional. Keep the markup and structure identical.' },
  { id: 'shorten', label: 'Shorten', prompt: 'Make this element more compact — tighter spacing, fewer lines — without removing information.' },
] as const;

/** Things Add can insert, written so they read well inside any page. */
const INSERTS = [
  { id: 'heading', label: 'Heading', html: '<h2 style="margin:16px 0 8px;font-size:20px;font-weight:700">New heading</h2>' },
  { id: 'text', label: 'Paragraph', html: '<p style="margin:0 0 12px;line-height:1.6">New paragraph. Click to edit this text.</p>' },
  { id: 'button', label: 'Button', html: '<button style="padding:10px 16px;border:0;border-radius:8px;background:#111827;color:#fff;font-size:13px;font-weight:600">Button</button>' },
  { id: 'card', label: 'Card', html: '<div style="padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;margin:12px 0"><p style="margin:0;font-weight:600">Card title</p><p style="margin:6px 0 0;color:#6b7280;font-size:13px">Supporting text.</p></div>' },
  { id: 'divider', label: 'Divider', html: '<hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0">' },
] as const;

/* ------------------------------------------------------------------ */
/* Applying inherited properties                                       */
/*                                                                     */
/* Clicking a generated page usually lands on a container, not on the  */
/* text: the visible words are in children, and those children set     */
/* their own colour and weight from the page's stylesheet. Setting the  */
/* property on the container alone is therefore correct CSS and         */
/* invisible on screen — it reads as the button doing nothing.          */
/*                                                                     */
/* So a change to an inherited property is applied to the element and  */
/* then cleared off any descendant that was overriding it.              */
/* ------------------------------------------------------------------ */

/** The element's current value for a property, read live rather than from state. */
function currentValue(el: HTMLElement, property: string): string {
  return el.ownerDocument.defaultView?.getComputedStyle(el).getPropertyValue(property) ?? '';
}

/** Whether the element renders as bold right now. */
function isBold(el: HTMLElement): boolean {
  const weight = Number.parseInt(currentValue(el, 'font-weight'), 10);
  return Number.isFinite(weight) ? weight >= 600 : false;
}

/** The element's rendered text size in px right now. */
function currentFontSize(el: HTMLElement): number {
  return Number.parseFloat(currentValue(el, 'font-size')) || 16;
}

/**
 * Sets an inherited property on `el` and stops descendants from hiding it.
 *
 * A descendant with its own inline value has it removed; one coloured by a
 * stylesheet rule gets `inherit` inline, which beats a class selector.
 */
function applyInherited(el: HTMLElement, property: string, value: string): void {
  const view = el.ownerDocument.defaultView;
  if (!view) return;
  el.style.setProperty(property, value);
  const target = view.getComputedStyle(el).getPropertyValue(property);
  el.querySelectorAll<HTMLElement>('*').forEach((child) => {
    child.style.removeProperty(property);
    if (view.getComputedStyle(child).getPropertyValue(property) !== target) {
      child.style.setProperty(property, 'inherit');
    }
  });
}

/**
 * Resizes text under `el`, keeping the hierarchy it already has.
 *
 * Flattening every descendant to one size — which is what `applyInherited`
 * would do — turns a section with headings and captions into a wall of
 * identical text. Scaling by the same ratio keeps the relationships: a
 * container goes from 14 to 16 and its 20px heading goes to 23.
 *
 * Only descendants that carried their own size are touched. The rest inherit,
 * so they moved with the element already.
 */
function scaleFontSize(el: HTMLElement, nextPx: number): void {
  const view = el.ownerDocument.defaultView;
  if (!view) return;
  const before = Number.parseFloat(view.getComputedStyle(el).fontSize) || 16;
  const children = [...el.querySelectorAll<HTMLElement>('*')];
  // Measured before the change, or every child would already read as changed.
  const sizes = children.map((child) => Number.parseFloat(view.getComputedStyle(child).fontSize));

  el.style.fontSize = `${nextPx}px`;
  const ratio = nextPx / before;
  if (!Number.isFinite(ratio) || ratio === 1) return;

  children.forEach((child, index) => {
    const size = sizes[index];
    if (size === undefined || !Number.isFinite(size)) return;
    // Within rounding of the container's old size means it was inheriting.
    if (Math.abs(size - before) < 0.5) return;
    child.style.fontSize = `${Math.max(8, Math.round(size * ratio))}px`;
  });
}

/** A short human name for an element, as a CSS-ish selector. */
function describe(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const classes =
    typeof el.className === 'string'
      ? el.className.split(/\s+/).filter((name) => name && name !== SELECTED && name !== HOVER)
      : [];
  return classes[0] ? `${tag}.${classes[0]}` : tag;
}

/** The chain from the body down to `el`, so a deep pick can be walked back up. */
function ancestry(el: HTMLElement): HTMLElement[] {
  const chain: HTMLElement[] = [];
  let node: HTMLElement | null = el;
  while (node && !SKIP.has(node.tagName)) {
    chain.unshift(node);
    node = node.parentElement;
  }
  return chain;
}

/**
 * The page as HTML, with this editor's own additions removed.
 *
 * Works on a clone: stripping the live document would drop the outlines and
 * the contenteditable the user is still working with.
 */
function serialize(doc: Document): string {
  const clone = doc.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(`style[${MARK}]`).forEach((node) => node.remove());
  clone.querySelectorAll('*').forEach((node) => {
    node.removeAttribute(`${MARK}-empty`);
    node.removeAttribute('contenteditable');
    node.classList.remove(SELECTED, HOVER);
    if (node.getAttribute('class') === '') node.removeAttribute('class');
    if (node.getAttribute('style') === '') node.removeAttribute('style');
  });
  return `<!DOCTYPE html>\n${clone.outerHTML}`;
}

/** The style values the panel shows, read off the live element. */
interface StyleReadout {
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: string;
  color: string;
  background: string;
}

function readStyle(el: HTMLElement): StyleReadout {
  const computed = el.ownerDocument.defaultView!.getComputedStyle(el);
  const weight = Number.parseInt(computed.fontWeight, 10);
  return {
    fontSize: Math.round(Number.parseFloat(computed.fontSize) || 16),
    bold: Number.isFinite(weight) ? weight >= 600 : false,
    italic: computed.fontStyle === 'italic',
    underline: computed.textDecorationLine.includes('underline'),
    align: computed.textAlign,
    color: computed.color,
    background: computed.backgroundColor,
  };
}

const TEXT_COLOURS = ['#0f172a', '#475569', '#3b82f6', '#16a34a', '#d97706', '#dc2626', '#ffffff'];
const FILL_COLOURS = ['transparent', '#ffffff', '#f8fafc', '#eff6ff', '#dcfce7', '#fef3c7', '#fee2e2', '#111827'];

/* ------------------------------------------------------------------ */
/* Editor                                                             */
/* ------------------------------------------------------------------ */

export function PageEditor({
  html,
  screenTitle,
  onSave,
}: {
  html: string;
  /** Named in the AI request, so the model knows what screen it is editing. */
  screenTitle: string;
  onSave: (html: string) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  /** The element being edited, held as a live node. */
  const selectedRef = useRef<HTMLElement | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [style, setStyle] = useState<StyleReadout | null>(null);
  const [dirty, setDirty] = useState(false);
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [device, setDevice] = useState<DeviceId>('full');
  const [busy, setBusy] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);
  /*
   * Whether clicks belong to the page rather than to the editor.
   *
   * Held as a ref as well as state: the listeners are installed once, on load,
   * so a closure over the state value would be stuck on whatever it was then.
   */
  const [interactive, setInteractive] = useState(false);
  const interactiveRef = useRef(false);

  const docOf = useCallback(() => frameRef.current?.contentDocument ?? null, []);

  /* -------------------------------------------------- selection */

  const refresh = useCallback(() => {
    const el = selectedRef.current;
    if (!el || !el.isConnected) {
      selectedRef.current = null;
      setPath([]);
      setStyle(null);
      return;
    }
    setPath(ancestry(el).map(describe));
    setStyle(readStyle(el));
  }, []);

  const select = useCallback(
    (el: HTMLElement | null) => {
      const previous = selectedRef.current;
      if (previous?.isConnected) {
        previous.classList.remove(SELECTED);
        previous.removeAttribute('contenteditable');
      }
      selectedRef.current = el;
      if (el) {
        el.classList.add(SELECTED);
        // Typing works straight away — the point of editing the page directly.
        el.setAttribute('contenteditable', 'true');
        el.focus?.();
      }
      refresh();
    },
    [refresh],
  );

  /** Switches between editing the page and using it. */
  const setInteract = useCallback(
    (next: boolean) => {
      interactiveRef.current = next;
      setInteractive(next);
      const doc = docOf();
      if (doc) {
        if (next) doc.documentElement.setAttribute(`${MARK}-interact`, '');
        else doc.documentElement.removeAttribute(`${MARK}-interact`);
      }
      // Nothing may stay selected — and so editable — while the page is live.
      if (next) select(null);
    },
    [docOf, select],
  );

  /** Walks the selection up to the nth ancestor in the breadcrumb. */
  const selectAncestor = useCallback(
    (depth: number) => {
      const el = selectedRef.current;
      if (!el) return;
      const chain = ancestry(el);
      select(chain[depth] ?? null);
    },
    [select],
  );

  /* -------------------------------------------------- history */

  /** Records the page as it is now, before a change undo should reach. */
  const snapshot = useCallback(() => {
    const doc = docOf();
    if (!doc) return;
    /*
     * Read now, not inside the updater.
     *
     * React runs a state updater after the commit, by which time the caller
     * has already changed the DOM — so reading the page in there captured the
     * result of the edit rather than the state before it, and every undo
     * landed one step late.
     *
     * Raw, not cleaned: this is only ever fed back into the same document, and
     * the artifacts it carries are the ones that document already has.
     */
    const before = doc.documentElement.innerHTML;
    setPast((entries) => [...entries, before].slice(-25));
    setFuture([]);
    setDirty(true);
  }, [docOf]);

  const restore = useCallback(
    (snapshotHtml: string, direction: 'undo' | 'redo') => {
      const doc = docOf();
      if (!doc) return;
      const current = doc.documentElement.innerHTML;
      // Replacing the root's contents keeps the document — and so the delegated
      // listeners on it — alive, unlike re-setting srcDoc.
      doc.documentElement.innerHTML = snapshotHtml;
      selectedRef.current = null;
      setPath([]);
      setStyle(null);
      if (direction === 'undo') {
        setPast((entries) => entries.slice(0, -1));
        setFuture((entries) => [current, ...entries].slice(0, 25));
      } else {
        setFuture((entries) => entries.slice(1));
        setPast((entries) => [...entries, current].slice(-25));
      }
      setDirty(true);
    },
    [docOf],
  );

  const undo = useCallback(() => {
    const entry = past[past.length - 1];
    if (entry !== undefined) restore(entry, 'undo');
  }, [past, restore]);

  const redo = useCallback(() => {
    const entry = future[0];
    if (entry !== undefined) restore(entry, 'redo');
  }, [future, restore]);

  /* -------------------------------------------------- mutation */

  /** Applies a change to the selected element, recording it for undo. */
  const mutate = useCallback(
    (change: (el: HTMLElement) => void) => {
      const el = selectedRef.current;
      if (!el) return;
      snapshot();
      change(el);
      setDirty(true);
      refresh();
    },
    [refresh, snapshot],
  );

  const remove = useCallback(() => {
    const el = selectedRef.current;
    if (!el) return;
    snapshot();
    // Selecting the parent keeps a place in the page after a delete, rather
    // than dropping the user back to nothing selected.
    const parent = el.parentElement;
    el.remove();
    selectedRef.current = null;
    select(parent && !SKIP.has(parent.tagName) ? parent : null);
    setDirty(true);
  }, [select, snapshot]);

  const move = useCallback(
    (direction: -1 | 1) => {
      const el = selectedRef.current;
      if (!el) return;
      const sibling = direction === -1 ? el.previousElementSibling : el.nextElementSibling;
      if (!sibling) return;
      snapshot();
      if (direction === -1) sibling.before(el);
      else sibling.after(el);
      setDirty(true);
      refresh();
    },
    [refresh, snapshot],
  );

  const insert = useCallback(
    (markup: string) => {
      const doc = docOf();
      if (!doc) return;
      snapshot();
      const host = doc.createElement('div');
      host.innerHTML = markup;
      const node = host.firstElementChild as HTMLElement | null;
      if (!node) return;
      const anchor = selectedRef.current;
      if (anchor?.isConnected) anchor.after(node);
      else doc.body.appendChild(node);
      setAddOpen(false);
      select(node);
      setDirty(true);
    },
    [docOf, select, snapshot],
  );

  /* -------------------------------------------------- AI */

  const runAgent = useCallback(
    async (agent: (typeof AGENTS)[number]) => {
      const el = selectedRef.current;
      if (!el || busy) return;
      setBusy(agent.id);
      try {
        // Cleaned, so the model is not shown — or asked to preserve — the
        // editor's own outlines and contenteditable.
        const clone = el.cloneNode(true) as HTMLElement;
        clone.classList.remove(SELECTED, HOVER);
        clone.removeAttribute('contenteditable');
        if (clone.getAttribute('class') === '') clone.removeAttribute('class');

        const response = await fetch('/api/sketcher/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...claudeHeaders() },
          body: JSON.stringify({
            message: `${agent.prompt}\n\nReturn ONLY a \`\`\`html code block containing the replacement for this one element — no page wrapper, no <html> or <body>, no explanation. All styling must be inline style attributes, since the page's stylesheet is not shown to you.`,
            history: [],
            context: `Screen: ${screenTitle}\n\nThe element:\n${clone.outerHTML}`,
            folderLabel: `preview/${screenTitle}`,
            projectName: screenTitle,
            model: 'sonnet',
          }),
        });
        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = readChatEvent(line);
            if (event.kind === 'delta') fullText += event.text;
            else if (event.kind === 'full') fullText = event.text;
          }
        }

        const fenced = fullText.match(/```html\s*\n([\s\S]*?)```/);
        const markup = fenced?.[1]?.trim();
        if (!markup || !el.isConnected) return;

        const doc = docOf();
        if (!doc) return;
        snapshot();
        const host = doc.createElement('div');
        host.innerHTML = markup;
        const replacement = host.firstElementChild as HTMLElement | null;
        if (!replacement) return;
        el.replaceWith(replacement);
        replacement.setAttribute(`${MARK}-target`, '');
        select(replacement);
        setDirty(true);
      } catch {
        /* left as it was */
      } finally {
        setBusy(null);
      }
    },
    [busy, docOf, screenTitle, select, snapshot],
  );

  /* -------------------------------------------------- save */

  const save = useCallback(() => {
    const doc = docOf();
    if (!doc) return;
    onSave(serialize(doc));
    setDirty(false);
  }, [docOf, onSave]);

  /* -------------------------------------------------- wiring */

  /** Wires the page up once it has loaded. Delegated, so it survives undo. */
  const attach = useCallback(() => {
    const doc = docOf();
    if (!doc?.body) return;

    const style = doc.createElement('style');
    style.setAttribute(MARK, '1');
    style.textContent = OVERLAY_CSS;
    doc.head.appendChild(style);

    let hovered: Element | null = null;
    doc.addEventListener('mouseover', (event) => {
      if (interactiveRef.current) return;
      const target = event.target as HTMLElement | null;
      if (hovered) hovered.classList.remove(HOVER);
      if (target && !SKIP.has(target.tagName)) {
        target.classList.add(HOVER);
        hovered = target;
      }
    });
    doc.addEventListener('mouseleave', () => {
      if (hovered) hovered.classList.remove(HOVER);
      hovered = null;
    });

    doc.addEventListener(
      'click',
      (event) => {
        // Clicking through: the page's own handlers, links and buttons run.
        if (interactiveRef.current) return;
        const target = event.target as HTMLElement | null;
        if (!target || SKIP.has(target.tagName)) return;
        // Otherwise a click selects, and the page's own links and buttons
        // would navigate the frame away.
        event.preventDefault();
        event.stopPropagation();
        // A click inside the element already being edited is a caret move.
        if (selectedRef.current?.contains(target) && selectedRef.current !== target) return;
        select(target);
      },
      true,
    );

    // One snapshot per burst of typing, not one per keystroke.
    let typing = false;
    doc.addEventListener('beforeinput', () => {
      if (!typing) {
        typing = true;
        snapshot();
      }
    });
    doc.addEventListener('input', () => setDirty(true));
    doc.addEventListener('blur', () => { typing = false; }, true);
    doc.addEventListener('keydown', (event) => onKey(event as KeyboardEvent));
  }, [docOf, select, snapshot]);

  /**
   * Shortcuts.
   *
   * Bound inside the iframe as well as outside it: while someone is typing in
   * the page, the key events never reach the parent document.
   */
  const onKey = useCallback(
    (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault();
        save();
        return;
      }
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (interactiveRef.current) setInteract(false);
        else select(null);
        return;
      }
      // Only when not typing: inside a contenteditable, Backspace is text.
      const editing = (event.target as HTMLElement | null)?.isContentEditable;
      if (!editing && (event.key === 'Backspace' || event.key === 'Delete')) {
        event.preventDefault();
        remove();
      }
    },
    [redo, remove, save, select, setInteract, undo],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onKey]);

  // A new page replaces everything, history included.
  useEffect(() => {
    selectedRef.current = null;
    setPath([]);
    setStyle(null);
    setPast([]);
    setFuture([]);
    setDirty(false);
    interactiveRef.current = false;
    setInteractive(false);
  }, [html]);

  const nothingSelected = style === null;
  const width = DEVICES.find((entry) => entry.id === device)?.width ?? 0;

  /* -------------------------------------------------- render */

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Element actions. One line, scrolled rather than wrapped: a toolbar
          that reflows moves its buttons out from under the cursor. */}
      <div className="flex items-center gap-1 overflow-x-auto border-b px-3 py-2">
        <Button size="sm" variant="ghost" className="h-6 gap-1 px-1.5" title="Undo (⌘Z)"
          disabled={past.length === 0} onClick={undo}>
          <Undo2 className="size-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 gap-1 px-1.5" title="Redo (⇧⌘Z)"
          disabled={future.length === 0} onClick={redo}>
          <Redo2 className="size-3" />
        </Button>

        <div className="bg-border mx-1 h-4 w-px" />

        {/* Text */}
        <Button size="sm" variant="ghost" className={cn('h-6 px-1.5', style?.bold && 'bg-muted')}
          title="Bold" disabled={nothingSelected}
          onClick={() => mutate((el) => applyInherited(el, 'font-weight', isBold(el) ? '400' : '700'))}>
          <Bold className="size-3" />
        </Button>
        <Button size="sm" variant="ghost" className={cn('h-6 px-1.5', style?.italic && 'bg-muted')}
          title="Italic" disabled={nothingSelected}
          onClick={() => mutate((el) =>
            applyInherited(el, 'font-style', currentValue(el, 'font-style') === 'italic' ? 'normal' : 'italic'),
          )}>
          <Italic className="size-3" />
        </Button>
        <Button size="sm" variant="ghost" className={cn('h-6 px-1.5', style?.underline && 'bg-muted')}
          title="Underline" disabled={nothingSelected}
          onClick={() => mutate((el) =>
            applyInherited(
              el,
              'text-decoration-line',
              currentValue(el, 'text-decoration-line').includes('underline') ? 'none' : 'underline',
            ),
          )}>
          <Underline className="size-3" />
        </Button>

        {/* Size, with the current value visible */}
        <div className="ml-1 flex items-center gap-0.5">
          <Button size="sm" variant="ghost" className="h-6 px-1" title="Smaller"
            disabled={nothingSelected}
            onClick={() => mutate((el) => scaleFontSize(el, Math.max(8, currentFontSize(el) - 2)))}>
            <Type className="size-3" />
            <span className="text-[9px]">−</span>
          </Button>
          <span className="text-muted-foreground w-6 text-center font-mono text-[10px]">
            {style ? style.fontSize : '—'}
          </span>
          <Button size="sm" variant="ghost" className="h-6 px-1" title="Bigger"
            disabled={nothingSelected}
            onClick={() => mutate((el) => scaleFontSize(el, Math.min(96, currentFontSize(el) + 2)))}>
            <Type className="size-3" />
            <span className="text-[9px]">+</span>
          </Button>
        </div>

        <div className="bg-border mx-1 h-4 w-px" />

        {/* Alignment */}
        {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight], ['justify', AlignJustify]] as const).map(
          ([align, Icon]) => (
            <Button key={align} size="sm" variant="ghost"
              className={cn('h-6 px-1.5', style?.align === align && 'bg-muted')}
              title={`Align ${align}`} disabled={nothingSelected}
              onClick={() => mutate((el) => applyInherited(el, 'text-align', align))}>
              <Icon className="size-3" />
            </Button>
          ),
        )}

        <div className="bg-border mx-1 h-4 w-px" />

        {/* Text colour */}
        {TEXT_COLOURS.map((colour) => (
          <button key={colour} type="button" disabled={nothingSelected} title={`Text ${colour}`}
            onClick={() => mutate((el) => applyInherited(el, 'color', colour))}
            className="size-4 rounded-full border disabled:opacity-30"
            style={{ background: colour }} />
        ))}

        {/* Background */}
        <div className="relative">
          <Button size="sm" variant="ghost" className="h-6 px-1.5" title="Background"
            disabled={nothingSelected} onClick={() => setFillOpen((open) => !open)}>
            <Palette className="size-3" />
          </Button>
          {fillOpen && (
            <div className="bg-popover absolute top-7 left-0 z-50 flex gap-1 rounded-md border p-1.5 shadow-md">
              {FILL_COLOURS.map((colour) => (
                <button key={colour} type="button" title={colour}
                  onClick={() => {
                    mutate((el) => { el.style.backgroundColor = colour; });
                    setFillOpen(false);
                  }}
                  className="size-4 rounded-full border"
                  style={{
                    background:
                      colour === 'transparent'
                        ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50%/8px 8px'
                        : colour,
                  }} />
              ))}
            </div>
          )}
        </div>

        <div className="bg-border mx-1 h-4 w-px" />

        {/* Structure */}
        <Button size="sm" variant="ghost" className="h-6 px-1.5" title="Move up"
          disabled={nothingSelected} onClick={() => move(-1)}>
          <MoveUp className="size-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 px-1.5" title="Move down"
          disabled={nothingSelected} onClick={() => move(1)}>
          <MoveDown className="size-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 px-1.5" title="Duplicate"
          disabled={nothingSelected}
          onClick={() => mutate((el) => { el.after(el.cloneNode(true)); })}>
          <Copy className="size-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-red-600" title="Delete (⌫)"
          disabled={nothingSelected} onClick={remove}>
          <Trash2 className="size-3" />
        </Button>

        {/* Add */}
        <div className="relative">
          <Button size="sm" variant="ghost" className="h-6 gap-1 px-1.5" title="Add an element"
            onClick={() => setAddOpen((open) => !open)}>
            <Plus className="size-3" />
          </Button>
          {addOpen && (
            <div className="bg-popover absolute top-7 left-0 z-50 flex w-32 flex-col rounded-md border p-1 shadow-md">
              {INSERTS.map((entry) => (
                <button key={entry.id} type="button" onClick={() => insert(entry.html)}
                  className="hover:bg-muted rounded px-2 py-1 text-left text-[11px]">
                  {entry.label}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Where the selection is, what AI can do to it, and the page's own
          actions — which stay reachable whether anything is selected or not. */}
      <div className="bg-muted/40 flex min-h-9 items-center gap-1 border-b px-3 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {path.length === 0 ? (
            <span className="text-muted-foreground text-[11px] whitespace-nowrap">
              {interactive
                ? 'Using the page — clicks go to it. Esc returns to editing.'
                : 'Click anything on the page to edit it. ⌘S save · ⌘Z undo · Esc deselect · ⌫ delete'}
            </span>
          ) : (
            <>
              <Button size="sm" variant="ghost" className="h-5 shrink-0 px-1"
                title="Select the parent" disabled={path.length < 2}
                onClick={() => selectAncestor(path.length - 2)}>
                <CornerLeftUp className="size-3" />
              </Button>
              {path.map((label, index) => (
                <span key={`${label}-${index}`} className="flex shrink-0 items-center gap-1">
                  {index > 0 && <ChevronRight className="text-muted-foreground size-2.5" />}
                  <button type="button" onClick={() => selectAncestor(index)}
                    className={cn(
                      'rounded px-1 py-0.5 font-mono text-[10px] whitespace-nowrap',
                      index === path.length - 1
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:bg-muted',
                    )}>
                    {label}
                  </button>
                </span>
              ))}
            </>
          )}
        </div>

        {path.length > 0 && (
          <div className="flex shrink-0 items-center gap-1">
            {AGENTS.map((agent) => (
              <Button key={agent.id} size="sm" variant="outline"
                className="h-5 gap-1 px-1.5 text-[10px]" disabled={busy !== null}
                onClick={() => void runAgent(agent)}>
                {busy === agent.id ? (
                  <Loader2 className="size-2.5 animate-spin" />
                ) : (
                  <Sparkles className="size-2.5" />
                )}
                {agent.label}
              </Button>
            ))}
          </div>
        )}

        <div className="bg-border mx-1 h-4 w-px shrink-0" />

        <Button size="sm" variant={interactive ? 'default' : 'ghost'}
          className="h-6 shrink-0 gap-1 px-2 text-[11px]"
          title={interactive ? 'Back to editing' : 'Click through the page instead of editing it'}
          onClick={() => setInteract(!interactive)}>
          <Hand className="size-3" />
          {interactive ? 'Using' : 'Use'}
        </Button>

        <div className="bg-muted flex shrink-0 rounded-md p-0.5">
          {DEVICES.map((entry) => (
            <button key={entry.id} type="button" title={entry.label}
              onClick={() => setDevice(entry.id)}
              className={cn(
                'rounded px-1.5 py-1',
                device === entry.id ? 'bg-background shadow-xs' : 'text-muted-foreground',
              )}>
              <entry.icon className="size-3" />
            </button>
          ))}
        </div>

        <Button size="sm" className="h-6 shrink-0 gap-1 px-2 text-[11px]" disabled={!dirty}
          onClick={save} title="Save (⌘S)">
          <Save className="size-3" />
          {dirty ? 'Save' : 'Saved'}
        </Button>
      </div>

      {/* The page */}
      <div className="flex min-h-0 flex-1 justify-center overflow-auto p-3">
        <iframe
          ref={frameRef}
          srcDoc={html}
          onLoad={attach}
          title="Edit page"
          style={width > 0 ? { maxWidth: width } : undefined}
          className="h-full w-full rounded-lg border bg-white shadow-sm"
          // Same-origin is what lets the parent reach into the document at all;
          // without it there is nothing here to edit.
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
}
