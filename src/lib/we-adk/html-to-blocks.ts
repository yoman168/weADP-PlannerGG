/**
 * Analyse an HTML string and produce wireframe blocks that approximate the page
 * structure. Recursively walks layout containers to extract content from
 * sidebar + main area patterns common in SaaS dashboards.
 *
 * Browser-only — requires DOMParser.
 */
import {
  createBlock,
  screenStorageKey,
  type BlockProps,
  type CanvasBlock,
} from '@/lib/we-adk-mock/sketcher';
import { workspaceStore } from '@/lib/api/workspace-store';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function txt(el: Element | null, max = 80): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cls(el: Element): string {
  return el.className?.toString?.() ?? '';
}

/** True when this element is a layout wrapper (flex/grid container with no own content). */
function isLayoutContainer(el: Element): boolean {
  const style = (el as HTMLElement).style;
  const c = cls(el);
  if (c.includes('shell') || c.includes('layout') || c.includes('wrapper') || c.includes('container') || c.includes('app')) return true;
  if (style?.display === 'flex' || style?.display === 'grid') return true;
  // A div whose only children are other block-level elements
  if (el.tagName === 'DIV' && el.children.length >= 2) {
    const kids = Array.from(el.children);
    const allBlocks = kids.every((k) =>
      ['DIV', 'NAV', 'ASIDE', 'MAIN', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER'].includes(k.tagName),
    );
    if (allBlocks) return true;
  }
  return false;
}

/** True when this element looks like a sidebar/navigation panel. */
function isSidebar(el: Element): boolean {
  const tag = el.tagName;
  const c = cls(el);
  if (tag === 'NAV' || tag === 'ASIDE') return true;
  if (c.includes('sidebar') || c.includes('side-bar') || c.includes('sidenav') || c.includes('nav-panel')) return true;
  // A narrow div with navigation links
  const links = el.querySelectorAll('a, button');
  const width = (el as HTMLElement).style?.width;
  if (links.length >= 3 && (width?.includes('px') || c.includes('nav'))) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* Element → Block mapping                                             */
/* ------------------------------------------------------------------ */

function processElement(el: Element, blocks: CanvasBlock[]): void {
  const tag = el.tagName;
  const c = cls(el);
  if (['SCRIPT', 'STYLE', 'LINK', 'META'].includes(tag)) return;
  if ((el as HTMLElement).offsetHeight !== undefined && (el as HTMLElement).offsetHeight < 2 && tag !== 'HR') return;

  // --- Layout container → recurse into children ---
  if (isLayoutContainer(el)) {
    const kids = Array.from(el.children).filter((k) => !['SCRIPT', 'STYLE'].includes(k.tagName));
    for (const kid of kids) {
      if (isSidebar(kid)) {
        // Extract sidebar as statusTabs
        const items = Array.from(kid.querySelectorAll('a, button, [class*="nav-item"], [class*="menu-item"]'))
          .map((a) => txt(a, 30)).filter((t) => t && t.length > 1);
        if (items.length >= 2) {
          blocks.push(createBlock('statusTabs', {
            tabs: items.slice(0, 10).map((label, i) => ({ label, count: i === 0 ? 1 : 0 })),
            activeIndex: 0,
          }));
        }
        continue;
      }
      processElement(kid, blocks);
    }
    return;
  }

  // --- Screen header (h1 or header-like) ---
  const h1 = el.querySelector('h1') ?? (tag === 'H1' ? el : null);
  if (tag === 'HEADER' || (h1 && el.querySelectorAll('button, a, span').length > 0)) {
    const btns = Array.from(el.querySelectorAll('button, a[class*="btn"], [class*="btn"]'))
      .map((b) => txt(b, 30)).filter(Boolean).slice(0, 4)
      .map((label) => ({ label, variant: 'outline' as const }));
    blocks.push(createBlock('screenHeader', {
      label: txt(h1 ?? el, 60) || 'Page Title',
      subtitle: txt(el.querySelector('.eyebrow, .breadcrumb, .subtitle, [class*="sub"]')) || undefined,
      buttons: btns.length > 0 ? btns : undefined,
    }));
    return;
  }

  // --- Stat cards (grid of number cards) ---
  const cardEls = el.querySelectorAll('[class*="stat"], [class*="card"], [class*="metric"], [class*="kpi"], [class*="summary"]');
  if (cardEls.length >= 2 && cardEls.length <= 8) {
    const pairs: BlockProps['pairs'] = [];
    let isStat = false;
    cardEls.forEach((card) => {
      const nums = card.textContent?.match(/[\d,]+\.?\d*/g);
      if (nums && nums.length > 0) {
        isStat = true;
        const allText = Array.from(card.querySelectorAll('span, p, div, dt, h3, h4, label'))
          .map((e) => e.textContent?.trim()).filter((t) => t && t.length > 1 && !/^[\d,$.%₩€£¥៛฿₫₹]+$/.test(t));
        const cardCls = cls(card);
        const tone = cardCls.includes('green') || cardCls.includes('success') ? 'green'
          : cardCls.includes('red') || cardCls.includes('danger') ? 'red'
          : cardCls.includes('amber') || cardCls.includes('warning') ? 'amber'
          : cardCls.includes('blue') || cardCls.includes('info') ? 'blue'
          : 'neutral';
        pairs.push({ key: allText[0] ?? 'Metric', value: nums[0] ?? '0', note: allText[1] ?? undefined, tone });
      }
    });
    if (isStat && pairs.length >= 2) {
      blocks.push(createBlock('statCards', { pairs }));
      return;
    }
  }

  // --- Table ---
  const table = el.tagName === 'TABLE' ? el : el.querySelector('table');
  if (table) {
    const columns = Array.from(table.querySelectorAll('thead th, thead td')).map((th) => txt(th, 30)).filter(Boolean);
    const data = Array.from(table.querySelectorAll('tbody tr')).slice(0, 10).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => txt(td, 50)),
    );
    blocks.push(createBlock('table', {
      label: txt(el.querySelector('h2, h3, h4, caption, [class*="title"]')) || undefined,
      columns: columns.length > 0 ? columns : ['Col 1', 'Col 2', 'Col 3'],
      data: data.length > 0 ? data : undefined,
      rows: Math.min(data.length || 6, 10),
      showHeader: true,
    }));
    return;
  }

  // --- Tabs / nav bar ---
  if (tag === 'NAV' || c.includes('tab') || c.includes('nav')) {
    const items = Array.from(el.querySelectorAll('a, button')).map((a) => txt(a, 30)).filter(Boolean);
    if (items.length >= 2) {
      blocks.push(createBlock('statusTabs', {
        tabs: items.slice(0, 8).map((label, i) => ({ label, count: i === 0 ? 1 : 0 })),
        activeIndex: 0,
      }));
      return;
    }
  }

  // --- Alert / notification section ---
  if (c.includes('alert') || c.includes('notification') || c.includes('warning') || c.includes('banner') || el.getAttribute('role') === 'alert') {
    blocks.push(createBlock('banner', {
      label: txt(el.querySelector('strong, b, h3, h4, [class*="title"]') ?? el, 80),
      helpText: txt(el.querySelector('p, [class*="desc"], [class*="body"]')) || undefined,
      tone: c.includes('error') || c.includes('danger') || c.includes('red') ? 'red'
        : c.includes('warning') || c.includes('amber') ? 'amber'
        : c.includes('success') || c.includes('green') ? 'green' : 'info',
    }));
    return;
  }

  // --- List of cards/items with details ---
  const listItems = el.querySelectorAll('[class*="item"], [class*="row"]:not(tr), [class*="card"], li');
  if (listItems.length >= 3) {
    // Check if items have sub-content (titles + descriptions)
    const pairs: BlockProps['pairs'] = [];
    listItems.forEach((li) => {
      const title = txt(li.querySelector('h3, h4, strong, b, [class*="title"], [class*="name"]') ?? li, 60);
      const sub = txt(li.querySelector('p, span, [class*="desc"], [class*="sub"], [class*="detail"]'), 60);
      if (title) pairs.push({ key: title, value: sub || '', tone: 'neutral' });
    });
    if (pairs.length >= 2) {
      blocks.push(createBlock('taskList', {
        label: txt(el.querySelector('h2, h3, h4, [class*="title"]')) || 'Items',
        pairs: pairs.slice(0, 10),
      }));
      return;
    }
  }

  // --- Form with inputs ---
  const inputs = el.querySelectorAll('input, textarea, select');
  if (inputs.length >= 2) {
    const pairs: BlockProps['pairs'] = [];
    inputs.forEach((inp) => {
      const lbl = inp.closest('label, .field, .form-group, [class*="field"]')?.querySelector('label, span')?.textContent?.trim()
        ?? inp.getAttribute('placeholder') ?? inp.getAttribute('name') ?? 'Field';
      pairs.push({ key: lbl.slice(0, 40), value: (inp.getAttribute('value') ?? '').slice(0, 50) });
    });
    blocks.push(createBlock('formGrid', {
      label: txt(el.querySelector('h2, h3, h4, legend')) || 'Form',
      pairs,
    }));
    return;
  }

  // --- Search / filter bar ---
  const search = el.querySelector('input[type="search"], input[placeholder*="earch"], input[placeholder*="검색"], [class*="search"], [class*="filter"]');
  if (search && !el.querySelector('table')) {
    const selects = Array.from(el.querySelectorAll('select, [class*="select"], [class*="dropdown"]'));
    const controls: BlockProps['controls'] = [
      { type: 'search' as const, placeholder: search.getAttribute('placeholder') ?? 'Search…' },
    ];
    selects.slice(0, 3).forEach((sel) => {
      controls.push({ type: 'select' as const, label: txt(sel, 20) || 'Filter', options: ['All'] });
    });
    blocks.push(createBlock('filterBar', { controls }));
    return;
  }

  // --- Key-value pairs ---
  const dts = el.querySelectorAll('dt, th');
  const dds = el.querySelectorAll('dd, td');
  if (dts.length >= 2 && dts.length === dds.length && !el.querySelector('tbody')) {
    const pairs: BlockProps['pairs'] = [];
    dts.forEach((dt, i) => pairs.push({ key: txt(dt, 40), value: txt(dds[i]!, 50) }));
    blocks.push(createBlock('keyValue', {
      label: txt(el.querySelector('h2, h3, h4')) || 'Details',
      pairs,
    }));
    return;
  }

  // --- Progress bars ---
  if (c.includes('progress') || el.querySelector('[class*="progress"], progress')) {
    const pct = el.textContent?.match(/(\d+)%/);
    blocks.push(createBlock('progressSummary', {
      label: txt(el.querySelector('span, p, label, [class*="label"]')) || 'Progress',
      progress: pct ? Number(pct[1]) : 50,
    }));
    return;
  }

  // --- Heading ---
  if (['H1', 'H2', 'H3', 'H4'].includes(tag)) {
    blocks.push(createBlock('heading', {
      label: txt(el),
      headingLevel: tag === 'H1' ? 1 : tag === 'H3' || tag === 'H4' ? 3 : 2,
    }));
    return;
  }

  // --- Buttons ---
  const btns = el.querySelectorAll('button, a[class*="btn"], [class*="btn"]');
  if (btns.length >= 1 && btns.length <= 6 && el.querySelectorAll('input, table, h1, nav').length === 0) {
    blocks.push(createBlock('buttonBar', {
      buttons: Array.from(btns).slice(0, 6).map((b) => ({
        label: txt(b, 30) || 'Button',
        variant: 'outline' as const,
      })),
    }));
    return;
  }

  // --- Divider ---
  if (tag === 'HR') { blocks.push(createBlock('divider')); return; }

  // --- Paragraph ---
  if (tag === 'P') { blocks.push(createBlock('paragraph', { label: txt(el, 200) })); return; }

  // --- Section with heading + content → recurse ---
  const sectionH = el.querySelector(':scope > h2, :scope > h3, :scope > h4, :scope > [class*="title"], :scope > [class*="header"]');
  if (sectionH && el.children.length >= 2) {
    // Add heading for the section
    blocks.push(createBlock('heading', { label: txt(sectionH), headingLevel: 2 }));
    // Process remaining children
    for (const kid of Array.from(el.children)) {
      if (kid === sectionH) continue;
      processElement(kid, blocks);
    }
    return;
  }

  // --- Container div with meaningful children → recurse ---
  if (tag === 'DIV' || tag === 'SECTION' || tag === 'MAIN' || tag === 'ARTICLE') {
    const kids = Array.from(el.children).filter((k) => !['SCRIPT', 'STYLE'].includes(k.tagName));
    if (kids.length >= 2) {
      for (const kid of kids) processElement(kid, blocks);
      return;
    }
    // Single child — try it
    if (kids.length === 1) {
      processElement(kids[0]!, blocks);
      return;
    }
    // Leaf div with text
    const t = txt(el, 200);
    if (t.length > 20) {
      blocks.push(createBlock('paragraph', { label: t }));
    }
    return;
  }

  // --- Footer ---
  if (tag === 'FOOTER') {
    blocks.push(createBlock('caption', { label: txt(el, 100) }));
    return;
  }
}

