/**
 * The eACC Cloud prototype: one html file per screen.
 *
 * `version 1` of the eACC project is this prototype rather than a set of
 * wireframes — the customer walks 13 real screens, and every one of them can be
 * previewed, edited section by section, and downloaded as html.
 *
 * The screens themselves live under `src/app/eacc/…`. This file is the index:
 * what the file is called, which route renders it, and where its layout edits
 * are kept.
 */
import { type Chip } from '@/lib/we-adk-mock/types';

export interface PrototypeFile {
  /** Canvas id — what `?screen=` carries and the preview resolves. */
  id: string;
  /** Short name used in urls and storage keys. */
  slug: string;
  /** File name in the explorer, e.g. `10-cash-receipt.html`. */
  fileName: string;
  /** Screen title. */
  name: string;
  /** Route that renders this screen inside the app. */
  route: string;
  /** One line on what the screen is for. */
  summary: string;
  /** Human-readable breadcrumb path, e.g. "Expense Management > Corporate Card". */
  path?: string;
  status: Chip;
  updatedAt: string;
  /** False for screens that stand alone, like login — no sidebar or header. */
  chrome: boolean;
}

/** The project whose baseline version holds the prototype. */
export const PROTOTYPE_PROJECT_ID = 'proj-eacc-cloud';

const SHIPPED: Chip = { label: 'Shipped', tone: 'green' };
const IN_REVIEW: Chip = { label: 'In review', tone: 'blue' };
const DRAFT: Chip = { label: 'Draft', tone: 'slate' };

