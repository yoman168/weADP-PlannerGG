/** Static mock data for the Developer harness view — mock data only, no API. */
import { type Chip } from './types';

/* ------------------------------------------------------------------ */
/* The harness — the shared work contract Claude Code runs on          */
/* ------------------------------------------------------------------ */

export type HarnessPillarKey =
  | 'rules'
  | 'domainContext'
  | 'workflow'
  | 'accessLimits'
  | 'validation'
  /**
   * What the screens must look like.
   *
   * A sixth pillar rather than a line inside `validation`, because it answers a
   * different question: `validation` is "is this correct", this is "is this the
   * product". The Design tool now produces a DESIGN.md per round, and an input
   * with no pillar behind it is advisory — work would pass every DoD item and
   * still ship the wrong radius.
   */
  | 'designConformance';

export interface HarnessPillar {
  key: HarnessPillarKey;
  label: string;
  summary: string;
  items: string[];
}

export interface Harness {
  id: string;
  name: string;
  businessLine: string;
  version: string;
  pillars: HarnessPillar[];
}

export const HARNESS_PILLAR_LABELS: Record<HarnessPillarKey, string> = {
  rules: 'Development rules',
  domainContext: 'Domain context',
  workflow: 'Workflow',
  accessLimits: 'Access limits',
  validation: 'Validation standards',
  designConformance: 'Design conformance',
};