/* ------------------------------------------------------------------ */
/* Main export                                                         */
/* ------------------------------------------------------------------ */

export function htmlToBlocks(html: string): CanvasBlock[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;
  if (!body) return [];

  const blocks: CanvasBlock[] = [];

  // Start from body and recurse
  const topKids = Array.from(body.children).filter(
    (el) => !['SCRIPT', 'STYLE', 'LINK', 'META'].includes(el.tagName),
  );

  for (const el of topKids) {
    processElement(el, blocks);
  }

  // If nothing was extracted, add a screen header
  if (blocks.length === 0) {
    blocks.push(createBlock('screenHeader', { label: doc.querySelector('title')?.textContent ?? 'Untitled' }));
  }

  return blocks;
}

/**
 * Save blocks + HTML for a screen so Preview and Edit are in sync.
 * Call after Claude generates HTML from chat.
 */
export function saveHtmlAndBlocks(screenId: string, html: string): void {
  try {
    workspaceStore.setItem(`we-adk:design-html:${screenId}`, html);
    const blocks = htmlToBlocks(html);
    if (blocks.length > 0) {
      workspaceStore.setItem(screenStorageKey(screenId), JSON.stringify(blocks));
    }
    window.dispatchEvent(new Event('we-adk:html-updated'));
    window.dispatchEvent(new Event('we-adk:canvas-saved'));
  } catch { /* storage full */ }
}