export const PROTOTYPE_FILES: PrototypeFile[] = [
  {
    id: 'proto-login',
    slug: 'login',
    fileName: '01-login.html',
    name: 'Login',
    route: '/eacc/login',
    summary: 'Email and password, with company SSO deferred to phase 2.',
    path: 'Login',
    status: SHIPPED,
    updatedAt: '2026-07-24',
    chrome: false,
  },
  {
    id: 'proto-dashboard',
    slug: 'dashboard',
    fileName: '02-dashboard.html',
    name: 'Dashboard',
    route: '/eacc/dashboard',
    summary: 'What needs the accountant today, spend by category, recent activity.',
    path: 'Accountant > Dashboard',
    status: IN_REVIEW,
    updatedAt: '2026-07-29',
    chrome: true,
  },
  {
    id: 'proto-close-status',
    slug: 'close-status',
    fileName: '03-close-status.html',
    name: 'Month-end Close Status',
    route: '/eacc/close',
    summary: 'The single screen that answers "what is blocking the close?".',
    path: 'Accountant > Month-end Close > Close Status',
    status: SHIPPED,
    updatedAt: '2026-06-18',
    chrome: true,
  },
  {
    id: 'proto-close-blockers',
    slug: 'close-blockers',
    fileName: '04-close-blockers.html',
    name: 'Close Blockers by Cost Centre',
    route: '/eacc/close/blockers',
    summary: 'Every blocked item, grouped the way the accountants scan them.',
    path: 'Accountant > Month-end Close > Close Blockers',
    status: SHIPPED,
    updatedAt: '2026-06-18',
    chrome: true,
  },
  {
    id: 'proto-corp-card',
    slug: 'corporate-card',
    fileName: '05-corporate-card.html',
    name: 'Corporate Card',
    route: '/eacc/corp-card',
    summary: 'Card charges for the month, defaulted to Draft.',
    path: 'Expense Management > Corporate Card',
    status: SHIPPED,
    updatedAt: '2026-07-03',
    chrome: true,
  },
  {
    id: 'proto-corp-card-bulk',
    slug: 'corporate-card-bulk-approve',
    fileName: '06-corporate-card-bulk-approve.html',
    name: 'Corporate Card > Bulk Approve',
    route: '/eacc/corp-card/bulk',
    summary: 'Approve a whole calendar month per department, not row by row.',
    path: 'Expense Management > Corporate Card > Bulk Approve',
    status: IN_REVIEW,
    updatedAt: '2026-07-28',
    chrome: true,
  },
  {
    id: 'proto-personal-expense',
    slug: 'personal-expense',
    fileName: '07-personal-expense.html',
    name: 'Personal Expense',
    route: '/eacc/personal-expense',
    summary: 'Expense list with the "returned to me" tab from the July review.',
    path: 'Expense Management > Personal Expense',
    status: DRAFT,
    updatedAt: '2026-07-29',
    chrome: true,
  },
  {
    id: 'proto-expense-detail',
    slug: 'personal-expense-detail',
    fileName: '08-personal-expense-detail.html',
    name: 'Expense Report Detail',
    route: '/eacc/personal-expense/detail',
    summary: 'A returned report: the reason, the lines to fix, and resubmit.',
    path: 'Expense Management > Personal Expense > Report Detail',
    status: DRAFT,
    updatedAt: '2026-07-30',
    chrome: true,
  },
  {
    id: 'proto-tax-invoice',
    slug: 'tax-invoice',
    fileName: '09-tax-invoice.html',
    name: 'Purchase Tax Invoice',
    route: '/eacc/tax-invoice',
    summary: 'Invoice list, date range defaulted to the current month.',
    path: 'Tax & Receipts > Tax Invoice',
    status: SHIPPED,
    updatedAt: '2026-07-06',
    chrome: true,
  },
  {
    id: 'proto-cash-receipt',
    slug: 'cash-receipt',
    fileName: '10-cash-receipt.html',
    name: 'Cash Receipt',
    route: '/eacc/cash-receipt',
    summary: 'Receipt number replaces the internal id in the list.',
    path: 'Tax & Receipts > Cash Receipt',
    status: SHIPPED,
    updatedAt: '2026-07-02',
    chrome: true,
  },
  {
    id: 'proto-receipt-detail',
    slug: 'cash-receipt-detail',
    fileName: '11-cash-receipt-detail.html',
    name: 'Cash Receipt Detail',
    route: '/eacc/cash-receipt/detail',
    summary: 'One receipt with its line items, evidence and approval box.',
    path: 'Tax & Receipts > Cash Receipt > Receipt Detail',
    status: IN_REVIEW,
    updatedAt: '2026-07-30',
    chrome: true,
  },
  {
    id: 'proto-approvals',
    slug: 'approval-queue',
    fileName: '12-approval-queue.html',
    name: 'Approval Queue',
    route: '/eacc/approvals',
    summary: 'Scoped to the signed-in approver, overdue first.',
    path: 'Accountant > Approval Queue',
    status: IN_REVIEW,
    updatedAt: '2026-07-31',
    chrome: true,
  },
  {
    id: 'proto-settings',
    slug: 'settings',
    fileName: '13-settings.html',
    name: 'Settings',
    route: '/eacc/settings',
    summary: 'Company details, close policy and workspace members.',
    path: 'Administration > Settings',
    status: DRAFT,
    updatedAt: '2026-07-31',
    chrome: true,
  },
  // Popup screens
  {
    id: 'proto-dashboard-date-picker',
    slug: 'dashboard-date-picker',
    fileName: '14-dashboard-date-picker.html',
    name: 'Date Picker',
    route: '/eacc/dashboard/date-picker',
    summary: 'Date range picker for the dashboard period.',
    path: 'Accountant > Dashboard > Date Picker',
    status: DRAFT,
    updatedAt: '2026-08-01',
    chrome: true,
  },
  {
    id: 'proto-corp-card-new-charge',
    slug: 'corp-card-new-charge',
    fileName: '15-corp-card-new-charge.html',
    name: 'New Charge',
    route: '/eacc/corp-card/new-charge',
    summary: 'Add a new corporate card charge.',
    path: 'Expense Management > Corporate Card > New Charge',
    status: DRAFT,
    updatedAt: '2026-08-01',
    chrome: true,
  },
  {
    id: 'proto-corp-card-detail',
    slug: 'corp-card-detail',
    fileName: '16-corp-card-detail.html',
    name: 'Card Detail',
    route: '/eacc/corp-card/detail',
    summary: 'Card charge detail with receipt and approval info.',
    path: 'Expense Management > Corporate Card > Card Detail',
    status: DRAFT,
    updatedAt: '2026-08-01',
    chrome: true,
  },
  {
    id: 'proto-corp-card-reject',
    slug: 'corp-card-reject',
    fileName: '17-corp-card-reject.html',
    name: 'Reject Reason',
    route: '/eacc/corp-card/reject',
    summary: 'Reject reason dialog with note.',
    path: 'Expense Management > Corporate Card > Reject Reason',
    status: DRAFT,
    updatedAt: '2026-08-01',
    chrome: true,
  },
  {
    id: 'proto-personal-expense-new',
    slug: 'personal-expense-new',
    fileName: '18-personal-expense-new.html',
    name: 'New Expense',
    route: '/eacc/personal-expense/new',
    summary: 'New personal expense entry form.',
    path: 'Expense Management > Personal Expense > New Expense',
    status: DRAFT,
    updatedAt: '2026-08-01',
    chrome: true,
  },
  {
    id: 'proto-personal-expense-receipt',
    slug: 'personal-expense-receipt',
    fileName: '19-personal-expense-receipt.html',
    name: 'Add Receipt',
    route: '/eacc/personal-expense/receipt',
    summary: 'Receipt upload/attach dialog.',
    path: 'Expense Management > Personal Expense > Add Receipt',
    status: DRAFT,
    updatedAt: '2026-08-01',
    chrome: true,
  },
  {
    id: 'proto-tax-invoice-detail',
    slug: 'tax-invoice-detail',
    fileName: '20-tax-invoice-detail.html',
    name: 'Invoice Detail',
    route: '/eacc/tax-invoice/detail',
    summary: 'Tax invoice detail view.',
    path: 'Tax & Receipts > Tax Invoice > Invoice Detail',
    status: DRAFT,
    updatedAt: '2026-08-01',
    chrome: true,
  },
  {
    id: 'proto-cash-receipt-new',
    slug: 'cash-receipt-new',
    fileName: '21-cash-receipt-new.html',
    name: 'New Receipt',
    route: '/eacc/cash-receipt/new',
    summary: 'New cash receipt entry form.',
    path: 'Tax & Receipts > Cash Receipt > New Receipt',
    status: DRAFT,
    updatedAt: '2026-08-01',
    chrome: true,
  },
  {
    id: 'proto-approvals-confirm',
    slug: 'approvals-confirm',
    fileName: '22-approvals-confirm.html',
    name: 'Approve Confirm',
    route: '/eacc/approvals/confirm',
    summary: 'Approval confirmation with summary.',
    path: 'Accountant > Approval Queue > Approve Confirm',
    status: DRAFT,
    updatedAt: '2026-08-01',
    chrome: true,
  },
  {
    id: 'proto-approvals-return',
    slug: 'approvals-return',
    fileName: '23-approvals-return.html',
    name: 'Return Reason',
    route: '/eacc/approvals/return',
    summary: 'Return reason dialog.',
    path: 'Accountant > Approval Queue > Return Reason',
    status: DRAFT,
    updatedAt: '2026-08-01',
    chrome: true,
  },
  {
    id: 'proto-settings-invite',
    slug: 'settings-invite',
    fileName: '24-settings-invite.html',
    name: 'Invite Member',
    route: '/eacc/settings/invite',
    summary: 'Invite team member form.',
    path: 'Administration > Settings > Invite Member',
    status: DRAFT,
    updatedAt: '2026-08-01',
    chrome: true,
  },
  {
    id: 'proto-settings-edit-role',
    slug: 'settings-edit-role',
    fileName: '25-settings-edit-role.html',
    name: 'Edit Role',
    route: '/eacc/settings/edit-role',
    summary: 'Edit member role dialog.',
    path: 'Administration > Settings > Edit Role',
    status: DRAFT,
    updatedAt: '2026-08-01',
    chrome: true,
  },
];

