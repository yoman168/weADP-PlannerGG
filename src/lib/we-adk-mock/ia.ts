/**
 * The IA tab — a sitemap sheet for one round, in the same spreadsheet shape a
 * real IA document uses: a flat row per screen, with the folder tree it came
 * from spread into depth columns rather than nested.
 *
 * The round's design files seed it — every screen already has a place in the
 * Main tree, and drawing the sheet from that means it never starts empty. Any
 * edit freezes the sheet to an overlay in workspace state, the same seed +
 * overlay split the rest of the mock uses, so renaming a row here does not
 * fight with the file it was drawn from. "Reset" drops the overlay and reads
 * the files again.
 */

import type { DesignFile, DesignFolder } from './projects';
import { findPrototypeFile, PROTOTYPE_FILES, readPrototypeId } from '@/lib/we-adk/prototype';
import { workspaceStore } from '@/lib/api/workspace-store';

export type IAScreenType = 'Screen' | 'Popup' | 'Drawer';
export type IAPlatform = 'PC' | 'Mobile';
export type IAStatus = 'To do' | 'In progress' | 'Review' | 'Done';

export const IA_SCREEN_TYPES: IAScreenType[] = ['Screen', 'Popup', 'Drawer'];
export const IA_PLATFORMS: IAPlatform[] = ['PC', 'Mobile'];
export const IA_STATUSES: IAStatus[] = ['To do', 'In progress', 'Review', 'Done'];

export interface IARow {
  id: string;
  depth1: string;
  depth2: string;
  depth3: string;
  depth4: string;
  depth5: string;
  screenId: string;
  /** Full descriptive key: project-depth1-depth2-…-screenType (underscored, human-readable). */
  screenKey: string;
  screenType: IAScreenType;
  platform: IAPlatform;
  workItem: string;
  prd: string;
  frd: string;
  link: string;
  maintainer: string;
  menuGroup: string;
  status: IAStatus;
  projectName: string;
  /** Set only on a row drawn from an actual file — lets the row jump to Main. */
  fileId?: string;
  folderId?: string;
}

/**
 * The depth columns, in order — the navigation hierarchy spread one column
 * per level. Named once here so the sheet, the CSV and the seed cannot
 * disagree about how many levels there are.
 */
export const IA_DEPTH_FIELDS = ['depth1', 'depth2', 'depth3', 'depth4', 'depth5'] as const;

export type IADepthField = (typeof IA_DEPTH_FIELDS)[number];

export type IARowPatch = Partial<Omit<IARow, 'id' | 'fileId' | 'folderId'>>;

const IA_KEY = 'we-adk:business:ia';

function iaKey(projectId: string, version: number): string {
  return `${IA_KEY}:${projectId}:${version}`;
}

/** What is actually in storage: a row saved by any past version of the sheet. */
type StoredRow = Partial<IARow> & { id: string };

function isStoredRowArray(value: unknown): value is StoredRow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { id?: unknown }).id === 'string',
    )
  );
}

/**
 * Fills whatever a stored row is missing.
 *
 * A sheet saved before a column existed is still a valid sheet, just an older
 * one — without this, every cell added later would read `undefined` and the
 * first edit to one would throw. Defaults here rather than at each read site,
 * so there is one answer to what an absent field means.
 */
function normalizeRow(raw: StoredRow): IARow {
  return {
    id: raw.id,
    depth1: raw.depth1 ?? '',
    depth2: raw.depth2 ?? '',
    depth3: raw.depth3 ?? '',
    depth4: raw.depth4 ?? '',
    depth5: raw.depth5 ?? '',
    screenId: raw.screenId ?? '',
    screenKey: ((raw as Record<string, unknown>).screenKey as string) ?? '',
    screenType: raw.screenType ?? 'Screen',
    platform: raw.platform ?? 'PC',
    workItem: raw.workItem ?? '',
    prd: raw.prd ?? '',
    frd: raw.frd ?? '',
    link: raw.link ?? '',
    maintainer: raw.maintainer ?? '',
    menuGroup: raw.menuGroup ?? '',
    status: ((raw as Record<string, unknown>).status as IAStatus) ?? 'To do',
    projectName: ((raw as Record<string, unknown>).projectName as string) ?? '',
    fileId: raw.fileId,
    folderId: raw.folderId,
  };
}

/** The overlay someone has already edited into being — `null` before that. */
export function loadIAOverlay(projectId: string, version: number): IARow[] | null {
  try {
    const raw = workspaceStore.getItem(iaKey(projectId, version));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredRowArray(parsed) ? parsed.map(normalizeRow) : null;
  } catch {
    return null;
  }
}

function saveIARows(projectId: string, version: number, rows: IARow[]): IARow[] {
  try {
    workspaceStore.setItem(iaKey(projectId, version), JSON.stringify(rows));
  } catch {
    // Storage unavailable — the sheet won't survive a reload.
  }
  return rows;
}

/**
 * The set of prototype screens that are popups rather than full screens.
 *
 * Built once from PROTOTYPE_FILES: everything after the `// Popup screens`
 * comment in prototype.ts carries an index >= 13 and a route that sits under
 * a parent screen. Matching on file id is exact and does not mis-classify a
 * main screen whose name happens to contain "detail" or "receipt".
 */
const POPUP_PROTO_IDS: ReadonlySet<string> = new Set(
  PROTOTYPE_FILES.filter((_, i) => i >= 13).map((f) => f.id),
);

/** A popup or a drawer reads differently on the sheet than a full screen. */
function screenTypeFor(fileName: string, fileId?: string): IAScreenType {
  if (fileId) {
    const { baseId } = readPrototypeId(fileId);
    if (POPUP_PROTO_IDS.has(baseId)) return 'Popup';
  }
  const lower = fileName.toLowerCase();
  if (/drawer|side-panel|sidebar/.test(lower)) return 'Drawer';
  if (/popup|modal|add|create|edit|new|register|apply/.test(lower)) return 'Popup';
  return 'Screen';
}

/* ------------------------------------------------------------------ */
/* Screen ID format pattern                                            */
/* ------------------------------------------------------------------ */

const SCREEN_ID_KEY = 'we-adk:business:screen-id-pattern';

/**
 * The pattern uses placeholders:
 *   {PREFIX} — the prefix string (default "SC")
 *   {V}      — version number
 *   {N}      — sequential index (zero-padded to pad length)
 */
export interface ScreenIdConfig {
  prefix: string;
  separator: string;
  padLength: number;
  /**
   * Free-form pattern. Placeholders:
   *   {PREFIX}, {SEP}, {V} (version), {N} (zero-padded number),
   *   or any literal text typed directly.
   */
  pattern: string;
}

const DEFAULT_CONFIG: ScreenIdConfig = {
  prefix: 'SC',
  separator: '-',
  padLength: 3,
  pattern: '{PREFIX}{SEP}{V}{SEP}{N}',
};

