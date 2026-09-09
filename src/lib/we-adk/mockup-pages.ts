/**
 * Reading generated pages out of a model reply.
 *
 * One meeting asks for several screens — a login, the list it opens onto, the
 * popup that list opens — so the reply carries several pages, each fenced and
 * each preceded by a name. Anything unlabelled is still a page: a reply that
 * ignores the marker is worse documented, not worthless, so it is numbered
 * rather than dropped.
 */

import type { IAPlatform, IAScreenType } from '@/lib/we-adk-mock/ia';

export interface ParsedPage {
  name: string;
  screenType: IAScreenType;
  platform: IAPlatform;
  /**
   * The screen this one opens from, by name, as the reply stated it.
   *
   * The tree is the model's to describe: it decided that a cash-payment popup
   * belongs under the till and not beside it, and that is IA information that
   * only exists at the moment the screens are proposed. Resolved to an id by
   * the caller, which knows what the other screens ended up being called.
   */
  parentName?: string;
  html: string;
}

/** The line the model is asked to put before each block. */
const MARKER = /PAGE:[ \t]*(.+?)[ \t]*$/i;

/**
 * `Login · Popup · PC · from: Dashboard` — every field after the name is
 * optional, and an older marker that only says `Login - Popup` still reads.
 */
function readMarker(raw: string): Omit<ParsedPage, 'html'> {
  const line = raw.replace(/^#+\s*/, '').trim();
  const parts = line.split('·').map((part) => part.trim()).filter(Boolean);
  let name = parts.shift() ?? '';
  let screenType: IAScreenType = 'Screen';
  let platform: IAPlatform = 'PC';
  let parentName: string | undefined;

  // The older form, where the kind was hyphenated onto the name.
  if (parts.length === 0) {
    const split = /^(.*?)[\s]*-[\s]*(screen|popup|modal|drawer)$/i.exec(name);
    if (split) {
      name = split[1]!.trim();
      parts.push(split[2]!);
    }
  }

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (/^(screen|page)$/.test(lower)) continue;
    if (/^(popup|modal|dialog)$/.test(lower)) {
      screenType = 'Popup';
      continue;
    }
    if (/^(drawer|side panel|sidebar)$/.test(lower)) {
      screenType = 'Drawer';
      continue;
    }
    if (/^(pc|desktop|web)$/.test(lower)) continue;
    if (/^(mobile|phone|app|tablet)$/.test(lower)) {
      platform = 'Mobile';
      continue;
    }
    const from = /^(?:from|opens from|parent)[\s]*:[\s]*(.+)$/i.exec(part);
    if (from) {
      const value = from[1]!.trim();
      if (!/^(top|top level|none|root|-)$/i.test(value)) parentName = value;
    }
  }

  return { name: name || 'Untitled screen', screenType, platform, parentName };
}

/**
 * Markers a generated page uses when it holds several screens in one file.
 *
 * A model asked for "a real production app" tends to build exactly that: one
 * document with a sidebar and every destination inside it, shown and hidden by
 * script. That file is not a screen — it is five — and moving it as one gives
 * the Product side a draft nobody can place, link or review.
 */
/*
 * A container holding one of several screens in one file.
 *
 * Emphatically not `[data-screen]`, which means the opposite: since linking
 * was added, that attribute marks a control that *opens* another screen. A
 * sidebar with two such links was being read as a deck of two views, so a
 * Store Settings page split into two screens named after its links, each
 * containing all of Store Settings. A view is a container, so anything
 * clickable is excluded too.
 */
const VIEW_SELECTOR = '[data-page], [data-view], .page, .screen, .view, .tab-pane, .tab-content';

/** Never a view, whatever its classes say. */
const NOT_A_VIEW = 'a, button, input, select, textarea, [role="button"], [role="link"], [data-screen]';

/**
 * What a popup, modal or drawer is drawn as.
 *
 * These arrive inside the screen that raises them, which is how a real page is
 * built and the wrong shape for a set of screens: a popup has its own place in
 * the tree, its own row in a Request, and its own thing to review. So it is
 * lifted out into a screen of its own, shown over its parent, and the parent
 * is left without it.
 */
const OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], .modal, .popup, .dialog, .drawer, .sheet, .overlay';

/** The name a view goes by: the nav item that opens it, or its own heading. */
function viewName(doc: Document, view: Element, index: number, fallbackName: string): string {
  const id = view.getAttribute('id');
  if (id) {
    const link = doc.querySelector(`[href="#${id}"], [data-target="${id}"], [data-page="${id}"]`);
    const text = link?.textContent?.replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  const heading = view.querySelector('h1, h2, [class*="title"]')?.textContent;
  const text = heading?.replace(/\s+/g, ' ').trim();
  if (text && text.length <= 60) return text;
  const label = view.getAttribute('data-page') ?? id;
  return label ? label.replace(/[-_]+/g, ' ').trim() : `${fallbackName} ${index + 1}`;
}

/** The largest set of sibling views in a document — the deck, if there is one. */
function largestDeck(doc: Document): Element[] {
  const byParent = new Map<Element, Element[]>();
  for (const node of Array.from(doc.querySelectorAll(VIEW_SELECTOR))) {
    if (node.matches(NOT_A_VIEW)) continue;
    const parent = node.parentElement;
    if (!parent) continue;
    byParent.set(parent, [...(byParent.get(parent) ?? []), node]);
  }
  let deck: Element[] = [];
  for (const group of byParent.values()) if (group.length > deck.length) deck = group;
  return deck;
}

/** Spacing and case are not part of a name when two names are compared. */
const key = (value: string) => value.replace(/\s+/g, '').toLowerCase();

/**
 * One screen, cut out of a document that holds several.
 *
 * The shell stays — sidebar, header, styles — so the screen still looks like
 * the app it belongs to. What goes is the machinery that made the other
 * screens reachable: the other views themselves, the scripts that swapped
 * them, the inline handlers, and any link still pointing at a view that is no
 * longer there. A screen that can navigate to four other screens is not a
 * screen, and downstream it cannot be placed in an IA or reviewed as one.
 */
function renderScreen(parser: DOMParser, html: string, keep: number, name: string): ParsedPage {
  const doc = parser.parseFromString(html, 'text/html');
  const deck = largestDeck(doc);
  const kept = deck[keep];
  const keptId = kept?.getAttribute('id');

  deck.forEach((node, index) => {
    if (index !== keep) return node.remove();
    node.classList.add('active', 'show');
    node.setAttribute('style', `${node.getAttribute('style') ?? ''};display:block`);
  });

  for (const node of Array.from(doc.querySelectorAll('*'))) {
    // Handlers written onto the element outlive the script that defined them.
    for (const attr of Array.from(node.attributes)) {
      if (attr.name.startsWith('on')) node.removeAttribute(attr.name);
    }
    const href = node.getAttribute('href');
    if (href?.startsWith('#')) {
      const id = href.slice(1);
      const points = id !== '' && id === keptId;
      // The nav still reads, and says where you are, but goes nowhere.
      if (!points) node.setAttribute('href', '#');
      node.classList.toggle('active', points);
    }
    for (const attr of ['data-target', 'data-page', 'data-screen', 'data-view']) {
      const value = node.getAttribute(attr);
      if (value && node !== kept) node.classList.toggle('active', value === keptId);
    }
  }

  for (const script of Array.from(doc.querySelectorAll('script'))) script.remove();
  const title = doc.querySelector('title');
  if (title) title.textContent = name;
  return {
    name,
    screenType: 'Screen' as IAScreenType,
    platform: 'PC' as IAPlatform,
    html: `<!DOCTYPE html>${doc.documentElement.outerHTML}`,
  };
}

/** A heading inside an overlay, which is what a popup is called. */
function overlayName(node: Element, index: number, fallbackName: string): string {
  const heading = node.querySelector('h1, h2, h3, [class*="title"], [class*="header"]')?.textContent;
  const text = heading?.replace(/\s+/g, ' ').trim();
  if (text && text.length <= 60) return text;
  const label = node.getAttribute('aria-label') ?? node.getAttribute('id');
  return label ? label.replace(/[-_]+/g, ' ').trim() : `${fallbackName} popup ${index + 1}`;
}

/** Drawer, sheet, or popup — whichever the page's own classes said. */
function overlayType(node: Element): IAScreenType {
  const marker = `${node.getAttribute('class') ?? ''} ${node.getAttribute('id') ?? ''}`.toLowerCase();
  return /drawer|sheet|side-?panel/.test(marker) ? 'Drawer' : 'Popup';
}

/**
 * A screen and the overlays it carries, split apart.
 *
 * `null` when the page has none. The parent comes back first with its overlays
 * removed, then one screen per overlay showing it open over that parent —
 * which is what a popup is: a state of the screen underneath it, not a page of
 * its own floating in space.
 */
export function extractOverlays(html: string, baseName: string): ParsedPage[] | null {
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') return null;
  try {
    const parser = new window.DOMParser();
    // Only overlays at the top of the document: a modal nested inside another
    // modal is part of that one, not a screen of its own.
    const topLevel = (doc: Document) =>
      Array.from(doc.querySelectorAll(OVERLAY_SELECTOR)).filter(
        (node) => !node.parentElement?.closest(OVERLAY_SELECTOR),
      );

    const found = topLevel(parser.parseFromString(html, 'text/html'));
    if (found.length === 0) return null;

    const names = found.map((node, index) => overlayName(node, index, baseName));
    const types = found.map(overlayType);

    const build = (keep: number | null): string => {
      const doc = parser.parseFromString(html, 'text/html');
      topLevel(doc).forEach((node, index) => {
        if (index !== keep) return node.remove();
        // Shown, whatever the page's own classes said about hiding it.
        node.classList.add('open', 'active', 'show');
        node.classList.remove('hidden');
        node.setAttribute('style', `${node.getAttribute('style') ?? ''};display:flex`);
      });
      const title = doc.querySelector('title');
      if (title && keep !== null) title.textContent = names[keep] ?? baseName;
      return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
    };

    return [
      { name: baseName, screenType: 'Screen', platform: 'PC', html: build(null) },
      ...found.map((_, index) => ({
        name: names[index] ?? `${baseName} popup ${index + 1}`,
        screenType: types[index] ?? ('Popup' as IAScreenType),
        platform: 'PC' as IAPlatform,
        parentName: baseName,
        html: build(index),
      })),
    ];
  } catch {
    return null;
  }
}

/**
 * One file holding several screens, taken apart into one document per screen.
 *
 * `null` when the file is what it claims to be — a single screen — which is
 * the common case and the one that must not be disturbed.
 */
export function splitInPageScreens(html: string, fallbackName: string): ParsedPage[] | null {
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') return null;
  try {
    const parser = new window.DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const views = largestDeck(doc);
    if (views.length < 2) return null;
    return views.map((view, index) =>
      renderScreen(parser, html, index, viewName(doc, view, index, fallbackName)),
    );
  } catch {
    return null;
  }
}

/**
 * Every page in `text`, in order.
 *
 * `fallbackName` names a page the reply did not label — the meeting's own
 * title, which is right when the reply holds exactly one page.
 */
export function parseGeneratedPages(text: string, fallbackName: string): ParsedPage[] {
  const pages: ParsedPage[] = [];
  const fence = /```html\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(text)) !== null) {
    const html = match[1]!.trim();
    if (!html) continue;
    // The nearest labelled line above this block, if the reply wrote one.
    const before = text.slice(0, match.index).split('\n').reverse();
    let label: string | undefined;
    for (const line of before.slice(0, 6)) {
      const found = MARKER.exec(line.trim());
      if (found) {
        label = found[1];
        break;
      }
      if (line.trim() && !line.trim().startsWith('#')) break;
    }
    const marked = label
      ? readMarker(label)
      : { name: '', screenType: 'Screen' as IAScreenType, platform: 'PC' as IAPlatform };
    pages.push({
      ...marked,
      name: marked.name || (pages.length === 0 ? fallbackName : `${fallbackName} ${pages.length + 1}`),
      html,
    });
  }

  /*
   * Every generation ends as one file per screen. Always, and popups included.
   *
   * Three things get taken apart, in order, because each can hide the next:
   * a file that holds a deck of views is split into those views; each view is
   * then relieved of its popups and drawers, which become screens of their own
   * shown over the screen that raises them.
   *
   * A reply that shipped the whole app in every block therefore produces the
   * same screens several times over, which is why the last step is to keep one
   * of each. The copy that wins is the one from the block that named it — that
   * file was written to show that screen, and the others merely contained it.
   */
  const withOverlays = (page: ParsedPage, source: ParsedPage): ParsedPage[] => {
    const parts = extractOverlays(page.html, page.name);
    if (!parts) return [page];
    const [parent, ...overlays] = parts;
    return [
      // The marker still says what the parent is; only its html was rebuilt.
      { ...page, html: parent?.html ?? page.html },
      ...overlays.map((overlay) => ({
        ...overlay,
        platform: source.platform,
        // A popup opens from the screen it was lifted out of.
        parentName: page.name,
      })),
    ];
  };

  const expanded: ParsedPage[] = pages.flatMap((page) => {
    const views = splitInPageScreens(page.html, page.name);
    if (!views) return withOverlays(page, page);
    return views.flatMap((view) =>
      withOverlays({ ...view, platform: page.platform, parentName: page.parentName }, page),
    );
  });

  const seen = new Map<string, { page: ParsedPage; exact: boolean }>();
  for (const page of expanded) {
    const key = nameKey(page.name);
    if (!key) continue;
    const exact = pages.some((source) => nameKey(source.name) === key);
    const held = seen.get(key);
    if (!held || (exact && !held.exact)) seen.set(key, { page, exact });
  }

  pages.length = 0;
  pages.push(...Array.from(seen.values()).map((entry) => entry.page));

  // A reply that is a bare page, with no fence at all.
  if (pages.length === 0) {
    const trimmed = text.trim();
    if (/^<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
      pages.push({ name: fallbackName, screenType: 'Screen', platform: 'PC', html: trimmed });
    }
  }
  return pages;
}

/**
 * What a generated page calls itself.
 *
 * A meeting is a conversation and its screens are not named after it: "POS
 * System Kickoff" produces a page whose own title is "POS System". Pages
 * generated before the PAGE marker existed carry no name of their own, so
 * this reads the one the page already states.
 */
export function pageTitleFromHtml(html: string): string | undefined {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
  if (title) return title;
  const heading = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1];
  const text = heading?.replace(/<[^>]*>/g, '').trim();
  return text || undefined;
}

/** What a preview can navigate to: the other screens of the same build. */
export interface PreviewLink {
  id: string;
  name: string;
}

/** Spacing, case and punctuation are not part of a name when names are matched. */
const nameKey = (value: string) => value.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();

/**
 * The message a preview sends when someone clicks through to another screen.
 *
 * A previewed page is a document of its own in a sandboxed frame, so it cannot
 * reach into the app that is showing it — and it should not be able to. It
 * says where it wants to go and the app decides, which is the only arrangement
 * where a generated page can be clickable without also being trusted.
 */
export const PREVIEW_NAV_SOURCE = 'we-adk-preview';

export interface PreviewNavMessage {
  source: typeof PREVIEW_NAV_SOURCE;
  to?: string;
  /** In pick mode: the control that was clicked, by its ordinal. */
  pick?: number;
}

export function readPreviewNav(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const message = data as Partial<PreviewNavMessage>;
  return message.source === PREVIEW_NAV_SOURCE && typeof message.to === 'string' ? message.to : null;
}

/** The control a click landed on while the preview was in pick mode. */
export function readPreviewPick(data: unknown): number | null {
  if (typeof data !== 'object' || data === null) return null;
  const message = data as Partial<PreviewNavMessage>;
  return message.source === PREVIEW_NAV_SOURCE && typeof message.pick === 'number'
    ? message.pick
    : null;
}

/**
 * Which screen a control opens, if it opens one of these.
 *
 * Three readings, in order of how much the page meant them. `data-screen` is
 * the model saying so outright, because it was asked to. A path is the next
 * best thing — `/pending-approvals` is a screen called Pending Approvals in
 * every product that ever named a route. The label is last: a sidebar item
 * reading "Pending Approvals" is almost certainly that screen, but only
 * almost, so it is what we fall back to rather than what we look at first.
 */
function targetFor(node: Element, links: PreviewLink[]): string | null {
  const byName = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const key = nameKey(value);
    if (!key) return null;
    return links.find((link) => nameKey(link.name) === key)?.id ?? null;
  };

  const declared =
    node.getAttribute('data-screen') ??
    node.getAttribute('data-page') ??
    node.getAttribute('data-target');
  const fromDeclared = byName(declared);
  if (fromDeclared) return fromDeclared;

  const href = node.getAttribute('href') ?? '';
  if (href && !href.startsWith('#')) {
    const last = href.split(/[?#]/)[0]?.split('/').filter(Boolean).pop() ?? '';
    const fromHref = byName(last.replace(/\.html?$/i, ''));
    if (fromHref) return fromHref;
  }

  return byName(node.textContent);
}

/**
 * Pick mode: the screen becomes a map of its own controls.
 *
 * Choosing a control from a list means recognising it by its label, which is
 * fine for "로그인" and useless for the fourth of six cards that all say
 * "상세 보기". Pointing at the thing on the screen is how this is done
 * everywhere else, so the page outlines what can be wired and reports what was
 * clicked — the app does the rest.
 */
const PICK_STYLE = [
  /*
   * A ring, not an outline.
   *
   * The first version drew a dashed indigo outline, which vanished on exactly
   * the controls people most want to wire: a navy Cash button, an indigo Card
   * button, a green QR button. A white halo under a coloured ring reads on any
   * background, and box-shadow costs no layout, so nothing on the page moves
   * when the mode turns on.
   */
  '[data-we-adk-i]{cursor:crosshair!important;border-radius:4px;',
  'box-shadow:0 0 0 1px rgba(255,255,255,.95),0 0 0 3px rgba(99,102,241,.5)!important}',
  '[data-we-adk-i]:hover{box-shadow:0 0 0 1px #fff,0 0 0 3px #6366f1,',
  '0 4px 14px rgba(99,102,241,.4)!important;z-index:2147483646;position:relative}',
  // Already wired, so it reads as done rather than as another thing to do.
  '[data-we-adk-i][data-we-adk-to]{box-shadow:0 0 0 1px rgba(255,255,255,.95),',
  '0 0 0 3px rgba(16,185,129,.85)!important}',
  '[data-we-adk-i][data-we-adk-to]:hover{box-shadow:0 0 0 1px #fff,0 0 0 3px #10b981,',
  '0 4px 14px rgba(16,185,129,.4)!important}',
].join('');

const PICK_SCRIPT = [
  '(function(){',
  "document.addEventListener('click',function(e){",
  "var el=e.target&&e.target.closest?e.target.closest('[data-we-adk-i]'):null;",
  'e.preventDefault();e.stopPropagation();',
  'if(!el||!window.parent)return;',
  "var i=parseInt(el.getAttribute('data-we-adk-i'),10);",
  "if(!isNaN(i))window.parent.postMessage({source:'" + PREVIEW_NAV_SOURCE + "',pick:i},'*');",
  '},true);',
  '})();',
].join('');

/** Injected into a preview so a click can ask the app to change screens. */
const NAV_SCRIPT = [
  '(function(){',
  "document.addEventListener('click',function(e){",
  "var el=e.target&&e.target.closest?e.target.closest('a,[data-we-adk-to]'):null;",
  'if(!el)return;',
  "var to=el.getAttribute('data-we-adk-to');",
  'e.preventDefault();',
  "if(to&&window.parent)window.parent.postMessage({source:'" + PREVIEW_NAV_SOURCE + "',to:to},'*');",
  '},true);',
  '})();',
].join('');

/**
 * A generated page, made safe to show inside the app.
 *
 * A preview is a picture of a screen, and a picture must not be able to walk
 * off with the frame it is in. These pages are written as if they were the
 * real product, so they carry real links — and a click on one navigates the
 * iframe to that path on this origin, which is the workspace itself. The
 * preview then quietly becomes a copy of the app, inside the app, with no way
 * back and no sign of what happened.
 *
 * So links are pinned, and anything that navigates on its own is dropped. The
 * page keeps its own scripts and its own look: a PIN pad still counts, a tab
 * strip still highlights. Only leaving is taken away.
 */
export function inertPreviewHtml(
  html: string,
  links: PreviewLink[] = [],
  currentId?: string,
  /** Outline the controls and report clicks instead of following them. */
  pick = false,
): string {
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') return html;
  try {
    const doc = new window.DOMParser().parseFromString(html, 'text/html');

    /*
     * A link that names another screen of this build becomes that screen.
     *
     * The screens were generated as one product and their navigation refers to
     * each other, so a dead sidebar is a worse lie than no sidebar: it says
     * the flow exists and then refuses to walk it. What it cannot do is
     * navigate the frame — it asks the app, which changes the screen being
     * previewed.
     */
    const clickable = new Set<Element>([
      ...Array.from(doc.querySelectorAll('[href]')),
      ...Array.from(doc.querySelectorAll('[data-screen], [data-page], [data-target]')),
    ]);
    const resolved: { node: Element; to: string }[] = [];
    for (const node of clickable) {
      const to = links.length > 0 ? targetFor(node, links) : null;
      if (to) {
        resolved.push({ node, to });
        node.setAttribute('data-we-adk-to', to);
        node.setAttribute('style', `${node.getAttribute('style') ?? ''};cursor:pointer`);
      }
      const href = node.getAttribute('href');
      if (href === null) continue;
      // In-page anchors are the page talking to itself, and stay.
      if (href.startsWith('#')) continue;
      node.setAttribute('href', '#');
    }
    // A target of _top or _parent aims at this app's own window.
    for (const node of Array.from(doc.querySelectorAll('[target]'))) {
      node.setAttribute('target', '_blank');
    }
    for (const node of Array.from(doc.querySelectorAll('form'))) {
      node.removeAttribute('action');
    }
    for (const node of Array.from(doc.querySelectorAll('meta[http-equiv]'))) {
      if ((node.getAttribute('http-equiv') ?? '').toLowerCase() === 'refresh') node.remove();
    }

    /*
     * The nav says where you are, and it has to be right.
     *
     * Each screen is generated as its own file, and a file that copied the
     * shell from its neighbour copies which item was highlighted too — so the
     * dashboard arrives with Pending Approvals lit up. Now that a nav item can
     * be resolved to a screen, the one pointing at this screen is the current
     * one and the rest are not.
     *
     * Only touched when something actually points here. If nothing resolves,
     * the page's own answer is the only answer there is, wrong or not, and
     * clearing it would leave a nav with nothing marked at all.
     */
    if (currentId && resolved.some((entry) => entry.to === currentId)) {
      for (const entry of resolved) {
        const here = entry.to === currentId;
        entry.node.classList.toggle('active', here);
        entry.node.classList.toggle('current', here);
        if (here) entry.node.setAttribute('aria-current', 'page');
        else entry.node.removeAttribute('aria-current');
      }
    }

    if (pick) {
      // Tagged with the same ordinal `listPageControls` reports, so what is
      // clicked here and what is written back are the same element.
      Array.from(doc.querySelectorAll(CLICKABLE_SELECTOR)).forEach((node, index) => {
        node.setAttribute('data-we-adk-i', String(index));
      });
      const style = doc.createElement('style');
      style.textContent = PICK_STYLE;
      doc.head.appendChild(style);
    }

    if (pick || links.length > 0) {
      const script = doc.createElement('script');
      script.textContent = pick ? PICK_SCRIPT : NAV_SCRIPT;
      doc.body.appendChild(script);
    }

    return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
  } catch {
    return html;
  }
}

/* ------------------------------------------------------------------ */
/* Editing what a control opens                                        */
/* ------------------------------------------------------------------ */

/**
 * Everything in a page that a person could click.
 *
 * Deliberately wide: a card, a table row and a list item are all things people
 * click in a real product, and a mockup that only lets you wire `<a>` and
 * `<button>` cannot express "click the row to open the detail" — which is most
 * of what these screens do.
 */
const CLICKABLE_SELECTOR = [
  'a',
  'button',
  'input[type="button"]',
  'input[type="submit"]',
  '[onclick]',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="option"]',
  '[data-screen]',
  '[data-page]',
  '[data-target]',
  // Div-drawn controls, which is most of what a generated page uses: a "card"
  // that opens a detail, a "btn" that is not a <button>, a keypad "key".
  '[class*="btn"]',
  '[class*="button"]',
  '[class*="card"]',
  '[class*="chip"]',
  '[class*="key"]',
  '[class*="menu-item"]',
  '[class*="nav-item"]',
  '[class*="pill"]',
  '[class*="row"]',
  '[class*="tab"]',
  '[class*="tile"]',
].join(', ');

export interface PageControl {
  /**
   * Its position among the page's clickable elements.
   *
   * An ordinal, not a selector: the same html parsed twice yields the same
   * order, and an ordinal cannot go stale the way a generated selector does
   * when the page is edited elsewhere. It is only ever used to read and write
   * the same document.
   */
  index: number;
  /** What it says, which is how a person will recognise it in a list. */
  label: string;
  /** `a`, `button`, `div` — enough to tell a nav item from a card. */
  tag: string;
  /** The screen it currently opens, by name, if it has been wired. */
  opens?: string;
}

/** The label a control goes by: its own words, or the next best thing. */
function controlLabel(node: Element): string {
  const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  if (text && text.length <= 60) return text;
  if (text) return `${text.slice(0, 57)}…`;
  const alt =
    node.getAttribute('aria-label') ??
    node.getAttribute('title') ??
    node.getAttribute('id') ??
    node.getAttribute('class');
  return alt?.replace(/\s+/g, ' ').trim().slice(0, 60) || '(no label)';
}

/**
 * The clickable controls of a page, in document order.
 *
 * Nested clickables are dropped — a button inside a card would otherwise be
 * offered twice, once as itself and once as its parent, and wiring both is how
 * one click ends up meaning two things.
 */
export function listPageControls(html: string): PageControl[] {
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') return [];
  try {
    const doc = new window.DOMParser().parseFromString(html, 'text/html');
    return Array.from(doc.querySelectorAll(CLICKABLE_SELECTOR))
      .map((node, index) => ({ node, index }))
      .filter(({ node }) => {
        const parent = node.parentElement?.closest(CLICKABLE_SELECTOR);
        return !parent;
      })
      .map(({ node, index }) => ({
        index,
        label: controlLabel(node),
        tag: node.tagName.toLowerCase(),
        opens: node.getAttribute('data-screen') ?? undefined,
      }));
  } catch {
    return [];
  }
}

/**
 * Writes what each control opens back into the page.
 *
 * Into `data-screen`, which is where the model puts it and where every preview
 * already looks — so a link set by hand and a link the model wrote are the same
 * thing, and neither needs the app to remember anything on the side. The page
 * carries its own wiring, and keeps it when it is copied into a round.
 */
export function setPageControlTargets(html: string, targets: Record<number, string>): string {
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') return html;
  try {
    const doc = new window.DOMParser().parseFromString(html, 'text/html');
    const nodes = Array.from(doc.querySelectorAll(CLICKABLE_SELECTOR));
    for (const [key, name] of Object.entries(targets)) {
      const node = nodes[Number(key)];
      if (!node) continue;
      const trimmed = name.trim();
      if (trimmed) node.setAttribute('data-screen', trimmed);
      else node.removeAttribute('data-screen');
    }
    return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
  } catch {
    return html;
  }
}
