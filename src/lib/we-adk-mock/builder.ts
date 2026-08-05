/** Static mock data for the Builder tool — mock data only, no API. */
import { type Chip } from './types';

export const WORK_GROUPS = ['Sandbox', 'Cloud', 'HD Korea Shipbuilding', 'Harim'] as const;

/**
 * One screen (canvas) inside a work mockup. `seedPattern` decides what the
 * Sketcher canvas starts from when the screen is opened, and each screen keeps
 * its own saved canvas in localStorage.
 */
export interface MockupScreen {
  id: string;
  name: string;
  route: string;
  /** Matches a PATTERN_CATALOG id in the sketcher model. */
  seedPattern: 'listPage' | 'detailPage' | 'dashboard';
  status: Chip;
  updatedAt: string;
}

export interface WorkMockupRow {
  id: string;
  kind: string;
  title: string;
  description: string;
  domain: string;
  pattern: string;
  author: string;
  updatedAt: string;
  screens: MockupScreen[];
  difficulty?: number;
  status?: Chip;
  comment?: string;
  prd?: Chip;
  starred?: boolean;
}

export const WORK_MOCKUPS: WorkMockupRow[] = [
  {
    id: 'wm-trip-plan',
    kind: 'User',
    title: 'Business trip plan',
    description: 'HD Korea Shipbuilding trip plan > trip plan edit',
    domain: 'business-plan',
    pattern: 'ListPage',
    author: 'Namwon Moon',
    updatedAt: '2026-07-23',
    screens: [
      {
        id: 'scr-trip-list',
        name: 'Trip plan list',
        route: '/eacc-cloud-business-plan/list',
        seedPattern: 'listPage',
        status: { label: 'Done', tone: 'green' },
        updatedAt: '2026-07-23',
      },
      {
        id: 'scr-trip-create',
        name: 'Trip plan editor',
        route: '/eacc-cloud-business-plan/create',
        seedPattern: 'detailPage',
        status: { label: 'Done', tone: 'green' },
        updatedAt: '2026-07-22',
      },
      {
        id: 'scr-trip-detail',
        name: 'Trip plan detail',
        route: '/eacc-cloud-business-plan/:id',
        seedPattern: 'detailPage',
        status: { label: 'In review', tone: 'blue' },
        updatedAt: '2026-07-21',
      },
      {
        id: 'scr-trip-proxy',
        name: 'Proxy drafting',
        route: '/eacc-cloud-business-plan/proxy',
        seedPattern: 'detailPage',
        status: { label: 'Draft', tone: 'slate' },
        updatedAt: '2026-07-18',
      },
    ],
  },
  {
    id: 'wm-classifier',
    kind: 'User',
    title: 'AI transaction classifier testbed',
    description: 'Intangible Classifier API full pipeline test',
    domain: 'classifier',
    pattern: '',
    author: 'Taehyuk Park',
    updatedAt: '2026-07-22',
    difficulty: 4,
    status: { label: 'In progress', tone: 'blue' },
    comment: '(temp) pick-complete test 5',
    prd: { label: 'Draft', tone: 'slate' },
    starred: true,
    screens: [
      {
        id: 'scr-cls-run',
        name: 'Pipeline run',
        route: '/classifier/run',
        seedPattern: 'dashboard',
        status: { label: 'In review', tone: 'blue' },
        updatedAt: '2026-07-22',
      },
      {
        id: 'scr-cls-rules',
        name: 'Rule precedence',
        route: '/classifier/rules',
        seedPattern: 'listPage',
        status: { label: 'Draft', tone: 'slate' },
        updatedAt: '2026-07-20',
      },
      {
        id: 'scr-cls-review',
        name: 'Human review queue',
        route: '/classifier/review',
        seedPattern: 'listPage',
        status: { label: 'Draft', tone: 'slate' },
        updatedAt: '2026-07-19',
      },
    ],
  },
  {
    id: 'wm-temp-storage',
    kind: 'User',
    title: 'Temp storage (search area etc...',
    description: 'Adding a trip-plan search area to the temp storage list...',
    domain: 'approval',
    pattern: 'ListPage',
    author: 'hong67',
    updatedAt: '2026-07-21',
    screens: [
      {
        id: 'scr-temp-list',
        name: 'Temp storage list',
        route: '/approval/temp',
        seedPattern: 'listPage',
        status: { label: 'Done', tone: 'green' },
        updatedAt: '2026-07-21',
      },
      {
        id: 'scr-temp-search',
        name: 'Search area variant',
        route: '/approval/temp?search=1',
        seedPattern: 'listPage',
        status: { label: 'In review', tone: 'blue' },
        updatedAt: '2026-07-21',
      },
    ],
  },
  {
    id: 'wm-trip-budget',
    kind: 'User',
    title: 'Trip plan budget balance display',
    description: 'Show remaining budget (cost center) on the trip plan editor...',
    domain: 'business-plan',
    pattern: 'WritePage',
    author: 'hong67',
    updatedAt: '2026-07-21',
    screens: [
      {
        id: 'scr-budget-editor',
        name: 'Editor with balance',
        route: '/eacc-cloud-business-plan/create',
        seedPattern: 'detailPage',
        status: { label: 'Done', tone: 'green' },
        updatedAt: '2026-07-21',
      },
      {
        id: 'scr-budget-zero',
        name: 'Zero-balance state',
        route: '/eacc-cloud-business-plan/create?balance=0',
        seedPattern: 'detailPage',
        status: { label: 'Done', tone: 'green' },
        updatedAt: '2026-07-20',
      },
    ],
  },
  {
    id: 'wm-settle-budget',
    kind: 'User',
    title: 'Trip settlement budget balance display',
    description: 'Show remaining budget (cost center) on the trip settlement editor...',
    domain: 'cloud-expense-...',
    pattern: 'WritePage',
    author: 'hong67',
    updatedAt: '2026-07-21',
    screens: [
      {
        id: 'scr-settle-editor',
        name: 'Settlement editor',
        route: '/eacc-cloud-expense-report/create',
        seedPattern: 'detailPage',
        status: { label: 'In review', tone: 'blue' },
        updatedAt: '2026-07-21',
      },
      {
        id: 'scr-settle-list',
        name: 'Settlement list',
        route: '/eacc-cloud-expense-report/list',
        seedPattern: 'listPage',
        status: { label: 'Draft', tone: 'slate' },
        updatedAt: '2026-07-17',
      },
    ],
  },
  {
    id: 'wm-dashboard',
    kind: 'User',
    title: 'Dashboard (Hong)',
    description: 'First screen after login, top proposal/latest/summary widgets',
    domain: 'dashboard',
    pattern: '',
    author: 'Taechan Kim',
    updatedAt: '2026-07-16',
    screens: [
      {
        id: 'scr-dash-main',
        name: 'Main dashboard',
        route: '/dashboard',
        seedPattern: 'dashboard',
        status: { label: 'In review', tone: 'blue' },
        updatedAt: '2026-07-16',
      },
      {
        id: 'scr-dash-empty',
        name: 'Empty state',
        route: '/dashboard?empty=1',
        seedPattern: 'dashboard',
        status: { label: 'Draft', tone: 'slate' },
        updatedAt: '2026-07-14',
      },
      {
        id: 'scr-dash-mobile',
        name: 'Mobile layout',
        route: '/dashboard?device=mobile',
        seedPattern: 'dashboard',
        status: { label: 'Draft', tone: 'slate' },
        updatedAt: '2026-07-14',
      },
    ],
  },
  {
    id: 'wm-trip-list-design',
    kind: 'User',
    title: 'Trip plan list (design...',
    description: 'Personal trip-plan list screen (/eacc-cloud-b...',
    domain: 'business-plan',
    pattern: 'ListPage',
    author: 'Taehyuk Park',
    updatedAt: '2026-07-15',
    prd: { label: 'Final', tone: 'green' },
    screens: [
      {
        id: 'scr-tld-list',
        name: 'List (redesign)',
        route: '/eacc-cloud-business-plan/list',
        seedPattern: 'listPage',
        status: { label: 'Done', tone: 'green' },
        updatedAt: '2026-07-15',
      },
      {
        id: 'scr-tld-filters',
        name: 'Expanded filters',
        route: '/eacc-cloud-business-plan/list?filters=all',
        seedPattern: 'listPage',
        status: { label: 'Done', tone: 'green' },
        updatedAt: '2026-07-15',
      },
      {
        id: 'scr-tld-bulk',
        name: 'Bulk selection',
        route: '/eacc-cloud-business-plan/list?bulk=1',
        seedPattern: 'listPage',
        status: { label: 'In review', tone: 'blue' },
        updatedAt: '2026-07-14',
      },
      {
        id: 'scr-tld-empty',
        name: 'No results',
        route: '/eacc-cloud-business-plan/list?empty=1',
        seedPattern: 'listPage',
        status: { label: 'Done', tone: 'green' },
        updatedAt: '2026-07-12',
      },
    ],
  },
  {
    id: 'wm-trip-create-design',
    kind: 'User',
    title: 'Trip plan editor (design...',
    description: 'Trip plan editor screen (BstrPlanCreateVier...',
    domain: 'business-plan',
    pattern: 'WritePage',
    author: 'Namwon Moon',
    updatedAt: '2026-07-03',
    screens: [
      {
        id: 'scr-tcd-editor',
        name: 'Editor (redesign)',
        route: '/eacc-cloud-business-plan/create',
        seedPattern: 'detailPage',
        status: { label: 'Draft', tone: 'slate' },
        updatedAt: '2026-07-03',
      },
    ],
  },
  {
    id: 'wm-vehicle',
    kind: 'User',
    title: 'Vehicle management list',
    description: 'Asset management list (real domain: car, OTO integration)',
    domain: 'car-management',
    pattern: 'ListPage',
    author: 'Radi',
    updatedAt: '2026-07-01',
    screens: [
      {
        id: 'scr-veh-list',
        name: 'Vehicle list',
        route: '/car-management/list',
        seedPattern: 'listPage',
        status: { label: 'Done', tone: 'green' },
        updatedAt: '2026-07-01',
      },
      {
        id: 'scr-veh-detail',
        name: 'Vehicle detail',
        route: '/car-management/:id',
        seedPattern: 'detailPage',
        status: { label: 'Done', tone: 'green' },
        updatedAt: '2026-07-01',
      },
      {
        id: 'scr-veh-assign',
        name: 'Assignment history',
        route: '/car-management/:id/history',
        seedPattern: 'listPage',
        status: { label: 'In review', tone: 'blue' },
        updatedAt: '2026-06-30',
      },
      {
        id: 'scr-veh-maint',
        name: 'Maintenance log',
        route: '/car-management/:id/maintenance',
        seedPattern: 'listPage',
        status: { label: 'Draft', tone: 'slate' },
        updatedAt: '2026-06-28',
      },
      {
        id: 'scr-veh-kpi',
        name: 'Fleet KPIs',
        route: '/car-management/kpi',
        seedPattern: 'dashboard',
        status: { label: 'Draft', tone: 'slate' },
        updatedAt: '2026-06-27',
      },
    ],
  },
  {
    id: 'wm-tran-type',
    kind: 'User',
    title: 'Transaction type management',
    description: 'Account mapping by transaction type for SAP entry auto-generation',
    domain: 'tran-type',
    pattern: 'ListPage',
    author: 'Juhee Yeon',
    updatedAt: '2026-07-01',
    screens: [
      {
        id: 'scr-tt-list',
        name: 'Transaction types',
        route: '/tran-type/list',
        seedPattern: 'listPage',
        status: { label: 'Done', tone: 'green' },
        updatedAt: '2026-07-01',
      },
      {
        id: 'scr-tt-mapping',
        name: 'Account mapping',
        route: '/tran-type/:id/mapping',
        seedPattern: 'detailPage',
        status: { label: 'In review', tone: 'blue' },
        updatedAt: '2026-06-30',
      },
      {
        id: 'scr-tt-preview',
        name: 'SAP entry preview',
        route: '/tran-type/preview',
        seedPattern: 'detailPage',
        status: { label: 'Draft', tone: 'slate' },
        updatedAt: '2026-06-29',
      },
      {
        id: 'scr-tt-audit',
        name: 'Change audit',
        route: '/tran-type/audit',
        seedPattern: 'listPage',
        status: { label: 'Draft', tone: 'slate' },
        updatedAt: '2026-06-26',
      },
    ],
  },
];