export function loadScreenIdConfig(projectId: string): ScreenIdConfig {
  try {
    const raw = workspaceStore.getItem(`${SCREEN_ID_KEY}:${projectId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ScreenIdConfig>;
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_CONFIG;
}

export function saveScreenIdConfig(projectId: string, config: ScreenIdConfig): void {
  try {
    workspaceStore.setItem(`${SCREEN_ID_KEY}:${projectId}`, JSON.stringify(config));
  } catch {
    /* ignore */
  }
}

export function formatScreenId(config: ScreenIdConfig, version: number, index: number): string {
  const n = String(index + 1).padStart(config.padLength, '0');
  return config.pattern
    .replace(/\{PREFIX\}/g, config.prefix)
    .replace(/\{SEP\}/g, config.separator)
    .replace(/\{V\}/g, String(version))
    .replace(/\{N\}/g, n);
}

export type IdSuffixFormat = 'number' | 'alpha' | 'mixed';

const ID_SUFFIX_KEY = 'we-adk:business:id-suffix-format';

export function loadIdSuffixFormat(projectId: string): IdSuffixFormat {
  try {
    const v = workspaceStore.getItem(`${ID_SUFFIX_KEY}:${projectId}`);
    if (v === 'number' || v === 'alpha' || v === 'mixed') return v;
  } catch {
    /* ignore */
  }
  return 'mixed';
}

export function saveIdSuffixFormat(projectId: string, fmt: IdSuffixFormat): void {
  try {
    workspaceStore.setItem(`${ID_SUFFIX_KEY}:${projectId}`, fmt);
  } catch {
    /* ignore */
  }
}

/* ---- Per-depth config ------------------------------------------------- */

export interface IADepthConfig {
  digits: number | null;
  format: IdSuffixFormat | null;
}

export type IADepthConfigs = Record<number, IADepthConfig>;

const DEPTH_CFG_KEY = 'we-adk:business:depth-configs';

export function loadDepthConfigs(projectId: string): IADepthConfigs {
  try {
    const raw = workspaceStore.getItem(`${DEPTH_CFG_KEY}:${projectId}`);
    if (raw) return JSON.parse(raw) as IADepthConfigs;
  } catch {
    /* ignore */
  }
  return {
    1: { digits: null, format: null },
    2: { digits: null, format: null },
    3: { digits: null, format: null },
    4: { digits: null, format: null },
    5: { digits: null, format: null },
  };
}

export function saveDepthConfigs(projectId: string, configs: IADepthConfigs): void {
  try {
    workspaceStore.setItem(`${DEPTH_CFG_KEY}:${projectId}`, JSON.stringify(configs));
  } catch {
    /* ignore */
  }
}

const RANDOM_DIGITS_KEY = 'we-adk:business:random-digits';

export function loadRandomDigits(projectId: string): number {
  try {
    const v = Number(workspaceStore.getItem(`${RANDOM_DIGITS_KEY}:${projectId}`));
    if (v === 3 || v === 4 || v === 5) return v;
  } catch {
    /* ignore */
  }
  return 5;
}

export function saveRandomDigits(projectId: string, digits: number): void {
  try {
    workspaceStore.setItem(`${RANDOM_DIGITS_KEY}:${projectId}`, String(digits));
  } catch {
    /* ignore */
  }
}

/* ---- Random generators ------------------------------------------------ */

function randomChars(len: number, chars: string): string {
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function randomNumber(len: number): string {
  const raw = randomChars(len, '0123456789');
  if (raw[0] === '0') return String(Number(raw) || 10 ** (len - 1));
  return raw;
}

function randomAlpha(len: number): string {
  return randomChars(len, 'abcdefghijklmnopqrstuvwxyz');
}

function randomMixed(len: number): string {
  return randomChars(len, 'abcdefghijklmnopqrstuvwxyz0123456789');
}

function randomSuffix(fmt: IdSuffixFormat, len = 5): string {
  if (fmt === 'number') return randomNumber(len);
  if (fmt === 'alpha') return randomAlpha(len);
  return randomMixed(len);
}

/**
 * Validate a screen ID against the configured format.
 * Format: {Project}-{Depths…}-{ScreenType}-{Suffix}
 * Returns null if valid, or an error message string.
 */
export function validateScreenId(
  value: string,
  projectShort: string,
  suffixFmt: IdSuffixFormat,
): string | null {
  if (!value) return null;
  const parts = value.split('-');

  // Must have at least 3 parts: project, screen type, suffix
  if (parts.length < 3) return 'Expected at least 3 segments (Project-…-Type-ID)';

  // Check project prefix (case-insensitive)
  const expected = projectShort.replace(/\s+/g, '').toLowerCase();
  if ((parts[0] ?? '').toLowerCase() !== expected) return `Expected project "${expected}"`;

  // Validate suffix (last part) — length 3–6
  const last = parts[parts.length - 1] ?? '';
  if (suffixFmt === 'number' && !/^\d{3,6}$/.test(last)) {
    return 'ID suffix must be 3-6 digits';
  }
  if (suffixFmt === 'alpha' && !/^[a-z]{3,6}$/i.test(last)) {
    return 'ID suffix must be 3-6 letters';
  }
  if (suffixFmt === 'mixed' && !/^[a-z0-9]{3,6}$/i.test(last)) {
    return 'ID suffix must be 3-6 alphanumeric';
  }

  // Validate screen type (second to last, case-insensitive)
  const typePart = (parts[parts.length - 2] ?? '').toLowerCase();
  if (!['screen', 'popup', 'drawer'].includes(typePart)) {
    return 'Screen type must be Screen, Popup, or Drawer';
  }

  return null;
}

/**
 * Screen ID format: {ProjectShort}-{Depth1}-…-{DeepestDepth}-{ScreenType}-{randomSuffix}
 * Empty depths are skipped so the ID stays compact.
 * When a depth has its own config (digits + format), a random code replaces the name.
 */
function screenCode(
  projectShort: string,
  depths: string[],
  screenType: IAScreenType,
  fmt: IdSuffixFormat = 'mixed',
  randomLen = 5,
  depthCfgs?: IADepthConfigs,
  status: IAStatus = 'To do',
): string {
  const strip = (s: string) => s.replace(/\s+/g, '').toLowerCase();
  const parts: string[] = [strip(projectShort)];

  depths.forEach((d, i) => {
    if (!d) return;
    const cfg = depthCfgs?.[i + 1];
    if (cfg?.digits && cfg?.format) {
      parts.push(randomSuffix(cfg.format, cfg.digits));
    } else {
      parts.push(strip(d));
    }
  });

  parts.push(strip(screenType));
  parts.push(randomSuffix(fmt, randomLen));
  parts.push(strip(status));
  return parts.join('-');
}

/**
 * Full descriptive screen key: project-depth1_depth2-…-screenType.
 * Spaces become underscores, everything is lowercased.
 * e.g. `eacc-accountant-month_end_close-close_status-screen`
 */
function screenKeyFromDepths(
  projectShort: string,
  depths: string[],
  screenType: IAScreenType,
): string {
  const slug = (s: string) => s.trim().replace(/\s+/g, '_').toLowerCase();
  const parts: string[] = [slug(projectShort)];
  for (const d of depths) {
    if (d) parts.push(slug(d));
  }
  parts.push(slug(screenType));
  return parts.join('-');
}

/** PRD document reference for each route. */
const PRD_BY_ROUTE: Record<string, string> = {
  '/eacc/login': 'PRD-AUTH',
  '/eacc/dashboard': 'PRD-DASH',
  '/eacc/dashboard/date-picker': 'PRD-DASH',
  '/eacc/close': 'PRD-CLOSE',
  '/eacc/close/blockers': 'PRD-CLOSE',
  '/eacc/corp-card': 'PRD-CARD',
  '/eacc/corp-card/bulk': 'PRD-CARD',
  '/eacc/corp-card/new-charge': 'PRD-CARD',
  '/eacc/corp-card/detail': 'PRD-CARD',
  '/eacc/corp-card/reject': 'PRD-CARD',
  '/eacc/personal-expense': 'PRD-EXPENSE',
  '/eacc/personal-expense/detail': 'PRD-EXPENSE',
  '/eacc/personal-expense/new': 'PRD-EXPENSE',
  '/eacc/personal-expense/receipt': 'PRD-EXPENSE',
  '/eacc/tax-invoice': 'PRD-TAXINV',
  '/eacc/tax-invoice/detail': 'PRD-TAXINV',
  '/eacc/cash-receipt': 'PRD-RECEIPT',
  '/eacc/cash-receipt/detail': 'PRD-RECEIPT',
  '/eacc/cash-receipt/new': 'PRD-RECEIPT',
  '/eacc/approvals': 'PRD-APPROVE',
  '/eacc/approvals/confirm': 'PRD-APPROVE',
  '/eacc/approvals/return': 'PRD-APPROVE',
  '/eacc/settings': 'PRD-ADMIN',
  '/eacc/settings/invite': 'PRD-ADMIN',
  '/eacc/settings/edit-role': 'PRD-ADMIN',
};

/** PRD document details — title and requirement items. */
export const PRD_DOCUMENTS: Record<
  string,
  {
    title: string;
    description: string;
    files: { name: string; size: string }[];
    items: {
      id: string;
      status: 'Done' | 'In progress' | 'To do';
      title: string;
      assignee: string;
    }[];
  }
> = {
  'PRD-AUTH': {
    title: 'Authentication & Login',
    description:
      'User authentication flow including email/password sign-in, session management with JWT (HS256, 24h expiry), and company SSO integration deferred to phase 2.',
    files: [
      { name: 'auth-flow-diagram.pdf', size: '245 KB' },
      { name: 'sso-requirements.docx', size: '82 KB' },
    ],
    items: [
      { id: 'REQ-001', status: 'Done', title: 'Email/password sign-in', assignee: 'Kim Minsu' },
      { id: 'REQ-002', status: 'Done', title: 'Remember me checkbox', assignee: 'Kim Minsu' },
      { id: 'REQ-003', status: 'To do', title: 'Company SSO integration', assignee: 'Lee Jiyeon' },
      { id: 'REQ-004', status: 'Done', title: 'Forgot password flow', assignee: 'Kim Minsu' },
    ],
  },
  'PRD-DASH': {
    title: 'Dashboard & Overview',
    description:
      'The accountant landing page showing monthly spending summary, spend by category breakdown, and recent activity. Date range picker controls the reporting period.',
    files: [{ name: 'dashboard-mockup-v2.fig', size: '1.2 MB' }],
    items: [
      {
        id: 'REQ-005',
        status: 'Done',
        title: 'Monthly spending summary cards',
        assignee: 'Park Seongmin',
      },
      {
        id: 'REQ-006',
        status: 'In progress',
        title: 'Spend by category chart',
        assignee: 'Park Seongmin',
      },
      { id: 'REQ-007', status: 'Done', title: 'Date range picker', assignee: 'Kim Minsu' },
      { id: 'REQ-008', status: 'To do', title: 'Export dashboard as PDF', assignee: 'Lee Jiyeon' },
    ],
  },
  'PRD-CLOSE': {
    title: 'Month-end Close',
    description:
      'Close status overview and blocker tracking by cost centre. The single screen that answers "what is blocking the close?" with auto-resolve for stale blockers.',
    files: [{ name: 'close-process-flow.pdf', size: '310 KB' }],
    items: [
      { id: 'REQ-009', status: 'Done', title: 'Close status overview', assignee: 'Choi Dongwook' },
      {
        id: 'REQ-010',
        status: 'Done',
        title: 'Blockers by cost centre',
        assignee: 'Choi Dongwook',
      },
      {
        id: 'REQ-011',
        status: 'In progress',
        title: 'Auto-resolve stale blockers',
        assignee: 'Jung Minjae',
      },
    ],
  },
  'PRD-CARD': {
    title: 'Corporate Card Management',
    description:
      'Full lifecycle of corporate card charges — from transaction import to approval. Includes individual and bulk approve flows, reject with reason, and receipt OCR auto-fill planned for phase 2.',
    files: [
      { name: 'card-approval-flow.pdf', size: '198 KB' },
      { name: 'ocr-api-spec.md', size: '15 KB' },
      { name: 'bulk-approve-wireframe.png', size: '420 KB' },
    ],
    items: [
      {
        id: 'REQ-012',
        status: 'Done',
        title: 'Card transaction list with filters',
        assignee: 'Kim Minsu',
      },
      { id: 'REQ-013', status: 'Done', title: 'New charge entry form', assignee: 'Kim Minsu' },
      { id: 'REQ-014', status: 'Done', title: 'Charge detail view', assignee: 'Lee Jiyeon' },
      {
        id: 'REQ-015',
        status: 'In progress',
        title: 'Bulk approve by department',
        assignee: 'Park Seongmin',
      },
      { id: 'REQ-016', status: 'Done', title: 'Reject with reason', assignee: 'Lee Jiyeon' },
      { id: 'REQ-017', status: 'To do', title: 'Receipt OCR auto-fill', assignee: 'Jung Minjae' },
    ],
  },
  'PRD-EXPENSE': {
    title: 'Personal Expense',
    description:
      'Employee personal expense submission and reimbursement. Includes expense entry, receipt attachment, report detail with line items, and a "returned to me" tab for rejected items.',
    files: [{ name: 'expense-policy-rules.xlsx', size: '56 KB' }],
    items: [
      {
        id: 'REQ-018',
        status: 'Done',
        title: 'Expense list with returned tab',
        assignee: 'Park Seongmin',
      },
      { id: 'REQ-019', status: 'Done', title: 'New expense entry form', assignee: 'Park Seongmin' },
      {
        id: 'REQ-020',
        status: 'Done',
        title: 'Report detail with line items',
        assignee: 'Lee Jiyeon',
      },
      {
        id: 'REQ-021',
        status: 'In progress',
        title: 'Receipt upload and attach',
        assignee: 'Choi Dongwook',
      },
      {
        id: 'REQ-022',
        status: 'To do',
        title: 'Duplicate expense detection',
        assignee: 'Jung Minjae',
      },
    ],
  },
  'PRD-TAXINV': {
    title: 'Tax Invoice',
    description:
      'Purchase tax invoice management — list view with type filter (Tax invoice, Invoice, Revised), detail view with supplier/buyer info, and revised invoice linking.',
    files: [{ name: 'tax-invoice-sample.pdf', size: '128 KB' }],
    items: [
      {
        id: 'REQ-023',
        status: 'Done',
        title: 'Invoice list with type filter',
        assignee: 'Kim Minsu',
      },
      { id: 'REQ-024', status: 'Done', title: 'Invoice detail view', assignee: 'Kim Minsu' },
      { id: 'REQ-025', status: 'To do', title: 'Revised invoice linking', assignee: 'Lee Jiyeon' },
    ],
  },
  'PRD-RECEIPT': {
    title: 'Cash Receipt',
    description:
      'Cash receipt tracking with receipt number, supplier info, line items, and evidence attachment. Auto-match with corporate card charges planned for phase 2.',
    files: [{ name: 'receipt-matching-logic.md', size: '8 KB' }],
    items: [
      {
        id: 'REQ-026',
        status: 'Done',
        title: 'Receipt list with filters',
        assignee: 'Choi Dongwook',
      },
      {
        id: 'REQ-027',
        status: 'Done',
        title: 'Receipt detail with line items',
        assignee: 'Choi Dongwook',
      },
      {
        id: 'REQ-028',
        status: 'In progress',
        title: 'New receipt entry form',
        assignee: 'Park Seongmin',
      },
      {
        id: 'REQ-029',
        status: 'To do',
        title: 'Auto-match with card charges',
        assignee: 'Jung Minjae',
      },
    ],
  },
  'PRD-APPROVE': {
    title: 'Approval Queue',
    description:
      'Approver-scoped queue sorted by overdue items first. Supports approve with confirmation, return with reason, and batch approve for selected items.',
    files: [{ name: 'approval-workflow.pdf', size: '175 KB' }],
    items: [
      { id: 'REQ-030', status: 'Done', title: 'Queue sorted by overdue', assignee: 'Lee Jiyeon' },
      {
        id: 'REQ-031',
        status: 'Done',
        title: 'Approve confirmation dialog',
        assignee: 'Lee Jiyeon',
      },
      { id: 'REQ-032', status: 'Done', title: 'Return with reason', assignee: 'Lee Jiyeon' },
      {
        id: 'REQ-033',
        status: 'To do',
        title: 'Batch approve selected items',
        assignee: 'Park Seongmin',
      },
    ],
  },
  'PRD-ADMIN': {
    title: 'Administration & Settings',
    description:
      'Workspace administration — company profile, member management (invite, edit role), and close policy configuration. Role-based access: Accountant, Approver, Member, Admin.',
    files: [
      { name: 'role-permissions-matrix.xlsx', size: '34 KB' },
      { name: 'settings-wireframe.fig', size: '890 KB' },
    ],
    items: [
      { id: 'REQ-034', status: 'Done', title: 'Company profile settings', assignee: 'Kim Minsu' },
      { id: 'REQ-035', status: 'Done', title: 'Invite team member', assignee: 'Kim Minsu' },
      {
        id: 'REQ-036',
        status: 'In progress',
        title: 'Edit member role',
        assignee: 'Choi Dongwook',
      },
      {
        id: 'REQ-037',
        status: 'To do',
        title: 'Close policy configuration',
        assignee: 'Jung Minjae',
      },
    ],
  },
};

/** Maps PRD IDs to task tags — a task with any matching tag belongs to the PRD. */
export const PRD_TASK_TAGS: Record<string, string[]> = {
  'PRD-AUTH': ['login', 'security'],
  'PRD-DASH': ['dashboard', 'performance'],
  'PRD-CLOSE': ['close'],
  'PRD-CARD': ['corp-card'],
  'PRD-EXPENSE': ['personal-expense', 'expense'],
  'PRD-TAXINV': ['tax-invoice', 'invoice'],
  'PRD-RECEIPT': ['cash-receipt', 'uploads'],
  'PRD-APPROVE': ['approvals', 'approval', 'audit'],
  'PRD-ADMIN': ['settings', 'admin'],
};

/** Generic tags that don't identify a specific PRD — skip these when matching. */
const GENERIC_TAGS = new Set([
  'feature',
  'bug',
  'ux',
  'wording',
  'a11y',
  'compliance',
  'legal',
  'flow',
  'export',
]);

/** Find which PRD a task belongs to based on its first specific tag. */
export function prdForTask(task: { tags?: string[] }): { id: string; title: string } | null {
  if (!task.tags) return null;
  // Iterate task tags in order — the first specific tag wins.
  for (const tag of task.tags) {
    if (GENERIC_TAGS.has(tag)) continue;
    for (const [prdId, prdTags] of Object.entries(PRD_TASK_TAGS)) {
      if (prdTags.includes(tag)) {
        const doc = PRD_DOCUMENTS[prdId];
        return doc ? { id: prdId, title: doc.title } : null;
      }
    }
  }
  return null;
}

/** Get screen routes linked to a PRD. */
export function screensForPrd(prdId: string): string[] {
  return Object.entries(PRD_BY_ROUTE)
    .filter(([, id]) => id === prdId)
    .map(([route]) => route);
}

/** Tag → single primary screen route. */
const TAG_SCREEN: Record<string, string> = {
  login: '/eacc/login',
  security: '/eacc/login',
  dashboard: '/eacc/dashboard',
  performance: '/eacc/dashboard',
  close: '/eacc/close',
  'corp-card': '/eacc/corp-card',
  'personal-expense': '/eacc/personal-expense',
  expense: '/eacc/personal-expense',
  'tax-invoice': '/eacc/tax-invoice',
  invoice: '/eacc/tax-invoice',
  'cash-receipt': '/eacc/cash-receipt',
  uploads: '/eacc/cash-receipt',
  approvals: '/eacc/approvals',
  approval: '/eacc/approvals',
  audit: '/eacc/approvals',
  settings: '/eacc/settings',
  admin: '/eacc/settings',
};

/** Find the single most relevant screen for a task based on its tags. */
export function screenForTask(task: { tags?: string[] }): string | null {
  if (!task.tags) return null;
  for (const tag of task.tags) {
    const route = TAG_SCREEN[tag];
    if (route) return route;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* PRD CRUD                                                            */
/* ------------------------------------------------------------------ */

export type PrdItem = {
  id: string;
  status: 'Done' | 'In progress' | 'To do';
  title: string;
  assignee: string;
};
export type PrdDoc = {
  title: string;
  description: string;
  files: { name: string; size: string }[];
  items: PrdItem[];
};

const PRD_STORAGE_KEY = 'we-adk:business:prd';

function prdKey(prdId: string): string {
  return `${PRD_STORAGE_KEY}:${prdId}`;
}

/**
 * Resolve the seed PRD document for a given key and optional route.
 * The key may be `PRD-{screenId}` (no direct match); the route maps back
 * to the canonical key in `PRD_BY_ROUTE` → `PRD_DOCUMENTS`.
 */
export function resolvePrdSeed(prdId: string, route?: string): PrdDoc | null {
  // Direct match (legacy keys like PRD-AUTH)
  if (PRD_DOCUMENTS[prdId]) return PRD_DOCUMENTS[prdId];
  // Resolve via route
  if (route) {
    const canonical = PRD_BY_ROUTE[route];
    if (canonical && PRD_DOCUMENTS[canonical]) return PRD_DOCUMENTS[canonical];
  }
  return null;
}

/** Load a PRD — overlay from workspace state, fallback to seed. */
export function loadPrd(prdId: string, route?: string): PrdDoc | null {
  try {
    const raw = workspaceStore.getItem(prdKey(prdId));
    if (raw) return JSON.parse(raw) as PrdDoc;
  } catch {
    /* ignore */
  }
  return resolvePrdSeed(prdId, route);
}

function savePrd(prdId: string, doc: PrdDoc): PrdDoc {
  try {
    workspaceStore.setItem(prdKey(prdId), JSON.stringify(doc));
  } catch {
    /* ignore */
  }
  return doc;
}

let prdItemCounter = 0;

export function addPrdItem(prdId: string, item: Omit<PrdItem, 'id'>): PrdDoc | null {
  const doc = loadPrd(prdId);
  if (!doc) return null;
  prdItemCounter += 1;
  const newItem: PrdItem = { ...item, id: `REQ-${Date.now().toString(36)}-${prdItemCounter}` };
  return savePrd(prdId, { ...doc, items: [...doc.items, newItem] });
}

export function updatePrdItem(
  prdId: string,
  itemId: string,
  patch: Partial<Omit<PrdItem, 'id'>>,
): PrdDoc | null {
  const doc = loadPrd(prdId);
  if (!doc) return null;
  return savePrd(prdId, {
    ...doc,
    items: doc.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
  });
}

export function deletePrdItem(prdId: string, itemId: string): PrdDoc | null {
  const doc = loadPrd(prdId);
  if (!doc) return null;
  return savePrd(prdId, { ...doc, items: doc.items.filter((i) => i.id !== itemId) });
}

export function updatePrdDoc(
  prdId: string,
  patch: Partial<Pick<PrdDoc, 'title' | 'description'>>,
): PrdDoc | null {
  const doc = loadPrd(prdId);
  if (!doc) return null;
  return savePrd(prdId, { ...doc, ...patch });
}

/* ------------------------------------------------------------------ */
/* FRD — Functional Requirements Documents                             */
/* ------------------------------------------------------------------ */

export type FrdItem = { id: string; title: string };
export type FrdDoc = { items: FrdItem[] };

const FRD_STORAGE_KEY = 'we-adk:business:frd';

const FRD_SEED: Record<string, FrdDoc> = {
  'PRD-AUTH': {
    items: [
      { id: 'frd-001-1', title: 'Email/password login with field-level validation' },
      { id: 'frd-001-2', title: 'Inline error messages for wrong credentials (no browser alert)' },
      { id: 'frd-001-3', title: 'Session timeout redirect to login with return URL' },
      { id: 'frd-001-4', title: 'Password must be 8+ characters with at least one number' },
    ],
  },
  'PRD-DASH': {
    items: [
      { id: 'frd-002-1', title: 'Spend-by-category chart with monthly aggregation' },
      { id: 'frd-002-2', title: 'Date range picker filtering all dashboard widgets' },
      { id: 'frd-002-3', title: 'Memoised aggregation for 12-month history performance' },
      { id: 'frd-002-4', title: 'Summary cards show total spend, pending count, approved ratio' },
    ],
  },
  'PRD-CARD': {
    items: [
      { id: 'frd-004-1', title: 'Card list with status filter and search' },
      { id: 'frd-004-2', title: 'Checkbox column with bulk select/deselect all' },
      { id: 'frd-004-3', title: 'Sticky action bar showing total amount on bulk approve' },
      { id: 'frd-004-4', title: 'Confirm step before bulk approve with item count and total' },
      { id: 'frd-004-5', title: 'Reject requires a reason (free text, min 10 chars)' },
    ],
  },
  'PRD-EXPENSE': {
    items: [
      { id: 'frd-005-1', title: 'Expense list with date and status filtering' },
      { id: 'frd-005-2', title: 'New expense form with receipt photo upload' },
      { id: 'frd-005-3', title: 'Receipt OCR auto-fill for amount and vendor' },
      { id: 'frd-005-4', title: 'Returned expenses show rejection reason inline' },
    ],
  },
  'PRD-RECEIPT': {
    items: [
      { id: 'frd-007-1', title: 'Receipt list with toolbar CSV export respecting active filters' },
      {
        id: 'frd-007-2',
        title: 'File size validation (10 MB limit) with error message before upload',
      },
      { id: 'frd-007-3', title: 'Repair path for stranded attachments over size limit' },
      { id: 'frd-007-4', title: 'Receipt number auto-generated in format RCP-YYYY-NNNNN' },
    ],
  },
  'PRD-APPROVE': {
    items: [
      { id: 'frd-008-1', title: 'Approval queue sorted by submission date, overdue first' },
      {
        id: 'frd-008-2',
        title: 'Keyboard navigation: arrow keys move selection, A/R approve/return',
      },
      { id: 'frd-008-3', title: 'Audit trail entry on policy override with reason field' },
      { id: 'frd-008-4', title: 'Shortcuts must not fire while a text field is focused' },
    ],
  },
  'PRD-ADMIN': {
    items: [
      { id: 'frd-009-1', title: 'Role list with permission matrix editor' },
      { id: 'frd-009-2', title: 'Invite member form with role assignment and email validation' },
      {
        id: 'frd-009-3',
        title: 'Close policy configuration: approval threshold, auto-close rules',
      },
    ],
  },
};

function frdKey(prdId: string): string {
  return `${FRD_STORAGE_KEY}:${prdId}`;
}

export function loadFrd(prdId: string): FrdDoc {
  try {
    const raw = workspaceStore.getItem(frdKey(prdId));
    if (raw) return JSON.parse(raw) as FrdDoc;
  } catch {
    /* ignore */
  }
  return FRD_SEED[prdId] ?? { items: [] };
}

function saveFrd(prdId: string, doc: FrdDoc): FrdDoc {
  try {
    workspaceStore.setItem(frdKey(prdId), JSON.stringify(doc));
  } catch {
    /* ignore */
  }
  return doc;
}

let frdItemCounter = 0;

export function addFrdItem(prdId: string, title: string): FrdDoc {
  const doc = loadFrd(prdId);
  frdItemCounter += 1;
  return saveFrd(prdId, {
    ...doc,
    items: [...doc.items, { id: `FRD-${Date.now().toString(36)}-${frdItemCounter}`, title }],
  });
}

export function updateFrdItem(prdId: string, itemId: string, title: string): FrdDoc {
  const doc = loadFrd(prdId);
  return saveFrd(prdId, {
    ...doc,
    items: doc.items.map((i) => (i.id === itemId ? { ...i, title } : i)),
  });
}

export function deleteFrdItem(prdId: string, itemId: string): FrdDoc {
  const doc = loadFrd(prdId);
  return saveFrd(prdId, { ...doc, items: doc.items.filter((i) => i.id !== itemId) });
}

/**
 * Drawn straight from the round's folder tree, one column per level of real
 * nesting: a file inside a folder reads `<folder> > <screen>`, and a file at
 * the round's root is itself a top-level node, so it reads as just `<screen>`.
 *
 * Depth columns past a file's actual level stay empty rather than repeating
 * the level above it or inventing a "Root" ancestor. A fake node is a claim
 * about the navigation that isn't true, and the Path column then repeats it —
 * an empty cell already says there is nothing deeper here.
 */
/** Shorten a project name to a compact prefix, e.g. "eACC Cloud" → "eACC" */
function projectShortName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

/** Derive a realistic status from the route's PRD items. */
function statusForRoute(route: string | undefined): IAStatus {
  if (!route) return 'To do';
  const prdId = PRD_BY_ROUTE[route];
  if (!prdId) return 'To do';
  const doc = PRD_DOCUMENTS[prdId];
  if (!doc) return 'To do';
  const items = doc.items;
  if (items.length === 0) return 'To do';
  const done = items.filter((i) => i.status === 'Done').length;
  const inProg = items.filter((i) => i.status === 'In progress').length;
  if (done === items.length) return 'Done';
  if (inProg > 0) return 'In progress';
  if (done > 0) return 'Review';
  return 'To do';
}

export function defaultIARows(
  folder: DesignFolder,
  projectName?: string,
  suffixFmt: IdSuffixFormat = 'mixed',
  randomLen = 5,
  depthCfgs?: IADepthConfigs,
): IARow[] {
  const rows: IARow[] = [];
  const pShort = projectShortName(projectName ?? '');

  // Collect all files so we can look up parent screens by route.
  // Seed from prototype files first so parent routes are always available,
  // then overlay with the round's own files (which may have different names).
  const allFiles: DesignFile[] = [
    ...(folder.children ?? []).flatMap((child) => child.files),
    ...folder.files,
  ];
  const nameByRoute = new Map<string, string>();
  for (const proto of PROTOTYPE_FILES) {
    nameByRoute.set(proto.route, proto.name);
  }
  for (const file of allFiles) {
    if (file.route) nameByRoute.set(file.route, file.name);
  }

  /**
   * Route → the depth path of the screen at that route.
   *
   * The prototypes carry an explicit navigation path, so they seed this map
   * and everything else can be placed relative to them. Without it a screen
   * with no prototype behind it — anything generated from a task — took
   * `[file.name]` as its whole path, which made it depth1: its own top-level
   * section on the IA board, holding one card and connected to nothing.
   */
  const depthsByRoute = new Map<string, string[]>();
  for (const proto of PROTOTYPE_FILES) {
    if (proto.path) depthsByRoute.set(proto.route, proto.path.split(' > '));
  }

  /** The route a file speaks for — its own, or the live screen it revises. */
  const routeOf = (file: DesignFile): string | undefined => file.route ?? file.basedOnRoute;

  /**
   * Where a screen belongs in the hierarchy.
   *
   * In order of authority: its own prototype path; the screen it revises (same
   * parent, its own leaf, so a revision sits beside the original instead of
   * silently replacing it on a shared path); its parent route, which makes it
   * a child of that screen; and the subfolder it was filed in. A screen with
   * none of those is top level.
   */
  const depthsFor = (file: DesignFile, ancestors: string[]): string[] => {
    const proto = findPrototypeFile(file.id);
    if (proto?.path) return proto.path.split(' > ');

    const route = routeOf(file);
    if (route) {
      const exact = depthsByRoute.get(route);
      if (exact && exact.length > 0) return [...exact.slice(0, -1), file.name];

      const cut = route.lastIndexOf('/');
      if (cut > 0) {
        const parent = depthsByRoute.get(route.slice(0, cut));
        if (parent) return [...parent, file.name];
      }
    }

    if (ancestors.length > 0) return [...ancestors, file.name];
    /*
     * Nothing above it, so nothing above it on the sheet.
     *
     * This used to fall back to the round's own name, which put "version 2"
     * in Depth 1 — a round is when a screen was worked on, not where it sits,
     * and no product has a section called that. A screen filed loose in a
     * round is a top-level screen until someone says otherwise, which the
     * depth columns are editable for.
     */
    return [file.name];
  };

  /** Explicit navigation links for screens not connected by route hierarchy. */
  const EXPLICIT_LINKS: Record<string, string> = {
    '/eacc/login': '/eacc/dashboard',
    '/eacc/dashboard': '/eacc/close',
    '/eacc/close': '/eacc/close/blockers',
    '/eacc/corp-card': '/eacc/corp-card/bulk',
    '/eacc/cash-receipt': '/eacc/cash-receipt/detail',
    '/eacc/personal-expense': '/eacc/personal-expense/detail',
    '/eacc/approvals': '/eacc/corp-card',
  };

  /**
   * Shows which screen leads to this one.
   * Route hierarchy first (e.g. Corporate Card → Bulk Approve),
   * then explicit links (e.g. Login → Dashboard).
   */
  const workItemFor = (file: DesignFile): string => {
    if (!file.route) return file.name;
    // Check explicit navigation links first
    const explicitTarget = EXPLICIT_LINKS[file.route];
    if (explicitTarget) {
      const targetName = nameByRoute.get(explicitTarget);
      if (targetName) return `${file.name} → ${targetName}`;
    }
    // Then check route hierarchy
    const segments = file.route.replace(/\/$/, '').split('/');
    for (let i = segments.length - 1; i >= 2; i -= 1) {
      const parentRoute = segments.slice(0, i).join('/');
      const parentName = nameByRoute.get(parentRoute);
      if (parentName) return `${parentName} → ${file.name}`;
    }
    return file.name;
  };

  const pushFile = (file: DesignFile, ancestors: string[], folderId: string) => {
    // Use the prototype's path for depth columns when available — it carries
    // the full navigation hierarchy (e.g. "Expense Management > Corporate
    // Card > Bulk Approve"), which is richer than the folder tree alone.
    const depthSegments = depthsByFile.get(file.id) ?? depthsFor(file, ancestors);
    const [depth1 = '', depth2 = '', depth3 = '', depth4 = '', depth5 = ''] = depthSegments;
    const sType = screenTypeFor(file.fileName, file.id);
    const fileStatus = statusForRoute(file.route);
    const sid = screenCode(
      pShort,
      [depth1, depth2, depth3, depth4, depth5],
      sType,
      suffixFmt,
      randomLen,
      depthCfgs,
      fileStatus,
    );
    const sKey = screenKeyFromDepths(pShort, [depth1, depth2, depth3, depth4, depth5], sType);
    rows.push({
      id: `ia-${file.id}`,
      depth1,
      depth2,
      depth3,
      depth4,
      depth5,
      screenId: sid,
      screenKey: sKey,
      screenType: sType,
      platform: 'PC',
      workItem: workItemFor(file),
      prd: `PRD-${sid}`,
      frd: '',
      link: file.route ?? '',
      maintainer: 'User',
      menuGroup: ancestors[0] ?? depth1,
      status: fileStatus,
      projectName: projectName ?? '',
      fileId: file.id,
      folderId,
    });
  };

  const entries: { file: DesignFile; ancestors: string[]; folderId: string }[] = [
    ...(folder.children ?? []).flatMap((child) =>
      child.files.map((file) => ({ file, ancestors: [child.name], folderId: child.id })),
    ),
    ...folder.files.map((file) => ({ file, ancestors: [] as string[], folderId: folder.id })),
  ];

  /**
   * Depths are resolved shallowest route first, so a parent is always placed
   * before anything routed beneath it — otherwise a child processed early
   * would miss its parent and fall back to the round. Rows are still emitted
   * in the original order below; only the resolution is reordered, so the
   * sheet's row order does not shift.
   */
  const depthsByFile = new Map<string, string[]>();
  const depth = (file: DesignFile) => routeOf(file)?.split('/').filter(Boolean).length ?? 99;
  for (const entry of [...entries].sort((a, b) => depth(a.file) - depth(b.file))) {
    const segments = depthsFor(entry.file, entry.ancestors);
    depthsByFile.set(entry.file.id, segments);
    const route = routeOf(entry.file);
    if (route && !depthsByRoute.has(route)) depthsByRoute.set(route, segments);
  }

  for (const entry of entries) pushFile(entry.file, entry.ancestors, entry.folderId);

  return rows;
}

/**
 * Rewrites the depth columns of rows still carrying the first seed's shape.
 *
 * That seed copied one folder name into both Depth 1 and Depth 2, and called
 * a file with no folder "Root" — so a sheet saved back then reads
 * `Root > Root > Login` no matter how the seed changes afterwards, because
 * the overlay wins over it. Rather than making someone find Reset (and lose
 * every other edit with it), the two levels are re-derived from the folder.
 *
 * Only rows with that exact signature are touched: the first two levels equal
 * to each other, and a real file behind the row. A depth somebody typed in
 * themselves does not look like that, so it is left alone.
 */
function migrateDepths(rows: IARow[], folder: DesignFolder): IARow[] {
  const ancestorsByFile = new Map<string, string[]>();
  /*
   * A folder name can carry a whole path.
   *
   * A round holds one level of folder, but a screen's place in the IA is often
   * deeper than that — so a screen moved in from a Request brings its path as
   * the folder's name, "Login / Product Catalog / Checkout". Split back apart
   * here, that is three depth columns saying what it is; left joined, it was
   * all of it crammed into Depth 1.
   */
  for (const child of folder.children ?? []) {
    // Only ›, never /: a screen may well be called "Product Catalog / Checkout".
    const path = child.name
      .split('›')
      .map((part) => part.trim())
      .filter(Boolean);
    for (const file of child.files) {
      ancestorsByFile.set(file.id, path.length > 0 ? path : [child.name]);
    }
  }
  for (const file of folder.files) ancestorsByFile.set(file.id, []);

  return rows.map((row) => {
    // Migration 1: depth1 === depth2 (old seed shape).
    if (row.fileId && row.depth1 === row.depth2) {
      const ancestors = ancestorsByFile.get(row.fileId);
      if (ancestors) {
        const [depth1 = '', depth2 = '', depth3 = '', depth4 = '', depth5 = ''] = [
          ...ancestors,
          row.depth3 || row.workItem,
        ];
        row = {
          ...row,
          depth1,
          depth2,
          depth3,
          depth4,
          depth5,
          menuGroup: row.menuGroup === row.depth1 ? (ancestors[0] ?? '') : row.menuGroup,
        };
      }
    }

    // Migration 2: strip "eACC Cloud" from depth1 if it was added by a
    // previous seed — every row had the same value, which is redundant.
    if (row.depth1 === 'eACC Cloud') {
      row = {
        ...row,
        depth1: row.depth2,
        depth2: row.depth3,
        depth3: row.depth4,
        depth4: row.depth5,
        depth5: '',
      };
    }

    return row;
  });
}

/**
 * The overlay if someone has edited the sheet, else the files as they stand.
 *
 * An overlay is a snapshot, so on its own it goes stale the moment a screen is
 * added to the round — a design generated from a task would never reach the IA
 * sheet, and the sheet would quietly describe a product that no longer
 * matches. Rows for files the overlay has never seen are therefore appended to
 * it on read, built by the same seed the sheet would have used. Edited rows are
 * untouched, and a row someone typed by hand has no file behind it so it is
 * never treated as missing.
 */
export function loadIARows(
  projectId: string,
  version: number,
  folder: DesignFolder | undefined,
  projectName?: string,
  suffixFmt?: IdSuffixFormat,
  randomLen?: number,
  depthCfgs?: IADepthConfigs,
): IARow[] {
  const overlay = loadIAOverlay(projectId, version);
  if (overlay) {
    if (!folder) return overlay;
    const rows = migrateDepths(overlay, folder);
    const known = new Set(rows.map((row) => row.fileId).filter(Boolean));
    const added = defaultIARows(folder, projectName, suffixFmt, randomLen, depthCfgs).filter(
      (row) => row.fileId && !known.has(row.fileId),
    );
    return added.length > 0 ? [...rows, ...added] : rows;
  }
  return folder ? defaultIARows(folder, projectName, suffixFmt, randomLen, depthCfgs) : [];
}

let iaRowCounter = 0;

export function addIARow(projectId: string, version: number, rows: IARow[]): IARow[] {
  iaRowCounter += 1;
  const row: IARow = {
    id: `ia-new-${Date.now().toString(36)}-${iaRowCounter}`,
    depth1: '',
    depth2: '',
    depth3: '',
    depth4: '',
    depth5: '',
    screenId: '',
    screenKey: '',
    screenType: 'Screen',
    platform: 'PC',
    workItem: '',
    prd: '',
    frd: '',
    link: '',
    maintainer: 'User',
    menuGroup: '',
    status: 'To do',
    projectName: '',
  };
  return saveIARows(projectId, version, [...rows, row]);
}

export function duplicateIARow(
  projectId: string,
  version: number,
  rows: IARow[],
  rowId: string,
  suffixFmt?: IdSuffixFormat,
  randomLen?: number,
  depthCfgs?: IADepthConfigs,
): IARow[] {
  const at = rows.findIndex((entry) => entry.id === rowId);
  const source = rows[at];
  if (!source) return rows;
  iaRowCounter += 1;
  const newScreenId = screenCode(
    projectShortName(source.projectName),
    [source.depth1, source.depth2, source.depth3, source.depth4, source.depth5],
    source.screenType,
    suffixFmt,
    randomLen,
    depthCfgs,
  );
  const copy: IARow = {
    ...source,
    id: `ia-copy-${Date.now().toString(36)}-${iaRowCounter}`,
    screenId: newScreenId,
    screenKey: screenKeyFromDepths(
      projectShortName(source.projectName),
      [source.depth1, source.depth2, source.depth3, source.depth4, source.depth5],
      source.screenType,
    ),
    fileId: undefined,
    folderId: undefined,
  };
  return saveIARows(projectId, version, [...rows.slice(0, at + 1), copy, ...rows.slice(at + 1)]);
}

export function updateIARow(
  projectId: string,
  version: number,
  rows: IARow[],
  rowId: string,
  patch: IARowPatch,
): IARow[] {
  // When depths or screenType change, auto-regenerate screenKey to match
  // the human-readable pattern: project-depth1-depth2-…-screenType
  const resolved = { ...patch };
  if (
    resolved.screenKey === undefined &&
    (resolved.depth1 !== undefined ||
      resolved.depth2 !== undefined ||
      resolved.depth3 !== undefined ||
      resolved.depth4 !== undefined ||
      resolved.depth5 !== undefined ||
      resolved.screenType !== undefined)
  ) {
    const target = rows.find((r) => r.id === rowId);
    if (target) {
      const merged = { ...target, ...resolved };
      resolved.screenKey = screenKeyFromDepths(
        projectShortName(merged.projectName),
        [merged.depth1, merged.depth2, merged.depth3, merged.depth4, merged.depth5],
        merged.screenType,
      );
    }
  }
  return saveIARows(
    projectId,
    version,
    rows.map((entry) => (entry.id === rowId ? { ...entry, ...resolved } : entry)),
  );
}

export function deleteIARow(
  projectId: string,
  version: number,
  rows: IARow[],
  rowId: string,
): IARow[] {
  return saveIARows(
    projectId,
    version,
    rows.filter((entry) => entry.id !== rowId),
  );
}

/** Persists an arbitrary row set — the undo path when a delete is reversed. */
export function restoreIARows(projectId: string, version: number, rows: IARow[]): IARow[] {
  return saveIARows(projectId, version, rows);
}

/** Drops the overlay and reads the round's files fresh. */
export function resetIARows(
  projectId: string,
  version: number,
  folder: DesignFolder | undefined,
  projectName?: string,
  suffixFmt?: IdSuffixFormat,
  randomLen?: number,
  depthCfgs?: IADepthConfigs,
): IARow[] {
  try {
    workspaceStore.removeItem(iaKey(projectId, version));
  } catch {
    // ignore — there is nothing to remove either way
  }
  return folder ? defaultIARows(folder, projectName, suffixFmt, randomLen, depthCfgs) : [];
}

/**
 * Rebuild a screen ID keeping the existing random suffix intact.
 * Only the project prefix, depth segments, and screen type are regenerated
 * according to the current format settings.
 */
function rebuildScreenId(
  existing: string,
  projectShort: string,
  depths: string[],
  screenType: IAScreenType,
  suffixFmt: IdSuffixFormat,
  randomLen: number,
  depthCfgs: IADepthConfigs,
): string {
  const strip = (s: string) => s.replace(/\s+/g, '').toLowerCase();

  // Extract existing random suffix (last segment) to preserve it
  const oldParts = existing.split('-');
  const existingSuffix = (oldParts.length > 0 ? oldParts[oldParts.length - 1] : '') ?? '';

  // Decide whether to keep the old suffix or generate a new one:
  // keep it if the length and format haven't changed from what it looks like
  const suffixOk =
    existingSuffix.length === randomLen &&
    ((suffixFmt === 'number' && /^\d+$/.test(existingSuffix)) ||
      (suffixFmt === 'alpha' && /^[a-z]+$/i.test(existingSuffix)) ||
      (suffixFmt === 'mixed' && /^[a-z0-9]+$/i.test(existingSuffix)));
  const suffix = suffixOk ? existingSuffix.toLowerCase() : randomSuffix(suffixFmt, randomLen);

  const parts: string[] = [strip(projectShort)];
  depths.forEach((d, i) => {
    if (!d) return;
    const cfg = depthCfgs[i + 1];
    if (cfg?.digits && cfg?.format) {
      // For configured depths, check if the old ID already has a matching segment
      // at this position — if so keep it, otherwise generate new
      const oldDepthPart = oldParts[parts.length] ?? '';
      const depthOk =
        oldDepthPart.length === cfg.digits &&
        ((cfg.format === 'number' && /^\d+$/.test(oldDepthPart)) ||
          (cfg.format === 'alpha' && /^[a-z]+$/i.test(oldDepthPart)) ||
          (cfg.format === 'mixed' && /^[a-z0-9]+$/i.test(oldDepthPart)));
      parts.push(depthOk ? oldDepthPart.toLowerCase() : randomSuffix(cfg.format, cfg.digits));
    } else {
      parts.push(strip(d));
    }
  });

  parts.push(strip(screenType));
  parts.push(suffix);
  return parts.join('-');
}

/**
 * Re-generate screen IDs in every saved IA overlay for this project,
 * using the current format settings. Called when the user saves settings.
 * Preserves existing random suffixes where possible.
 */
export function regenerateScreenIds(
  projectId: string,
  projectName: string,
  suffixFmt: IdSuffixFormat,
  randomLen: number,
  depthCfgs: IADepthConfigs,
): void {
  const pShort = projectShortName(projectName);
  const prefix = `${IA_KEY}:${projectId}:`;
  try {
    // The store exposes its keys as a list, where localStorage had `length` and `key(i)`.
    const keys = workspaceStore.keys().filter((key) => key.startsWith(prefix));
    for (const key of keys) {
      const raw = workspaceStore.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      if (!isStoredRowArray(parsed)) continue;
      const rows = parsed.map(normalizeRow);
      const updated = rows.map((row) => {
        const newScreenId = rebuildScreenId(
          row.screenId,
          pShort,
          [row.depth1, row.depth2, row.depth3, row.depth4, row.depth5],
          row.screenType,
          suffixFmt,
          randomLen,
          depthCfgs,
        );
        return { ...row, screenId: newScreenId, prd: `PRD-${newScreenId}` };
      });
      workspaceStore.setItem(key, JSON.stringify(updated));
    }
  } catch {
    /* ignore */
  }
}
