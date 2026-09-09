/**
 * The Customer workspace's tasks — the entries a mini mockup is built from.
 *
 * Lifted out of the view so anything else that needs to read a project's tasks
 * can, without pulling in the whole workspace component. The new-project dialog
 * needs exactly that: to show what an existing project holds before copying
 * any of it.
 *
 * Storage is per project in the browser, seeded on first read, the same
 * seed-plus-overlay split the rest of this mock uses.
 */

import { pageTitleFromHtml } from '@/lib/we-adk/mockup-pages';
import type { IAPlatform, IAScreenType } from './ia';
import { workspaceStore } from '@/lib/api/workspace-store';

export type MeetingKind = 'meeting-note' | 'wireframe';

/** Where a task came from. Kept separate from `kind`, which decides what is generated. */
export type TaskSource = 'meeting' | 'feedback' | 'suggestion';

export const TASK_SOURCES = [
  { id: 'meeting' as TaskSource, label: 'Meeting', icon: '🗣️' },
  { id: 'feedback' as TaskSource, label: 'Feedback', icon: '💬' },
  { id: 'suggestion' as TaskSource, label: 'Suggestion', icon: '💡' },
] as const;

export const SOURCE_STYLE: Record<TaskSource, string> = {
  meeting: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  feedback: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  suggestion: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
};

/**
 * Where a screen sits in the information architecture, as agreed the last time
 * the set was moved to a Product project.
 *
 * The question is asked during the move, which is where it belongs — a screen
 * that arrives in Drafts with no idea where it sits is the thing that makes a
 * Drafts pile hard to clear. Kept here afterwards so a second move opens on
 * the answers rather than asking for the same tree again.
 */
export interface MeetingIA {
  /** The meeting whose screen this one opens from — `null` is top level. */
  parentId: string | null;
  screenType: IAScreenType;
  platform: IAPlatform;
}

export const DEFAULT_MEETING_IA: MeetingIA = { parentId: null, screenType: 'Screen', platform: 'PC' };

/**
 * One generated page.
 *
 * A meeting is a conversation, not a screen: "POS System Kickoff" asks for a
 * login, a catalog, a cart and two reports. Generating produced a single page
 * for the whole meeting, which meant five screens arrived at the Product side
 * as one file with no IA of its own. A page is the thing that has a place in
 * the tree, a link of its own, and a row in Drafts — so a page is what is
 * stored.
 */
export interface MockupScreen {
  id: string;
  name: string;
  /** The generated page itself. */
  html: string;
  /** Where this page sits — set the last time it was moved to a Product project. */
  ia: MeetingIA;
  /** When its html last changed: generated, edited, or rewritten by the chat. */
  updatedAt?: string;
  /** When it was last sent to a product. Absent means it never has been. */
  movedAt?: string;
}

/** A screen against what the product has: new, changed since, or neither. */
export type ScreenChange = 'added' | 'modified' | null;

/**
 * Whether a screen differs from the copy the product was given.
 *
 * Two dates, not a diff of the html: what matters to the person reading the
 * tree is whether the product has seen this screen, and whether it has seen
 * *this* version of it. A screen never moved is new to the product; a screen
 * changed since it was moved is one the product's copy is now behind on.
 */
export function screenChange(screen: MockupScreen): ScreenChange {
  if (!screen.movedAt) return 'added';
  if (screen.updatedAt && screen.updatedAt > screen.movedAt) return 'modified';
  return null;
}

export interface MockupMeeting {
  id: string;
  title: string;
  date: string;
  attendees: string;
  notes: string;
  kind?: MeetingKind;
  /** Absent on entries saved before this existed — they read as meetings. */
  source?: TaskSource;
  /**
   * Who put this here — the person, not the room.
   *
   * `attendees` is who was in the meeting, which is a different question and
   * usually a longer answer. Absent on entries written before this existed;
   * `meetingAuthor` falls back to the first attendee, which is who ran the
   * meeting often enough to be worth showing.
   */
  postedBy?: string;
  /**
   * The first page, kept in step with `screens[0]`.
   *
   * Everything written before pages existed has only this, and the preview and
   * the page editor still read it, so it stays rather than being migrated away.
   */
  htmlPreview?: string;
  /** Absent on entries saved before this existed — see `meetingScreens`. */
  screens?: MockupScreen[];
  /**
   * The Product project these screens are being built into, once one is
   * chosen.
   *
   * Kept on the meeting rather than in the build that chose it: the build ends
   * and the question does not. "What does this meeting add to?" is the frame
   * for reading its screens at all, and without it the tree here shows four
   * screens floating with nothing around them.
   */
  product?: { id: string; name: string };
  /**
   * The product these screens have actually been sent to, once they have.
   *
   * Separate from `product`, which is only where they are being built to fit.
   * Choosing a product is a plan; moving is the fact — and until the fact, this
   * meeting's screens have no place among that product's, so showing them
   * nested inside it would be describing something that has not happened.
   */
  movedTo?: { id: string; name: string };
  /** Absent on entries saved before this existed — they read as top-level PC screens. */
  ia?: MeetingIA;
}

/** Who posted a meeting: what it says, or the best guess its attendees allow. */
export function meetingAuthor(meeting: MockupMeeting): string | undefined {
  const posted = meeting.postedBy?.trim();
  if (posted) return posted;
  const first = meeting.attendees.split(',')[0]?.trim();
  return first || undefined;
}

/** A meeting's IA record, with the defaults an older entry is missing. */
export function meetingIA(meeting: MockupMeeting): MeetingIA {
  return { ...DEFAULT_MEETING_IA, ...meeting.ia };
}

/**
 * The pages a meeting has generated.
 *
 * A meeting written before pages existed holds one page under its own id —
 * the same id its canvas and its stored html already use, so reading it this
 * way costs nothing and nothing has to be migrated.
 */