/** Flat lookup so the canvas editor can resolve a screen from its id. */
export function findMockupScreen(
  screenId: string,
): { mockup: WorkMockupRow; screen: MockupScreen } | null {
  for (const mockup of WORK_MOCKUPS) {
    const screen = mockup.screens.find((entry) => entry.id === screenId);
    if (screen) return { mockup, screen };
  }
  return null;
}

export interface RequirementRow {
  kind: string;
  title: string;
  status: Chip;
  difficulty?: number;
  planner: string;
  developer: string;
  statusChangedAt: string;
  completedAt: string;
  comment: string;
}

export const REQUIREMENTS: RequirementRow[] = [
  {
    kind: 'Regulated trips > trip settings > bas...',
    title: 'Regulated trips > trip settings > bas...',
    status: { label: 'In progress', tone: 'blue' },
    planner: 'Seongmin Yoo',
    developer: 'Mingyu Park',
    statusChangedAt: '2026-07-21',
    completedAt: '—',
    comment: '—',
  },
  {
    kind: 'Trip plan list (design)',
    title: 'Trip plan list (design)',
    status: { label: 'On hold', tone: 'slate' },
    planner: 'Taehyuk Park',
    developer: '—',
    statusChangedAt: '2026-07-17',
    completedAt: '—',
    comment: '—',
  },
  {
    kind: 'Trip expense settlement status spec v1.7',
    title: 'Trip expense settlement status spec v1.7',
    status: { label: 'Requested', tone: 'amber' },
    planner: '—',
    developer: '—',
    statusChangedAt: '—',
    completedAt: '—',
    comment: '—',
  },
  {
    kind: 'Screen requirements (drafted directly by...',
    title: 'Screen requirements (drafted directly by...',
    status: { label: 'Requested', tone: 'amber' },
    planner: '—',
    developer: '—',
    statusChangedAt: '—',
    completedAt: '—',
    comment: '—',
  },
  {
    kind: 'SK Hynix trip management syst...',
    title: 'SK Hynix trip management syst...',
    status: { label: 'Requested', tone: 'amber' },
    planner: '—',
    developer: '—',
    statusChangedAt: '—',
    completedAt: '—',
    comment: '—',
  },
];