/**
 * A copy of an html file inside a later round carries the id it came from with
 * the round appended — `proto-login@v2`. That keeps the copy the same html
 * screen (same route, same live preview, same html export) while giving it a
 * layout of its own to edit, and it stays a pure lookup: no registry, no
 * storage, the id says everything.
 */
export function versionedPrototypeId(prototypeId: string, version: number): string {
  return `${prototypeId}@v${version}`;
}

/**
 * One member's copy of a screen, for their own workspace in the User tab.
 *
 * The suffix goes on the outside — `proto-login@v2~tm-3` — so the id still
 * says which prototype and which round it belongs to. That is what lets a
 * member's copy preview as the real screen while keeping its own canvas and
 * its own layout edits.
 */
export function memberScopedId(screenId: string, memberId: string): string {
  return `${screenId}~${memberId}`;
}

/**
 * What an id is made of: the prototype it came from, the round's copy it is,
 * and whose workspace it belongs to. Each part is optional, and reading them
 * back is a pure string operation — no registry, no storage.
 */
export function readPrototypeId(screenId: string): {
  baseId: string;
  version: number | null;
  member: string | null;
} {
  let rest = screenId;
  // The member is outermost, so it comes off first.
  let member: string | null = null;
  const tilde = rest.lastIndexOf('~');
  if (tilde !== -1) {
    member = rest.slice(tilde + 1);
    rest = rest.slice(0, tilde);
  }
  const at = rest.lastIndexOf('@v');
  if (at === -1) return { baseId: rest, version: null, member };
  const version = Number(rest.slice(at + 2));
  return Number.isInteger(version)
    ? { baseId: rest.slice(0, at), version, member }
    : { baseId: rest, version: null, member };
}