export function meetingScreens(meeting: MockupMeeting): MockupScreen[] {
  if (meeting.screens && meeting.screens.length > 0) return meeting.screens;
  if (!meeting.htmlPreview) return [];
  return [
    {
      id: meeting.id,
      // The page's own title, not the meeting's: the row is a screen.
      name: pageTitleFromHtml(meeting.htmlPreview) ?? meeting.title,
      html: meeting.htmlPreview,
      ia: meetingIA(meeting),
    },
  ];
}

/** An id for the nth page of a meeting, stable across a regeneration. */
export function screenIdFor(meetingId: string, index: number): string {
  return index === 0 ? meetingId : `${meetingId}-p${index + 1}`;
}

/** A meeting with these pages, its first-page mirror kept in step. */
export function withScreens(meeting: MockupMeeting, screens: MockupScreen[]): MockupMeeting {
  return { ...meeting, screens, htmlPreview: screens[0]?.html ?? meeting.htmlPreview };
}

function storageKey(projectId: string) {
  return `we-adk:mini-mockups:v2:${projectId}`;
}

const SEED_MEETINGS: Record<string, MockupMeeting[]> = {
  'proj-eacc-cloud': [
    {
      id: 'mini-pos-kickoff',
      title: 'POS System Kickoff',
      date: '2026-08-20',
      attendees: 'Shop owner (2), Moka, Kim Minsu, UX designer',
      notes: 'Two shop owners walked us through their daily routine.\n\nCurrent pain points:\n- They use a calculator and a notebook to track sales\n- No way to check what sold today without counting by hand\n- Inventory is guesswork — they only know when something runs out\n\nMust-have screens:\n1. Login — simple PIN entry (4 digits), big number pad, store name at top\n2. Product catalog — grid of products with photo, name, price\n   - Categories as horizontal tabs: All, Drinks, Food, Snacks, Other\n   - Search bar at top, tap card to add to cart\n3. Cart / checkout — right side panel always visible\n   - Items list with qty +/- buttons, line totals\n   - Subtotal, tax (10%), grand total\n   - Payment buttons: Cash, Card, QR\n   - Cash: enter amount received, show change\n4. Daily sales report — summary cards (total revenue, transaction count, avg)\n   - Sales by hour bar chart, filter by date/payment method\n5. Product management — form: photo, name, category, price, stock qty, barcode',
      htmlPreview: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>POS System</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;overflow-x:hidden}.shell{display:flex;height:100vh}.sidebar{width:72px;background:#1e293b;display:flex;flex-direction:column;align-items:center;padding:16px 0;gap:8px}.sidebar .logo{width:40px;height:40px;background:#3b82f6;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;margin-bottom:16px}.sidebar button{width:44px;height:44px;border:none;background:transparent;border-radius:10px;color:#94a3b8;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;transition:all .15s}.sidebar button.active,.sidebar button:hover{background:#334155;color:#fff}.main{flex:1;display:flex;flex-direction:column;overflow:hidden}.topbar{height:56px;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;padding:0 24px;gap:16px}.topbar .search{flex:1;max-width:400px;height:36px;border:1px solid #e2e8f0;border-radius:8px;padding:0 12px;font-size:13px;background:#f8fafc;outline:none}.topbar .search:focus{border-color:#3b82f6;background:#fff}.tabs{display:flex;gap:4px;padding:0 24px;background:#fff;border-bottom:1px solid #e2e8f0}.tab{padding:10px 16px;font-size:13px;font-weight:500;color:#64748b;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s}.tab.active{color:#3b82f6;border-bottom-color:#3b82f6}.content{flex:1;display:flex;overflow:hidden}.catalog{flex:1;padding:20px 24px;overflow-y:auto}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;cursor:pointer;transition:all .15s}.card:hover{border-color:#3b82f6;box-shadow:0 2px 8px rgba(59,130,246,.12)}.card .img{height:100px;background:linear-gradient(135deg,#eff6ff,#e0e7ff);display:flex;align-items:center;justify-content:center;font-size:28px}.card .info{padding:10px 12px}.card .name{font-size:13px;font-weight:600;margin-bottom:2px}.card .price{font-size:14px;font-weight:700;color:#3b82f6}.cart{width:320px;background:#fff;border-left:1px solid #e2e8f0;display:flex;flex-direction:column}.cart-head{padding:16px 20px;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:700;display:flex;justify-content:space-between;align-items:center}.cart-head .count{background:#3b82f6;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px}.cart-items{flex:1;overflow-y:auto;padding:8px 16px}.cart-item{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f8fafc}.cart-item .emoji{font-size:20px}.cart-item .detail{flex:1}.cart-item .iname{font-size:12px;font-weight:600}.cart-item .iprice{font-size:11px;color:#64748b}.cart-item .qty{display:flex;align-items:center;gap:6px}.cart-item .qty button{width:24px;height:24px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center}.cart-item .qty span{font-size:13px;font-weight:600;min-width:16px;text-align:center}.cart-footer{border-top:1px solid #e2e8f0;padding:16px 20px}.row{display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;color:#64748b}.row.total{font-size:16px;font-weight:700;color:#0f172a;margin:10px 0}.pay-btns{display:flex;gap:8px;margin-top:12px}.pay-btn{flex:1;padding:12px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s}.pay-btn.cash{background:#dcfce7;color:#166534}.pay-btn.card{background:#dbeafe;color:#1e40af}.pay-btn.qr{background:#f3e8ff;color:#7c3aed}</style></head><body><div class="shell"><nav class="sidebar"><div class="logo">P</div><button class="active" title="POS">🛒</button><button title="Products">📦</button><button title="Reports">📊</button><button title="Settings">⚙️</button></nav><div class="main"><div class="topbar"><input class="search" placeholder="Search products... (Ctrl+K)"><span style="font-size:13px;color:#64748b">Aug 20, 2026 · 14:32</span></div><div class="tabs"><button class="tab active">All</button><button class="tab">☕ Drinks</button><button class="tab">🍔 Food</button><button class="tab">🍪 Snacks</button><button class="tab">📦 Other</button></div><div class="content"><div class="catalog"><div class="grid"><div class="card"><div class="img">☕</div><div class="info"><div class="name">Americano</div><div class="price">₩4,500</div></div></div><div class="card"><div class="img">🥛</div><div class="info"><div class="name">Café Latte</div><div class="price">₩5,000</div></div></div><div class="card"><div class="img">🍵</div><div class="info"><div class="name">Green Tea</div><div class="price">₩4,000</div></div></div><div class="card"><div class="img">🥤</div><div class="info"><div class="name">Iced Tea</div><div class="price">₩3,500</div></div></div><div class="card"><div class="img">🥐</div><div class="info"><div class="name">Croissant</div><div class="price">₩3,200</div></div></div><div class="card"><div class="img">🍞</div><div class="info"><div class="name">Garlic Bread</div><div class="price">₩2,800</div></div></div><div class="card"><div class="img">🍰</div><div class="info"><div class="name">Cheesecake</div><div class="price">₩6,500</div></div></div><div class="card"><div class="img">🍪</div><div class="info"><div class="name">Cookies (3pc)</div><div class="price">₩3,000</div></div></div><div class="card"><div class="img">🧃</div><div class="info"><div class="name">Orange Juice</div><div class="price">₩4,200</div></div></div><div class="card"><div class="img">🍫</div><div class="info"><div class="name">Hot Chocolate</div><div class="price">₩5,500</div></div></div><div class="card"><div class="img">🥪</div><div class="info"><div class="name">Club Sandwich</div><div class="price">₩7,800</div></div></div><div class="card"><div class="img">🥗</div><div class="info"><div class="name">Caesar Salad</div><div class="price">₩8,500</div></div></div></div></div><div class="cart"><div class="cart-head">Current Order <span class="count">3 items</span></div><div class="cart-items"><div class="cart-item"><span class="emoji">☕</span><div class="detail"><div class="iname">Americano</div><div class="iprice">₩4,500</div></div><div class="qty"><button>−</button><span>2</span><button>+</button></div></div><div class="cart-item"><span class="emoji">🥐</span><div class="detail"><div class="iname">Croissant</div><div class="iprice">₩3,200</div></div><div class="qty"><button>−</button><span>1</span><button>+</button></div></div><div class="cart-item"><span class="emoji">🍰</span><div class="detail"><div class="iname">Cheesecake</div><div class="iprice">₩6,500</div></div><div class="qty"><button>−</button><span>1</span><button>+</button></div></div></div><div class="cart-footer"><div class="row"><span>Subtotal</span><span>₩18,700</span></div><div class="row"><span>Tax (10%)</span><span>₩1,870</span></div><div class="row total"><span>Total</span><span>₩20,570</span></div><div class="pay-btns"><button class="pay-btn cash">💵 Cash</button><button class="pay-btn card">💳 Card</button><button class="pay-btn qr">📱 QR</button></div></div></div></div></div></div></div></body></html>`,
    },
    {
      id: 'mini-inventory',
      title: 'Inventory & Stock Management',
      date: '2026-08-15',
      attendees: 'Shop owner, Warehouse staff, Moka',
      notes: 'Deep dive into how they manage stock today.\n\nCurrent process:\n- Write down deliveries in a notebook\n- Count stock once a week (takes 2 hours)\n- No alerts when something runs low\n\nScreens needed:\n1. Inventory dashboard — cards: total products, low stock count, out of stock, total value\n   - Low stock alerts list with reorder button\n2. Stock adjustment — select product, enter actual count, reason dropdown\n   - Show difference from system count, batch mode\n3. Receiving — log deliveries: supplier, date, reference number\n   - Line items: product, qty received, unit cost\n   - Auto-updates stock on save\n4. Stock history — table: date, product, type, qty change, balance\n   - Filters: date range, product, movement type',
      htmlPreview: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Inventory Management</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a}.layout{display:flex;height:100vh}.side{width:220px;background:#fff;border-right:1px solid #e2e8f0;padding:20px 0}.side .brand{padding:0 20px 20px;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px}.side .brand span{font-size:20px}.nav-item{display:flex;align-items:center;gap:10px;padding:10px 20px;font-size:13px;font-weight:500;color:#64748b;cursor:pointer;transition:all .15s;border-left:3px solid transparent}.nav-item:hover{background:#f8fafc;color:#0f172a}.nav-item.active{background:#eff6ff;color:#3b82f6;border-left-color:#3b82f6;font-weight:600}.nav-item .icon{font-size:16px}.nav-group{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;padding:20px 20px 8px}.main{flex:1;display:flex;flex-direction:column;overflow:hidden}.header{height:56px;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;padding:0 28px}.header h1{font-size:16px;font-weight:700}.header .actions{display:flex;gap:8px}.btn{padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid #e2e8f0;background:#fff;color:#374151;transition:all .15s}.btn:hover{background:#f8fafc}.btn.primary{background:#3b82f6;color:#fff;border-color:#3b82f6}.btn.primary:hover{background:#2563eb}.body{flex:1;overflow-y:auto;padding:24px 28px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px}.stat{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px}.stat .label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:4px}.stat .value{font-size:26px;font-weight:800;margin-bottom:2px}.stat .change{font-size:11px;font-weight:500}.stat .change.up{color:#16a34a}.stat .change.down{color:#dc2626}.section-title{font-size:14px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px}.alert-dot{width:8px;height:8px;border-radius:50%;background:#ef4444;animation:pulse 2s infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}table{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}th{text-align:left;padding:12px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;background:#fafbfc;border-bottom:1px solid #e2e8f0}td{padding:12px 16px;font-size:13px;border-bottom:1px solid #f1f5f9}.stock-badge{padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600}.stock-badge.low{background:#fef2f2;color:#dc2626}.stock-badge.ok{background:#f0fdf4;color:#16a34a}.stock-badge.out{background:#fef2f2;color:#991b1b}.reorder-btn{padding:4px 12px;border-radius:6px;border:1px solid #3b82f6;background:#eff6ff;color:#3b82f6;font-size:11px;font-weight:600;cursor:pointer}tr:last-child td{border-bottom:none}</style></head><body><div class="layout"><nav class="side"><div class="brand"><span>📦</span> StockPOS</div><div class="nav-group">Main</div><div class="nav-item active"><span class="icon">📊</span> Dashboard</div><div class="nav-item"><span class="icon">📋</span> Products</div><div class="nav-item"><span class="icon">🔄</span> Adjustments</div><div class="nav-group">Inbound</div><div class="nav-item"><span class="icon">📥</span> Receiving</div><div class="nav-item"><span class="icon">🏭</span> Suppliers</div><div class="nav-group">History</div><div class="nav-item"><span class="icon">📜</span> Stock Log</div><div class="nav-item"><span class="icon">⚙️</span> Settings</div></nav><div class="main"><div class="header"><h1>Inventory Dashboard</h1><div class="actions"><button class="btn">Export</button><button class="btn primary">+ Add Product</button></div></div><div class="body"><div class="cards"><div class="stat"><div class="label">Total Products</div><div class="value">248</div><div class="change up">↑ 12 this month</div></div><div class="stat"><div class="label">Low Stock</div><div class="value" style="color:#f59e0b">18</div><div class="change down">↑ 3 since yesterday</div></div><div class="stat"><div class="label">Out of Stock</div><div class="value" style="color:#ef4444">4</div><div class="change down">Needs attention</div></div><div class="stat"><div class="label">Total Value</div><div class="value">₩3.2M</div><div class="change up">↑ 8% vs last month</div></div></div><div class="section-title"><span class="alert-dot"></span> Low Stock Alerts</div><table><thead><tr><th>Product</th><th>Category</th><th>Current</th><th>Minimum</th><th>Status</th><th>Action</th></tr></thead><tbody><tr><td style="font-weight:600">Americano Beans (1kg)</td><td>Coffee</td><td>3</td><td>10</td><td><span class="stock-badge low">Low</span></td><td><button class="reorder-btn">Reorder</button></td></tr><tr><td style="font-weight:600">Croissant (frozen, 12pc)</td><td>Bakery</td><td>1</td><td>5</td><td><span class="stock-badge low">Low</span></td><td><button class="reorder-btn">Reorder</button></td></tr><tr><td style="font-weight:600">Paper Cups (M)</td><td>Supplies</td><td>0</td><td>100</td><td><span class="stock-badge out">Out</span></td><td><button class="reorder-btn">Reorder</button></td></tr><tr><td style="font-weight:600">Whole Milk (1L)</td><td>Dairy</td><td>4</td><td>12</td><td><span class="stock-badge low">Low</span></td><td><button class="reorder-btn">Reorder</button></td></tr><tr><td style="font-weight:600">Chocolate Syrup</td><td>Condiments</td><td>0</td><td>3</td><td><span class="stock-badge out">Out</span></td><td><button class="reorder-btn">Reorder</button></td></tr></tbody></table></div></div></div></body></html>`,
    },
    {
      id: 'mini-payment',
      title: 'Payment Integration Design',
      date: '2026-08-18',
      attendees: 'Payment provider rep, Moka, Jung Minjae',
      ia: { parentId: 'mini-pos-kickoff', screenType: 'Popup', platform: 'PC' },
      notes: 'Payment flow design for all 3 methods.\n\nCash payment:\n- Large number pad to enter amount received\n- Show change amount in big bold text\n- Print receipt button at bottom\n\nCard payment:\n- Show "Tap or Insert Card" with card reader illustration\n- Processing spinner with "Connecting to terminal..."\n- Success: green checkmark, amount, receipt option\n- Failure: red X, error message, retry button\n\nQR payment:\n- Generate QR code centered on screen with amount above\n- Countdown timer (5 min expiry)\n- Auto-detect payment confirmation via webhook\n- Success screen with animated checkmark\n\nReceipt design:\n- Store name, address, phone at top\n- Items with qty and price\n- Subtotal, tax, total\n- Payment method, change given\n- Date/time, receipt number\n- "Thank you" message at bottom',
      htmlPreview: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Payment Integration</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9;color:#0f172a;display:flex;justify-content:center;padding:32px 16px;gap:24px;flex-wrap:wrap;min-height:100vh}.panel{background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;width:320px;display:flex;flex-direction:column}.panel-head{padding:16px 20px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px}.panel-head .icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px}.panel-head .icon.cash{background:#dcfce7}.panel-head .icon.card{background:#dbeafe}.panel-head .icon.qr{background:#f3e8ff}.panel-head .text h3{font-size:14px;font-weight:700}.panel-head .text p{font-size:11px;color:#94a3b8}.panel-body{flex:1;padding:20px;display:flex;flex-direction:column;align-items:center}.amount-display{text-align:center;margin-bottom:20px;width:100%}.amount-display .label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:4px}.amount-display .amt{font-size:32px;font-weight:800}.numpad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;max-width:240px;margin-bottom:16px}.numpad button{height:52px;border:1px solid #e2e8f0;border-radius:10px;background:#fafbfc;font-size:20px;font-weight:600;cursor:pointer;transition:all .1s}.numpad button:hover{background:#f1f5f9}.numpad button.clear{font-size:13px;color:#ef4444}.numpad button.enter{background:#16a34a;color:#fff;border-color:#16a34a;font-size:14px;font-weight:700}.change-box{width:100%;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;text-align:center;margin-top:auto}.change-box .clabel{font-size:11px;font-weight:600;color:#16a34a;text-transform:uppercase;letter-spacing:.5px}.change-box .camt{font-size:24px;font-weight:800;color:#16a34a;margin-top:2px}.card-reader{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:16px;text-align:center}.card-icon{width:80px;height:80px;background:#eff6ff;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:36px;animation:bob 2s ease-in-out infinite}@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}.card-reader h3{font-size:16px;font-weight:700}.card-reader p{font-size:13px;color:#64748b;max-width:200px}.status-bar{width:100%;display:flex;align-items:center;gap:8px;padding:12px 16px;border-radius:10px;font-size:12px;font-weight:600;margin-top:auto}.status-bar.ready{background:#eff6ff;color:#2563eb}.status-dot{width:8px;height:8px;border-radius:50%;animation:pulse 1.5s infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}.status-bar.ready .status-dot{background:#3b82f6}.qr-area{display:flex;flex-direction:column;align-items:center;flex:1;justify-content:center;gap:16px}.qr-box{width:180px;height:180px;border:2px solid #e2e8f0;border-radius:16px;display:flex;align-items:center;justify-content:center;background:#fafbfc;position:relative}.qr-pattern{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;width:120px;height:120px}.qr-cell{border-radius:1px}.qr-cell.dark{background:#1e293b}.qr-cell.light{background:transparent}.timer{font-size:13px;font-weight:600;color:#64748b;display:flex;align-items:center;gap:6px}.timer .time{color:#f59e0b;font-weight:700}.scan-text{font-size:12px;color:#94a3b8;text-align:center}.receipt{width:280px;background:#fff;border:1px dashed #cbd5e1;border-radius:4px;padding:24px 20px;font-family:'Courier New',monospace;margin-top:12px;align-self:center}.receipt .rhead{text-align:center;border-bottom:1px dashed #e2e8f0;padding-bottom:12px;margin-bottom:12px}.receipt .rhead h4{font-size:14px;font-weight:700}.receipt .rhead p{font-size:10px;color:#64748b;margin-top:2px}.rline{display:flex;justify-content:space-between;font-size:11px;padding:3px 0}.rline.bold{font-weight:700;font-size:12px;border-top:1px dashed #e2e8f0;margin-top:8px;padding-top:8px}.rfoot{text-align:center;border-top:1px dashed #e2e8f0;margin-top:12px;padding-top:12px;font-size:10px;color:#94a3b8}.print-btn{width:100%;padding:10px;border:none;border-radius:8px;background:#1e293b;color:#fff;font-size:12px;font-weight:600;cursor:pointer;margin-top:12px}</style></head><body><div class="panel"><div class="panel-head"><div class="icon cash">💵</div><div class="text"><h3>Cash Payment</h3><p>Enter amount received</p></div></div><div class="panel-body"><div class="amount-display"><div class="label">Total Due</div><div class="amt">₩20,570</div></div><div class="numpad"><button>1</button><button>2</button><button>3</button><button>4</button><button>5</button><button>6</button><button>7</button><button>8</button><button>9</button><button class="clear">C</button><button>0</button><button class="enter">OK</button></div><div class="change-box"><div class="clabel">Change</div><div class="camt">₩4,430</div></div></div></div><div class="panel"><div class="panel-head"><div class="icon card">💳</div><div class="text"><h3>Card Payment</h3><p>Tap or insert card</p></div></div><div class="panel-body"><div class="amount-display"><div class="label">Charging</div><div class="amt">₩20,570</div></div><div class="card-reader"><div class="card-icon">💳</div><h3>Ready for Card</h3><p>Tap, insert, or swipe your card on the terminal</p></div><div class="status-bar ready"><div class="status-dot"></div>Terminal connected · Waiting for card</div></div></div><div class="panel"><div class="panel-head"><div class="icon qr">📱</div><div class="text"><h3>QR Payment</h3><p>Scan to pay</p></div></div><div class="panel-body"><div class="amount-display"><div class="label">Amount</div><div class="amt">₩20,570</div></div><div class="qr-area"><div class="qr-box"><div class="qr-pattern"><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell light"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell light"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell light"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell light"></div><div class="qr-cell light"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell light"></div><div class="qr-cell dark"></div><div class="qr-cell light"></div><div class="qr-cell dark"></div><div class="qr-cell light"></div><div class="qr-cell dark"></div><div class="qr-cell light"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell light"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell light"></div><div class="qr-cell dark"></div><div class="qr-cell light"></div><div class="qr-cell light"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell light"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell light"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div><div class="qr-cell dark"></div></div></div><div class="timer">⏱ Expires in <span class="time">4:32</span></div><div class="scan-text">Scan with your banking app to complete payment</div></div></div></div><div class="receipt"><div class="rhead"><h4>☕ KOSIGN Café</h4><p>Seoul, Gangnam-gu · 02-555-1234</p></div><div class="rline"><span>Americano x2</span><span>₩9,000</span></div><div class="rline"><span>Croissant x1</span><span>₩3,200</span></div><div class="rline"><span>Cheesecake x1</span><span>₩6,500</span></div><div class="rline bold"><span>Subtotal</span><span>₩18,700</span></div><div class="rline"><span>Tax (10%)</span><span>₩1,870</span></div><div class="rline bold"><span>TOTAL</span><span>₩20,570</span></div><div class="rline"><span>Paid: Cash</span><span>₩25,000</span></div><div class="rline"><span>Change</span><span>₩4,430</span></div><div class="rfoot"><p>Aug 18, 2026 14:32 · #R-20260818-0047</p><p style="margin-top:6px">Thank you for visiting! 🙏</p></div><button class="print-btn">🖨 Print Receipt</button></div></body></html>`,
    },
    {
      id: 'mini-prd-dashboard',
      title: 'Accountant Dashboard',
      date: '2026-08-10',
      attendees: 'Moka, Taehyuk Park, Kim Soyeon (Accountant)',
      kind: 'meeting-note',
      notes: 'PRD: PRD-eacc-accountant-dashboard\n\nObjective: A single-page overview for accountants to see the day\'s work at a glance.\n\nKey requirements:\n- Summary cards: Pending approvals, Today\'s receipts, Unmatched invoices, Month-to-date spend\n- Each card links to its detail page\n- Recent activity feed (last 20 items) — who submitted what, when\n- Quick actions: Approve next, Jump to corp card, Jump to personal expense\n- Date picker to filter by period (today, this week, this month, custom)\n- Budget utilization donut chart by department\n- Notifications bell with unread count\n\nAcceptance criteria:\n- Dashboard loads under 2 seconds\n- Cards update in real-time when approvals change\n- Mobile responsive — cards stack on small screens\n- Date picker defaults to "This month"',
    },
    {
      id: 'mini-prd-corpcard',
      title: 'Corporate Card Expense',
      date: '2026-08-12',
      attendees: 'Moka, Jung Minjae, Finance team (3)',
      kind: 'wireframe',
      notes: 'PRD: PRD-eacc-expensemanagement-corporatecard\n\nObjective: Let employees submit corporate card expenses and managers approve/reject them.\n\nScreens:\n1. Corporate Card List\n   - Table: Date, Merchant, Amount, Category, Status, Submitter\n   - Filters: date range, status (Pending/Approved/Rejected), card holder\n   - Bulk select + Bulk approve button\n   - Each row expands to show receipt image\n\n2. New Charge Form (popup)\n   - Card selector (last 4 digits)\n   - Date, Merchant name, Amount\n   - Category dropdown (Travel, Meals, Office, Software, Other)\n   - Receipt upload (drag & drop + camera)\n   - Notes textarea\n   - Submit button\n\n3. Card Detail (popup)\n   - Full receipt image on left\n   - Expense details on right\n   - Approve / Reject / Return buttons at bottom\n   - Reject requires reason text\n\n4. Bulk Approve\n   - Selected items list with checkboxes\n   - Total amount\n   - Confirm all button',
    },
    {
      id: 'mini-prd-personal',
      title: 'Personal Expense Claim',
      date: '2026-08-14',
      attendees: 'Moka, Kim Minsu, HR rep',
      kind: 'meeting-note',
      notes: 'PRD: PRD-eacc-expensemanagement-personalexpense\n\nObjective: Employees submit personal expense claims with receipts for reimbursement.\n\nScreens:\n1. Expense List — table of claims: Date, Description, Amount, Status, Reimbursement date\n   - Status chips: Draft, Submitted, Approved, Paid, Rejected\n   - "New Claim" button\n\n2. New Expense Form\n   - Date, Description, Amount, Category\n   - Receipt upload (multiple receipts per claim)\n   - Policy reference link\n   - Save as Draft / Submit\n\n3. Expense Detail\n   - Timeline: Submitted → Approved → Paid\n   - Receipt gallery\n   - Comments thread between submitter and approver\n   - Edit (if draft), Withdraw (if submitted)\n\nBusiness rules:\n- Claims over ₩100,000 need 2-level approval\n- Receipts are mandatory for claims over ₩30,000\n- Reimbursement within 5 business days of approval',
    },
    {
      id: 'mini-prd-taxinvoice',
      title: 'Tax Invoice & Cash Receipt',
      date: '2026-08-16',
      attendees: 'Moka, Tax consultant, Taehyuk Park',
      kind: 'wireframe',
      notes: 'PRD: PRD-eacc-tax&receipts-taxinvoice / PRD-eacc-tax&receipts-cashreceipt\n\nObjective: Track and manage tax invoices and cash receipts for compliance.\n\nScreens:\n1. Tax Invoice List\n   - Table: Invoice #, Vendor, Amount, Tax, Date, Status\n   - Status: Received, Matched, Unmatched, Disputed\n   - Search by vendor or invoice number\n   - Download CSV export\n\n2. Invoice Detail (popup)\n   - Left: scanned invoice image\n   - Right: parsed fields (vendor, date, items, amounts)\n   - Match to expense button\n   - Edit parsed fields if OCR was wrong\n\n3. Cash Receipt List\n   - Similar table layout\n   - "New Receipt" button\n   - Monthly summary bar chart at top\n\n4. New Receipt Form\n   - Vendor, Date, Amount, Tax amount\n   - Upload receipt image\n   - Auto-categorize toggle\n\nCompliance:\n- 5-year retention required\n- Monthly reconciliation report for tax authority',
    },
    {
      id: 'mini-prd-approvals',
      title: 'Approval Queue',
      date: '2026-08-17',
      attendees: 'Moka, Manager group (4), Taehyuk Park',
      kind: 'meeting-note',
      notes: 'PRD: PRD-eacc-accountant-approvalqueue\n\nObjective: Central place for managers to review and action all pending approvals.\n\nScreen layout:\n- Tab bar: All, Corp Card, Personal, Tax Invoice\n- Each tab shows a filterable table of items waiting for this manager\n- Columns: Submitter, Type, Description, Amount, Submitted date, Priority\n- Click a row to open the detail popup (reuses existing detail popups)\n- Inline Approve / Reject buttons per row for quick processing\n\nApprove Confirm popup:\n- Shows what you\'re approving (amount, submitter, description)\n- Optional comment field\n- Confirm / Cancel\n\nReturn Reason popup:\n- Textarea for reason (required)\n- Dropdown for common reasons (Missing receipt, Wrong category, Over budget, Other)\n- Return button\n\nNotifications:\n- Badge count on Approval Queue nav item\n- Email digest: daily summary of pending items\n- Push notification for high-priority items (over ₩500,000)',
    },
    {
      id: 'mini-store-settings',
      title: 'Store Settings Follow-up',
      date: '2026-08-22',
      attendees: 'Shop owner, Moka',
      kind: 'meeting-note',
      source: 'feedback',
      notes: 'Short follow-up with the shop owner — one screen only.\n\nThe owner types the same details onto every receipt by hand, so they want one place to set them.\n\nScreen needed:\n1. Store settings — a single settings form, no sub-pages\n   - Store info: store name, address, phone, business registration number\n   - Trading hours: open and close time\n   - Tax: VAT percent, and a rounding rule (none / 10 won / 100 won)\n   - Receipt toggles: auto-print after payment, print thank-you line, print business number\n   - Save and Cancel at the top and bottom\n\nExplicitly out of scope: staff accounts, printer hardware setup, multi-store. Owner said "just the one screen, we can add the rest later."',
      ia: { parentId: null, screenType: 'Screen', platform: 'PC' },
      screens: [
        {
          id: 'mini-store-settings',
          name: 'Store Settings',
          ia: { parentId: null, screenType: 'Screen', platform: 'PC' },
          html: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>매장 설정</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a}.wrap{max-width:760px;margin:0 auto;padding:32px 24px 64px}.head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:24px}.head h1{font-size:20px;font-weight:800;letter-spacing:-.2px}.head p{font-size:13px;color:#64748b;margin-top:4px}.actions{display:flex;gap:8px;flex-shrink:0}.btn{padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #e2e8f0;background:#fff;color:#334155}.btn.primary{background:#3b82f6;color:#fff;border-color:#3b82f6}.card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px 22px;margin-bottom:16px}.card h2{font-size:13px;font-weight:700;margin-bottom:2px}.card .hint{font-size:11px;color:#94a3b8;margin-bottom:16px}.row{display:grid;grid-template-columns:150px 1fr;gap:14px;align-items:center;padding:10px 0;border-top:1px solid #f1f5f9}.row:first-of-type{border-top:none}.row label{font-size:12px;font-weight:600;color:#475569}.row .note{font-size:11px;color:#94a3b8;margin-top:4px}input[type=text],input[type=tel],select{width:100%;height:36px;border:1px solid #e2e8f0;border-radius:8px;padding:0 11px;font-size:13px;background:#fff;color:#0f172a;outline:none}input:focus,select:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}.inline{display:flex;gap:8px;align-items:center}.inline input{max-width:120px}.suffix{font-size:12px;color:#64748b}.switch{width:40px;height:22px;border-radius:999px;background:#3b82f6;position:relative;flex-shrink:0}.switch.off{background:#cbd5e1}.switch span{position:absolute;top:3px;left:21px;width:16px;height:16px;border-radius:50%;background:#fff}.switch.off span{left:3px}.switchrow{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;border-top:1px solid #f1f5f9}.switchrow:first-of-type{border-top:none}.switchrow .t{font-size:12px;font-weight:600;color:#475569}.switchrow .d{font-size:11px;color:#94a3b8;margin-top:2px}.foot{display:flex;justify-content:flex-end;gap:8px;margin-top:24px}</style></head><body><div class="wrap"><div class="head"><div><h1>매장 설정</h1><p>영수증과 세금에 그대로 인쇄되는 정보입니다.</p></div><div class="actions"><button class="btn">취소</button><button class="btn primary">저장</button></div></div><div class="card"><h2>매장 정보</h2><p class="hint">영수증 상단에 인쇄됩니다.</p><div class="row"><label for="name">매장명</label><div><input id="name" type="text" value="카페 모카"></div></div><div class="row"><label for="addr">주소</label><div><input id="addr" type="text" value="서울시 강남구 테헤란로 12길 34"><p class="note">영수증에 두 줄까지 인쇄됩니다.</p></div></div><div class="row"><label for="tel">전화번호</label><div><input id="tel" type="tel" value="02-555-1234"></div></div><div class="row"><label for="biz">사업자등록번호</label><div><input id="biz" type="text" value="123-45-67890"></div></div></div><div class="card"><h2>영업 및 세금</h2><p class="hint">계산 화면의 합계에 바로 반영됩니다.</p><div class="row"><label for="open">영업 시간</label><div class="inline"><input id="open" type="text" value="08:00"><span class="suffix">–</span><input type="text" value="22:00"></div></div><div class="row"><label for="tax">부가세</label><div class="inline"><input id="tax" type="text" value="10"><span class="suffix">%</span></div></div><div class="row"><label for="round">금액 절사</label><div><select id="round"><option>절사 없음</option><option selected>10원 단위 절사</option><option>100원 단위 절사</option></select></div></div></div><div class="card"><h2>영수증</h2><p class="hint">결제가 끝난 뒤의 동작입니다.</p><div class="switchrow"><div><div class="t">자동 인쇄</div><div class="d">결제 완료와 동시에 영수증을 출력합니다.</div></div><div class="switch"><span></span></div></div><div class="switchrow"><div><div class="t">감사 문구 인쇄</div><div class="d">"감사합니다. 또 오세요!"</div></div><div class="switch"><span></span></div></div><div class="switchrow"><div><div class="t">사업자번호 인쇄</div><div class="d">현금영수증 발행 시에는 항상 인쇄됩니다.</div></div><div class="switch off"><span></span></div></div></div><div class="foot"><button class="btn">취소</button><button class="btn primary">저장</button></div></div></body></html>`,
        },
      ],
      htmlPreview: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>매장 설정</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a}.wrap{max-width:760px;margin:0 auto;padding:32px 24px 64px}.head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:24px}.head h1{font-size:20px;font-weight:800;letter-spacing:-.2px}.head p{font-size:13px;color:#64748b;margin-top:4px}.actions{display:flex;gap:8px;flex-shrink:0}.btn{padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #e2e8f0;background:#fff;color:#334155}.btn.primary{background:#3b82f6;color:#fff;border-color:#3b82f6}.card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px 22px;margin-bottom:16px}.card h2{font-size:13px;font-weight:700;margin-bottom:2px}.card .hint{font-size:11px;color:#94a3b8;margin-bottom:16px}.row{display:grid;grid-template-columns:150px 1fr;gap:14px;align-items:center;padding:10px 0;border-top:1px solid #f1f5f9}.row:first-of-type{border-top:none}.row label{font-size:12px;font-weight:600;color:#475569}.row .note{font-size:11px;color:#94a3b8;margin-top:4px}input[type=text],input[type=tel],select{width:100%;height:36px;border:1px solid #e2e8f0;border-radius:8px;padding:0 11px;font-size:13px;background:#fff;color:#0f172a;outline:none}input:focus,select:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}.inline{display:flex;gap:8px;align-items:center}.inline input{max-width:120px}.suffix{font-size:12px;color:#64748b}.switch{width:40px;height:22px;border-radius:999px;background:#3b82f6;position:relative;flex-shrink:0}.switch.off{background:#cbd5e1}.switch span{position:absolute;top:3px;left:21px;width:16px;height:16px;border-radius:50%;background:#fff}.switch.off span{left:3px}.switchrow{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;border-top:1px solid #f1f5f9}.switchrow:first-of-type{border-top:none}.switchrow .t{font-size:12px;font-weight:600;color:#475569}.switchrow .d{font-size:11px;color:#94a3b8;margin-top:2px}.foot{display:flex;justify-content:flex-end;gap:8px;margin-top:24px}</style></head><body><div class="wrap"><div class="head"><div><h1>매장 설정</h1><p>영수증과 세금에 그대로 인쇄되는 정보입니다.</p></div><div class="actions"><button class="btn">취소</button><button class="btn primary">저장</button></div></div><div class="card"><h2>매장 정보</h2><p class="hint">영수증 상단에 인쇄됩니다.</p><div class="row"><label for="name">매장명</label><div><input id="name" type="text" value="카페 모카"></div></div><div class="row"><label for="addr">주소</label><div><input id="addr" type="text" value="서울시 강남구 테헤란로 12길 34"><p class="note">영수증에 두 줄까지 인쇄됩니다.</p></div></div><div class="row"><label for="tel">전화번호</label><div><input id="tel" type="tel" value="02-555-1234"></div></div><div class="row"><label for="biz">사업자등록번호</label><div><input id="biz" type="text" value="123-45-67890"></div></div></div><div class="card"><h2>영업 및 세금</h2><p class="hint">계산 화면의 합계에 바로 반영됩니다.</p><div class="row"><label for="open">영업 시간</label><div class="inline"><input id="open" type="text" value="08:00"><span class="suffix">–</span><input type="text" value="22:00"></div></div><div class="row"><label for="tax">부가세</label><div class="inline"><input id="tax" type="text" value="10"><span class="suffix">%</span></div></div><div class="row"><label for="round">금액 절사</label><div><select id="round"><option>절사 없음</option><option selected>10원 단위 절사</option><option>100원 단위 절사</option></select></div></div></div><div class="card"><h2>영수증</h2><p class="hint">결제가 끝난 뒤의 동작입니다.</p><div class="switchrow"><div><div class="t">자동 인쇄</div><div class="d">결제 완료와 동시에 영수증을 출력합니다.</div></div><div class="switch"><span></span></div></div><div class="switchrow"><div><div class="t">감사 문구 인쇄</div><div class="d">"감사합니다. 또 오세요!"</div></div><div class="switch"><span></span></div></div><div class="switchrow"><div><div class="t">사업자번호 인쇄</div><div class="d">현금영수증 발행 시에는 항상 인쇄됩니다.</div></div><div class="switch off"><span></span></div></div></div><div class="foot"><button class="btn">취소</button><button class="btn primary">저장</button></div></div></body></html>`,
    },
  ],
};