export interface SolutionMockupRow {
  kind: string;
  path: string;
  link: string;
  status: Chip;
  generatedAt: string;
  nested?: boolean;
}

export const SOLUTION_TABS = ['Cloud', 'HD Korea Shipbuilding', 'Harim'] as const;

export const SOLUTION_MOCKUPS: SolutionMockupRow[] = [
  {
    kind: 'User',
    path: 'Login',
    link: '/login',
    status: { label: 'Generated', tone: 'green' },
    generatedAt: '2026-07-24',
  },
  {
    kind: 'User',
    path: 'Corporate card > Corporate card',
    link: '/eacc-cloud-corp-card/list',
    status: { label: 'Generated', tone: 'green' },
    generatedAt: '2026-07-03',
    nested: true,
  },
  {
    kind: 'User',
    path: 'Personal expense > Personal expense',
    link: '/eacc-cloud-personal-expen...',
    status: { label: 'Generated', tone: 'green' },
    generatedAt: '2026-07-03',
    nested: true,
  },
  {
    kind: 'User',
    path: 'Purchase tax invoice > Purchase tax invoi...',
    link: '/eacc-cloud-tax-invoice/list',
    status: { label: 'Generated', tone: 'green' },
    generatedAt: '2026-07-06',
  },
  {
    kind: 'User',
    path: 'Business trip plan > Trip plan',
    link: '/eacc-cloud-business-plan/...',
    status: { label: 'Generated', tone: 'green' },
    generatedAt: '2026-07-03',
    nested: true,
  },
  {
    kind: 'User',
    path: 'Business trip plan > Trip plan (drafted by proxy)',
    link: '/eacc-cloud-business-plan/...',
    status: { label: 'Generated', tone: 'green' },
    generatedAt: '2026-07-03',
    nested: true,
  },
  {
    kind: 'User',
    path: 'Accountant > Corporate card (all)',
    link: '/eacc-cloud-accountant/cor...',
    status: { label: 'Generated', tone: 'green' },
    generatedAt: '2026-07-06',
  },
];