export function findPrototypeFile(screenId: string): PrototypeFile | null {
  const { baseId } = readPrototypeId(screenId);
  return PROTOTYPE_FILES.find((file) => file.id === baseId) ?? null;
}

export function findPrototypeBySlug(slug: string): PrototypeFile | null {
  return PROTOTYPE_FILES.find((file) => file.slug === slug) ?? null;
}

export function findPrototypeByFileName(fileName: string): PrototypeFile | null {
  return PROTOTYPE_FILES.find((file) => file.fileName === fileName) ?? null;
}

export function isPrototypeFile(screenId: string): boolean {
  return findPrototypeFile(screenId) !== null;
}

/**
 * Human-readable breadcrumb path for a screen, e.g.
 * "Expense Management > Corporate Card > Bulk Approve".
 *
 * Falls back to capitalising the route segments when no prototype matches.
 */
export function screenDisplayPath(
  screenId: string | null | undefined,
  route: string | null | undefined,
): string {
  if (screenId) {
    const proto = findPrototypeFile(screenId);
    if (proto?.path) return proto.path;
  }
  if (!route) return '';
  // Strip /eacc/ prefix and query, then capitalise each segment.
  const raw = (route.split(/[?#]/)[0] ?? '').replace(/^\/eacc\//, '').replace(/^\//, '');
  if (!raw) return '';
  return raw
    .split('/')
    .map((s) =>
      s
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    )
    .join(' > ');
}

/** True only for the baseline files themselves, not a round's copy of one. */
export function isBaselinePrototypeFile(screenId: string): boolean {
  return PROTOTYPE_FILES.some((file) => file.id === screenId);
}

/**
 * The file that renders a route — how a link inside a previewed screen finds
 * the html file it should open, instead of leaving the workspace for the app.
 */
export function findPrototypeByRoute(route: string): PrototypeFile | null {
  const path = (route.split(/[?#]/)[0] ?? '').replace(/\/$/, '');
  return PROTOTYPE_FILES.find((file) => file.route === path) ?? null;
}

/**
 * localStorage key holding this file's layout edits. Each html file keeps its
 * own, so editing the bulk-approve screen never changes the list screen it was
 * copied from.
 */
export function prototypeConfigKey(slug: string): string {
  return `eacc:proto:${slug}`;
}

/**
 * Where one screen's layout edits live. A round's copy gets its own key, so
 * changing it never rewrites the baseline everyone else is looking at.
 */
export function prototypeConfigKeyForScreen(screenId: string): string | undefined {
  const file = findPrototypeFile(screenId);
  if (!file) return undefined;
  const { version, member } = readPrototypeId(screenId);
  let key = prototypeConfigKey(file.slug);
  if (version !== null) key += `@v${version}`;
  // A member editing in their own workspace edits their own layout, not the
  // round's — that is the whole point of merging afterwards.
  if (member) key += `~${member}`;
  return key;
}

/** Where the standalone html of a file is served from. */
export function prototypeHtmlHref(file: PrototypeFile): string {
  return `/api/prototype/${file.slug}`;
}