/** Which seeded meetings a project has already been offered. */
function seededKey(projectId: string): string {
  return `we-adk:mini-mockups:seeded:${projectId}`;
}

function loadSeeded(projectId: string): string[] {
  try {
    const raw = workspaceStore.getItem(seededKey(projectId));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveSeeded(projectId: string, ids: string[]): void {
  try {
    workspaceStore.setItem(seededKey(projectId), JSON.stringify(ids));
  } catch {
    // Storage unavailable — the seed will be offered again next time.
  }
}

/**
 * A project's meetings, with any seeded ones it has not been offered yet.
 *
 * Seeding only on an empty project was the obvious rule and the wrong one: a
 * project is empty exactly once, so a meeting added to the seed afterwards
 * could never appear in a project anyone had already opened — which is every
 * project that matters. So the seeds are offered by id, once each, and what is
 * offered is recorded.
 *
 * Recorded rather than inferred, because "not in the list" cannot tell a
 * meeting that is new from one that was deleted on purpose. Delete a seeded
 * meeting and it stays deleted; add a seed and it turns up once.
 */
export function loadMockups(projectId: string): MockupMeeting[] {
  try {
    const seed = SEED_MEETINGS[projectId] ?? SEED_MEETINGS['proj-eacc-cloud'] ?? [];
    const raw = workspaceStore.getItem(storageKey(projectId));

    if (!raw) {
      saveSeeded(projectId, seed.map((meeting) => meeting.id));
      if (seed.length > 0) saveMockups(projectId, seed);
      return seed;
    }

    const stored = JSON.parse(raw) as MockupMeeting[];
    const known = new Set([...loadSeeded(projectId), ...stored.map((meeting) => meeting.id)]);
    const added = seed.filter((meeting) => !known.has(meeting.id));
    if (added.length === 0) return stored;

    const next = [...stored, ...added];
    saveSeeded(projectId, [...known, ...added.map((meeting) => meeting.id)]);
    saveMockups(projectId, next);
    return next;
  } catch {
    return [];
  }
}

export function saveMockups(projectId: string, meetings: MockupMeeting[]): void {
  try { workspaceStore.setItem(storageKey(projectId), JSON.stringify(meetings)); } catch {}
}