export interface FeatureSpecRow {
  kind: string;
  path: string;
  description: string;
  specStatus: Chip;
  generatedAt: string;
}

export const FEATURE_SPECS: FeatureSpecRow[] = [
  {
    kind: 'User',
    path: 'Login',
    description: '—',
    specStatus: { label: 'None', tone: 'slate' },
    generatedAt: '—',
  },
  {
    kind: 'User',
    path: 'Corporate card > Corporate card',
    description:
      'View/search corporate-card charges issued to the user by tab period and status, then attach receipts and...',
    specStatus: { label: 'Available', tone: 'green' },
    generatedAt: '2026-07-11',
  },
  {
    kind: 'User',
    path: 'Personal expense > Personal expense',
    description:
      'Employees view/search personal card and cash expenses with detail filters, then reconcile via scraping-OCR-manual entry...',
    specStatus: { label: 'Available', tone: 'green' },
    generatedAt: '2026-07-11',
  },
  {
    kind: 'User',
    path: 'Cash receipt > Cash receipt',
    description:
      'View/search cash-receipt usage by voucher status; bulk- or single-delete unvouchered items...',
    specStatus: { label: 'Available', tone: 'green' },
    generatedAt: '2026-07-11',
  },
  {
    kind: 'User',
    path: 'Purchase tax invoice > Purchase tax invoice',
    description:
      'Purchasing staff view/search their purchase tax invoices by status tab, then draft-view-detail-file the voucher...',
    specStatus: { label: 'Available', tone: 'green' },
    generatedAt: '2026-07-11',
  },
  {
    kind: 'User',
    path: 'Business trip plan > Trip plan',
    description:
      'View/search trip plans the user authored by approval-status tab, period and detail filters, and create new...',
    specStatus: { label: 'Available', tone: 'green' },
    generatedAt: '2026-07-11',
  },
];