export const HARNESSES: Harness[] = [
  {
    id: 'harness-lc-seoul',
    name: 'LocalCurrency_Seoul harness',
    businessLine: 'Local Currency',
    version: 'v3',
    pillars: [
      {
        key: 'rules',
        label: HARNESS_PILLAR_LABELS.rules,
        summary: 'How code must be written in this codebase.',
        items: [
          'Strict TypeScript — no implicit any, no non-null assertions',
          'All money handled in minor units as integers, never floats',
          'Every multi-step write wrapped in a transaction',
          'No raw SQL outside the repository layer',
        ],
      },
      {
        key: 'domainContext',
        label: HARNESS_PILLAR_LABELS.domainContext,
        summary: 'Business facts the AI must reason with, not guess at.',
        items: [
          'Vouchers expire 5 years from issue; expiry is regional policy, not global',
          'Settlement runs T+2 on business days, excluding regional holidays',
          'Merchant category codes restrict which vouchers are redeemable',
          'Refunds must reverse the original issue channel',
        ],
      },
      {
        key: 'workflow',
        label: HARNESS_PILLAR_LABELS.workflow,
        summary: 'The fixed sequence every task moves through.',
        items: [
          'Requirements analysis → code exploration → implementation → testing → review',
          'Maker implements; a separate read-only checker approves',
          'Implementation may not begin until the requirement is mapped to files',
        ],
      },
      {
        key: 'accessLimits',
        label: HARNESS_PILLAR_LABELS.accessLimits,
        summary: 'What the AI is forbidden from touching.',
        items: [
          'No production database access, ever',
          'PII columns (resident_no, phone) are masked in every fixture',
          'Settlement tables are read-only from application code',
          'Secrets resolved through the vault client, never inlined',
        ],
      },
      {
        key: 'validation',
        label: HARNESS_PILLAR_LABELS.validation,
        summary: 'What must be true before work counts as done.',
        items: [
          'Unit coverage ≥ 80% on changed files',
          'Regression suite green before review is requested',
          'Critical and high review findings block completion',
          'Iteration cap of 5; exceeding it escalates to a human owner',
        ],
      },
      {
        key: 'designConformance',
        label: HARNESS_PILLAR_LABELS.designConformance,
        summary: "The round's DESIGN.md governs how the screens look.",
        items: [
          'Read tokens from the round DESIGN.md — never introduce a raw hex value',
          'Component geometry comes from the component spec, not from the mockup',
          'A block override in the design is an exception; reproduce it, do not generalise it',
          'Where the spec is silent, ask rather than invent — the gaps section says where',
        ],
      },
    ],
  },
  {
    id: 'harness-hd-shipbuilding',
    name: 'HD Korea Shipbuilding harness',
    businessLine: 'HD Korea Shipbuilding',
    version: 'v1',
    pillars: [
      {
        key: 'rules',
        label: HARNESS_PILLAR_LABELS.rules,
        summary: 'How code must be written in this codebase.',
        items: [
          'Java 17 + Spring conventions; constructor injection only',
          'Cost-centre codes validated against the master before persist',
          'All dates stored UTC, rendered in KST',
        ],
      },
      {
        key: 'domainContext',
        label: HARNESS_PILLAR_LABELS.domainContext,
        summary: 'Business facts the AI must reason with, not guess at.',
        items: [
          'Trip budgets are held per cost centre and per fiscal quarter',
          'Approval routes differ for domestic vs. overseas travel',
          'Proxy drafting is allowed only for the same department',
        ],
      },
      {
        key: 'workflow',
        label: HARNESS_PILLAR_LABELS.workflow,
        summary: 'The fixed sequence every task moves through.',
        items: [
          'Requirements analysis → code exploration → implementation → testing → review',
          'Maker implements; a separate read-only checker approves',
        ],
      },
      {
        key: 'accessLimits',
        label: HARNESS_PILLAR_LABELS.accessLimits,
        summary: 'What the AI is forbidden from touching.',
        items: [
          'SAP interface stubs only — no live ERP calls',
          'Employee master is read-only',
          'No changes to the approval-engine core',
        ],
      },
      {
        key: 'validation',
        label: HARNESS_PILLAR_LABELS.validation,
        summary: 'What must be true before work counts as done.',
        items: [
          'Unit coverage ≥ 80% on changed files',
          'Budget-calculation cases must include a zero-balance test',
          'Critical and high review findings block completion',
        ],
      },
      {
        key: 'designConformance',
        label: HARNESS_PILLAR_LABELS.designConformance,
        summary: "The round's DESIGN.md governs how the screens look.",
        items: [
          'Read tokens from the round DESIGN.md — never introduce a raw hex value',
          'Figures use tabular numerals; a budget column that shifts is a defect',
          'Table row height comes from the table spec, not from the density that looks right',
        ],
      },
    ],
  },
  {
    id: 'harness-ai-rnd',
    name: 'AI R&D harness',
    businessLine: 'AI R&D',
    version: 'v2',
    pillars: [
      {
        key: 'rules',
        label: HARNESS_PILLAR_LABELS.rules,
        summary: 'How code must be written in this codebase.',
        items: [
          'Classifier rules are data, not code — no hard-coded categories',
          'Every rule change ships with a labelled fixture',
          'Model calls go through the shared client with retry + budget caps',
        ],
      },
      {
        key: 'domainContext',
        label: HARNESS_PILLAR_LABELS.domainContext,
        summary: 'Business facts the AI must reason with, not guess at.',
        items: [
          'Transaction categories follow the group accounting chart, not a generic taxonomy',
          'A transaction may match several rules; precedence is explicit and ordered',
          'Ambiguous transactions must fall through to human review, never a guess',
        ],
      },
      {
        key: 'workflow',
        label: HARNESS_PILLAR_LABELS.workflow,
        summary: 'The fixed sequence every task moves through.',
        items: [
          'Requirements analysis → code exploration → implementation → testing → review',
          'Rule-precedence conflicts require a domain expert sign-off',
        ],
      },
      {
        key: 'accessLimits',
        label: HARNESS_PILLAR_LABELS.accessLimits,
        summary: 'What the AI is forbidden from touching.',
        items: [
          'Training data is read-only and never copied out of the workspace',
          'No customer transaction records in test fixtures',
        ],
      },
      {
        key: 'validation',
        label: HARNESS_PILLAR_LABELS.validation,
        summary: 'What must be true before work counts as done.',
        items: [
          'Classification accuracy must not regress against the golden set',
          'Every precedence change re-runs the full conflict suite',
          'Iteration cap of 5; exceeding it escalates to a human owner',
        ],
      },
      {
        key: 'designConformance',
        label: HARNESS_PILLAR_LABELS.designConformance,
        summary: "The round's DESIGN.md governs how the screens look.",
        items: [
          'Read tokens from the round DESIGN.md — never introduce a raw hex value',
          'Confidence and accuracy read as chips with a word in them, never colour alone',
          'Where the spec is silent, ask rather than invent — the gaps section says where',
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export type DevStep =
  'Requirements analysis' | 'Code exploration' | 'Implementation' | 'Testing' | 'Review' | 'Done';

export const DEV_STEPS: DevStep[] = [
  'Requirements analysis',
  'Code exploration',
  'Implementation',
  'Testing',
  'Review',
  'Done',
];

/** Per-stage evidence that the harness was actually applied, not just declared. */
export interface StageDetail {
  step: DevStep;
  /** Which domain-context facts shaped this stage. */
  domainContext: string[];
  /** What verification ran at this stage. */
  verification: string[];
}

export interface DevSession {
  id: string;
  title: string;
  harnessId: string;
  harness: string;
  status: Chip;
  currentStep: DevStep;
  startedAt: string;
  iterations: { used: number; cap: number };
  /** Inbound handoff from Builder. */
  inbound: {
    requirement: string;
    planner: string;
    prdStatus: Chip;
    difficulty: number;
  };
  stages: StageDetail[];
  files: { path: string; additions: number; deletions: number }[];
  checkerVerdict: Chip;
  checkerNotes: string[];
  dod: { label: string; done: boolean }[];
  severityCounts: { critical: number; high: number; medium: number; low: number };
  artifacts: { label: string; href: string; ready: boolean }[];
}

export const DEV_SESSIONS: DevSession[] = [
  {
    id: 'sess-1042',
    title: 'Implement corporate card usage lookup screen',
    harnessId: 'harness-lc-seoul',
    harness: 'LocalCurrency_Seoul harness v3',
    status: { label: 'Review', tone: 'blue' },
    currentStep: 'Review',
    startedAt: '2026-07-29 09:12',
    iterations: { used: 2, cap: 5 },
    inbound: {
      requirement: 'Screen requirements (drafted directly by planner)',
      planner: 'Taehyuk Park',
      prdStatus: { label: 'PRD final', tone: 'green' },
      difficulty: 3,
    },
    stages: [
      {
        step: 'Requirements analysis',
        domainContext: [
          'Merchant category codes restrict redeemable vouchers — filter must respect them',
          'Settlement is T+2, so "pending" rows are expected in the default view',
        ],
        verification: ['Requirement items mapped 1:1 to acceptance checks before coding began'],
      },
      {
        step: 'Code exploration',
        domainContext: ['Existing list pages share the ListPage pattern and the shared filter bar'],
        verification: [
          'Located 3 reusable components; confirmed no duplicate lookup endpoint exists',
        ],
      },
      {
        step: 'Implementation',
        domainContext: [
          'Amounts rendered from minor units — no float arithmetic in the formatter',
          'PII columns masked in the fixture used for local runs',
        ],
        verification: ['Type check clean', 'Access-control guard applied to the new route'],
      },
      {
        step: 'Testing',
        domainContext: ['Regional holiday calendar drives the date-range edge cases'],
        verification: [
          '18 unit tests added · coverage 92% on changed files',
          'Regression suite green',
        ],
      },
      {
        step: 'Review',
        domainContext: ['Checker re-applied the settlement and masking rules independently'],
        verification: ['1 high + 2 medium findings raised — high finding blocks completion'],
      },
    ],
    files: [
      { path: 'src/pages/corp-card/CorpCardListPage.tsx', additions: 214, deletions: 12 },
      { path: 'src/api/corp-card.ts', additions: 58, deletions: 3 },
      { path: 'src/pages/corp-card/CorpCardListPage.test.tsx', additions: 96, deletions: 0 },
    ],
    checkerVerdict: { label: 'Changes requested', tone: 'amber' },
    checkerNotes: [
      'API is called without date-range validation — needs to handle end date < start date',
      'Pagination total count uses the pre-filter value',
    ],
    dod: [
      { label: 'All requirement items addressed', done: true },
      { label: 'Unit test coverage ≥ 80%', done: true },
      { label: 'Access control checks applied', done: true },
      { label: 'All review comments addressed', done: false },
    ],
    severityCounts: { critical: 0, high: 1, medium: 2, low: 3 },
    artifacts: [
      { label: 'Feature spec', href: '/we-adk/builder/specs', ready: false },
      { label: 'Screen design', href: '/we-adk/builder/screens', ready: false },
      { label: 'Unit tests', href: '/we-adk/builder/unit-tests', ready: true },
      { label: 'User manual', href: '/we-adk/builder/manuals', ready: false },
    ],
  },
  {
    id: 'sess-1038',
    title: 'Add budget-balance display to trip plan',
    harnessId: 'harness-hd-shipbuilding',
    harness: 'HD Korea Shipbuilding harness v1',
    status: { label: 'Done', tone: 'green' },
    currentStep: 'Done',
    startedAt: '2026-07-28 14:03',
    iterations: { used: 1, cap: 5 },
    inbound: {
      requirement: 'Trip plan budget balance display',
      planner: 'hong67',
      prdStatus: { label: 'PRD final', tone: 'green' },
      difficulty: 2,
    },
    stages: [
      {
        step: 'Requirements analysis',
        domainContext: ['Budgets are held per cost centre and per fiscal quarter'],
        verification: ['Confirmed which quarter the editor should read when a trip spans two'],
      },
      {
        step: 'Code exploration',
        domainContext: ['Cost-centre master is read-only from application code'],
        verification: ['Found the existing budget client; no new interface needed'],
      },
      {
        step: 'Implementation',
        domainContext: ['Cost-centre code validated against the master before persist'],
        verification: ['Type check clean', 'No writes to the employee master'],
      },
      {
        step: 'Testing',
        domainContext: ['A zero-balance trip is a real, supported case'],
        verification: ['12 unit tests · includes the mandated zero-balance case', 'Coverage 81%'],
      },
      {
        step: 'Review',
        domainContext: ['Checker verified quarter selection against the fiscal calendar'],
        verification: ['DoD confirmed met — approved with 1 low note'],
      },
      {
        step: 'Done',
        domainContext: [],
        verification: ['All four AI deliverables generated and returned to Builder'],
      },
    ],
    files: [
      { path: 'src/pages/business-plan/BizPlanCreatePage.tsx', additions: 41, deletions: 4 },
      { path: 'src/api/budget.ts', additions: 22, deletions: 0 },
    ],
    checkerVerdict: { label: 'Approved', tone: 'green' },
    checkerNotes: ['DoD confirmed as met, no further comments'],
    dod: [
      { label: 'All requirement items addressed', done: true },
      { label: 'Unit test coverage ≥ 80%', done: true },
      { label: 'Access control checks applied', done: true },
      { label: 'All review comments addressed', done: true },
    ],
    severityCounts: { critical: 0, high: 0, medium: 0, low: 1 },
    artifacts: [
      { label: 'Feature spec', href: '/we-adk/builder/specs', ready: true },
      { label: 'Screen design', href: '/we-adk/builder/screens', ready: true },
      { label: 'Unit tests', href: '/we-adk/builder/unit-tests', ready: true },
      { label: 'User manual', href: '/we-adk/builder/manuals', ready: true },
    ],
  },
  {
    id: 'sess-1051',
    title: 'Implement AI transaction-classifier pipeline',
    harnessId: 'harness-ai-rnd',
    harness: 'AI R&D harness v2',
    status: { label: 'Escalated', tone: 'red' },
    currentStep: 'Implementation',
    startedAt: '2026-07-27 11:47',
    iterations: { used: 5, cap: 5 },
    inbound: {
      requirement: 'AI transaction classifier testbed',
      planner: 'Taehyuk Park',
      prdStatus: { label: 'PRD draft', tone: 'slate' },
      difficulty: 4,
    },
    stages: [
      {
        step: 'Requirements analysis',
        domainContext: [
          'Categories follow the group accounting chart, not a generic taxonomy',
          'Ambiguous transactions must fall through to human review',
        ],
        verification: ['Flagged that rule precedence was under-specified in the PRD'],
      },
      {
        step: 'Code exploration',
        domainContext: ['Classifier rules live as data; no hard-coded categories allowed'],
        verification: ['Mapped the existing rule loader and precedence resolver'],
      },
      {
        step: 'Implementation',
        domainContext: [
          'Precedence is explicit and ordered — conflicts cannot be silently resolved',
        ],
        verification: [
          'Golden-set accuracy regressed on 3 conflicting rules',
          'Iteration cap reached — auto-paused and escalated to a human owner',
        ],
      },
    ],
    files: [
      { path: 'src/classifier/pipeline.ts', additions: 302, deletions: 87 },
      { path: 'src/classifier/rules/mapping.ts', additions: 140, deletions: 20 },
    ],
    checkerVerdict: { label: 'Review paused', tone: 'slate' },
    checkerNotes: [
      'Auto-paused after exceeding the iteration cap (5) — escalated to the owning developer.',
      'Classification-rule conflicts keep recurring; needs a domain expert to weigh in.',
    ],
    dod: [
      { label: 'All requirement items addressed', done: false },
      { label: 'Unit test coverage ≥ 80%', done: false },
      { label: 'Access control checks applied', done: true },
      { label: 'All review comments addressed', done: false },
    ],
    severityCounts: { critical: 1, high: 2, medium: 1, low: 0 },
    artifacts: [
      { label: 'Feature spec', href: '/we-adk/builder/specs', ready: false },
      { label: 'Screen design', href: '/we-adk/builder/screens', ready: false },
      { label: 'Unit tests', href: '/we-adk/builder/unit-tests', ready: false },
      { label: 'User manual', href: '/we-adk/builder/manuals', ready: false },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Inbound requirement queue — the work handed over from Builder        */
/* ------------------------------------------------------------------ */

export type RequirementStatus = 'Requested' | 'Accepted' | 'In progress' | 'On hold' | 'Done';

export const REQUIREMENT_STATUS_META: Record<RequirementStatus, Chip> = {
  Requested: { label: 'Requested', tone: 'amber' },
  Accepted: { label: 'Accepted', tone: 'violet' },
  'In progress': { label: 'In progress', tone: 'blue' },
  'On hold': { label: 'On hold', tone: 'slate' },
  Done: { label: 'Done', tone: 'green' },
};

export const REQUIREMENT_STATUS_ORDER: RequirementStatus[] = [
  'Requested',
  'Accepted',
  'In progress',
  'On hold',
  'Done',
];

export interface InboundRequirement {
  id: string;
  title: string;
  summary: string;
  planner: string;
  difficulty: number;
  prdStatus: Chip;
  status: RequirementStatus;
  harnessId: string;
  /** Present once implementation work has started. */
  sessionId?: string;
  acceptanceCriteria: string[];
  /** Screens in Builder this requirement changes. */
  targetScreens: { name: string; screenId: string }[];
  handedOverAt: string;
}

export const INBOUND_REQUIREMENTS: InboundRequirement[] = [
  {
    id: 'req-corp-card-lookup',
    title: 'Corporate card usage lookup screen',
    summary:
      'Cardholders need to review charges issued to them, filter by approval status and period, and attach evidence to unvouchered rows.',
    planner: 'Taehyuk Park',
    difficulty: 3,
    prdStatus: { label: 'PRD final', tone: 'green' },
    status: 'In progress',
    harnessId: 'harness-lc-seoul',
    sessionId: 'sess-1042',
    acceptanceCriteria: [
      'Status tabs show live counts and filter the table',
      'Date range defaults to the current settlement period',
      'Amounts render from minor units with no float arithmetic',
      'Rows the user may not see are filtered server-side, not hidden in the UI',
    ],
    targetScreens: [{ name: 'Trip plan list', screenId: 'scr-trip-list' }],
    handedOverAt: '2026-07-29',
  },
  {
    id: 'req-trip-budget',
    title: 'Trip plan budget balance display',
    summary:
      'Show the remaining cost-centre budget on the trip plan editor so travellers see the impact before submitting.',
    planner: 'hong67',
    difficulty: 2,
    prdStatus: { label: 'PRD final', tone: 'green' },
    status: 'Done',
    harnessId: 'harness-hd-shipbuilding',
    sessionId: 'sess-1038',
    acceptanceCriteria: [
      'Balance reads the cost centre for the correct fiscal quarter',
      'A zero balance renders explicitly rather than as an empty value',
      'Cost-centre code is validated against the master before persist',
    ],
    targetScreens: [
      { name: 'Editor with balance', screenId: 'scr-budget-editor' },
      { name: 'Zero-balance state', screenId: 'scr-budget-zero' },
    ],
    handedOverAt: '2026-07-28',
  },
  {
    id: 'req-classifier-pipeline',
    title: 'AI transaction classifier pipeline',
    summary:
      'Wire the classifier testbed end to end so a batch of transactions is categorised against the group accounting chart.',
    planner: 'Taehyuk Park',
    difficulty: 4,
    prdStatus: { label: 'PRD draft', tone: 'slate' },
    status: 'On hold',
    harnessId: 'harness-ai-rnd',
    sessionId: 'sess-1051',
    acceptanceCriteria: [
      'Rule precedence is declared in data, never hard-coded',
      'Ambiguous transactions fall through to human review',
      'Golden-set accuracy does not regress',
    ],
    targetScreens: [
      { name: 'Pipeline run', screenId: 'scr-cls-run' },
      { name: 'Rule precedence', screenId: 'scr-cls-rules' },
    ],
    handedOverAt: '2026-07-27',
  },
  {
    id: 'req-settlement-balance',
    title: 'Trip settlement budget balance display',
    summary:
      'Mirror the trip-plan balance on the settlement editor, including the case where settlement exceeds the original plan.',
    planner: 'hong67',
    difficulty: 2,
    prdStatus: { label: 'PRD final', tone: 'green' },
    status: 'Requested',
    harnessId: 'harness-hd-shipbuilding',
    acceptanceCriteria: [
      'Over-budget settlements are flagged, not blocked',
      'Balance is read at settlement date, not plan date',
      'Includes a zero-balance test case',
    ],
    targetScreens: [
      { name: 'Settlement editor', screenId: 'scr-settle-editor' },
      { name: 'Settlement list', screenId: 'scr-settle-list' },
    ],
    handedOverAt: '2026-07-30',
  },
  {
    id: 'req-temp-storage-search',
    title: 'Temp storage search area',
    summary:
      'Add a trip-plan search area above the temp storage list so drafters can find parked documents.',
    planner: 'hong67',
    difficulty: 1,
    prdStatus: { label: 'PRD final', tone: 'green' },
    status: 'Requested',
    harnessId: 'harness-hd-shipbuilding',
    acceptanceCriteria: [
      'Search filters without a full page reload',
      'Empty results show an explicit empty state',
    ],
    targetScreens: [{ name: 'Search area variant', screenId: 'scr-temp-search' }],
    handedOverAt: '2026-07-30',
  },
  {
    id: 'req-voucher-expiry',
    title: 'Voucher expiry warning banner',
    summary:
      'Warn holders when a regional voucher is within 60 days of expiry, using the region policy rather than a global rule.',
    planner: 'Seongmin Yoo',
    difficulty: 3,
    prdStatus: { label: 'PRD final', tone: 'green' },
    status: 'Requested',
    harnessId: 'harness-lc-seoul',
    acceptanceCriteria: [
      'Threshold comes from regional policy, not a constant',
      'Banner is dismissible and does not reappear in the same session',
      'Expired vouchers are visually distinct from expiring ones',
    ],
    targetScreens: [{ name: 'Main dashboard', screenId: 'scr-dash-main' }],
    handedOverAt: '2026-07-30',
  },
  {
    id: 'req-review-queue',
    title: 'Human review queue for ambiguous transactions',
    summary:
      'Give reviewers a queue of transactions the classifier could not resolve, with the competing rules shown side by side.',
    planner: 'Juhee Yeon',
    difficulty: 4,
    prdStatus: { label: 'PRD draft', tone: 'slate' },
    status: 'Requested',
    harnessId: 'harness-ai-rnd',
    acceptanceCriteria: [
      'Shows every rule that matched and why it did',
      'A reviewer decision is recorded as labelled training data',
      'No customer transaction records appear in fixtures',
    ],
    targetScreens: [{ name: 'Human review queue', screenId: 'scr-cls-review' }],
    handedOverAt: '2026-07-30',
  },
];