/** Lighter sub-sections that appear in the Builder nav but weren't screenshotted. */
export const SCREEN_DESIGNS = [
  {
    path: 'Login',
    component: 'LoginPage.tsx',
    status: { label: 'Done', tone: 'green' as const },
    updatedAt: '2026-07-24',
  },
  {
    path: 'Corporate card > Corporate card',
    component: 'CorpCardListPage.tsx',
    status: { label: 'Done', tone: 'green' as const },
    updatedAt: '2026-07-11',
  },
  {
    path: 'Business trip plan > Trip plan',
    component: 'BizPlanListPage.tsx',
    status: { label: 'In review', tone: 'blue' as const },
    updatedAt: '2026-07-09',
  },
];

export const UNIT_TESTS = [
  { suite: 'CorpCardListPage', cases: 18, passed: 18, coverage: 92 },
  { suite: 'BizPlanCreatePage', cases: 12, passed: 11, coverage: 81 },
  { suite: 'TaxInvoiceListPage', cases: 9, passed: 9, coverage: 88 },
];

export const INTEGRATION_TESTS = [
  {
    scenario: 'Draft trip plan → submit for approval → approve',
    status: { label: 'Passed', tone: 'green' as const },
    ranAt: '2026-07-20',
  },
  {
    scenario: 'Auto-generate corporate-card purchase voucher',
    status: { label: 'Passed', tone: 'green' as const },
    ranAt: '2026-07-19',
  },
  {
    scenario: 'Bulk-delete unvouchered cash receipts',
    status: { label: 'Failed', tone: 'red' as const },
    ranAt: '2026-07-18',
  },
];

export const USER_MANUALS = [
  { title: 'Trip plan authoring guide', audience: 'All employees', updatedAt: '2026-07-22' },
  { title: 'Corporate card usage lookup guide', audience: 'Cardholders', updatedAt: '2026-07-11' },
  {
    title: 'Accountant voucher-processing manual',
    audience: 'Accounting team',
    updatedAt: '2026-07-08',
  },
];
