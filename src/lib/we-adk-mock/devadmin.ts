/** Static mock data for the DevAdmin dashboards — mock data only, no API. */
import { type Chip } from './types';

export const USAGE_STATS = {
  totalTokens: '26.8M',
  totalTokensHint: '+1.4M vs. yesterday',
  ioTokens: '9.5M / 17.4M',
  ioHint: 'Input / output ratio · output share 64.8%',
  activeUsers: 6,
  activeUsersHint: '6 total · 3 groups',
  estimatedCost: '$2,539.93',
  estimatedCostHint: '$94.62 per 1M tokens',
};

export const SECURITY_SUMMARY = {
  highRisk: 83,
  needsReview: 107,
  medium: 24,
  low: 0,
};

export const TOKEN_TREND = [
  { date: '7/1', input: 1.1, output: 1.6, total: 2.7 },
  { date: '7/3', input: 1.3, output: 2.0, total: 3.3 },
  { date: '7/5', input: 1.0, output: 1.4, total: 2.4 },
  { date: '7/7', input: 1.6, output: 2.2, total: 3.8 },
  { date: '7/9', input: 1.2, output: 1.8, total: 3.0 },
  { date: '7/11', input: 0.9, output: 1.3, total: 2.2 },
  { date: '7/13', input: 1.1, output: 1.5, total: 2.6 },
  { date: '7/15', input: 1.4, output: 1.9, total: 3.3 },
  { date: '7/17', input: 1.0, output: 1.4, total: 2.4 },
  { date: '7/19', input: 1.3, output: 1.9, total: 3.2 },
  { date: '7/21', input: 3.2, output: 6.8, total: 10.0 },
  { date: '7/23', input: 1.4, output: 2.1, total: 3.5 },
  { date: '7/25', input: 2.6, output: 5.4, total: 8.0 },
  { date: '7/27', input: 1.5, output: 2.2, total: 3.7 },
  { date: '7/29', input: 1.2, output: 1.7, total: 2.9 },
  { date: '7/31', input: 1.0, output: 1.5, total: 2.5 },
];

export const MODEL_BREAKDOWN = [
  { model: 'Opus', tokens: 20.5, share: 76.3, color: '#059669' },
  { model: 'Sonnet', tokens: 5.1, share: 19.0, color: '#3b82f6' },
  { model: 'Haiku', tokens: 0.76, share: 2.8, color: '#f59e0b' },
  { model: 'claude-fable-5', tokens: 0.52, share: 1.0, color: '#a855f7' },
];

export interface GroupUsage {
  group: string;
  tokens: string;
  share: number;
  input: string;
  output: string;
  sessions: number;
  users: number;
  cost: string;
}

export const GROUP_USAGE: GroupUsage[] = [
  {
    group: 'LocalCurrency_Seoul',
    tokens: '9M',
    share: 33.6,
    input: '4.9M',
    output: '4.1M',
    sessions: 31,
    users: 5,
    cost: '$449.13',
  },
  {
    group: 'AI R&D',
    tokens: '8.4M',
    share: 31.1,
    input: '1.3M',
    output: '7.1M',
    sessions: 87,
    users: 3,
    cost: '$1,069.80',
  },
  {
    group: 'LocalCurrency_Jeju/Iksan',
    tokens: '6.5M',
    share: 24.1,
    input: '2.5M',
    output: '4M',
    sessions: 36,
    users: 4,
    cost: '$791.17',
  },
  {
    group: 'Uncategorized',
    tokens: '3M',
    share: 11.2,
    input: '793.5K',
    output: '2.2M',
    sessions: 31,
    users: 5,
    cost: '$229.83',
  },
];

export const HEATMAP_GROUPS = [
  'LocalCurrency_Seoul',
  'AI R&D',
  'LocalCurrency_Jeju/Iksan',
  'Uncategorized',
];
export const HEATMAP_ROWS: { user: string; values: (number | null)[] }[] = [
  { user: 'Ahyeon Lee', values: [4.9, null, 2.4, 0.36] },
  { user: 'Kihoon Kim', values: [1.0, 4.2, null, 0.04] },
  { user: 'Byungju Lee', values: [null, 3.7, null, 0.61] },
  { user: 'Jimin Hong', values: [0.96, null, 1.8, 1.4] },
  { user: 'Chanjung Bae', values: [1.5, null, 0.54, 0.59] },
];

export interface TopUser {
  rank: number;
  name: string;
  cost: string;
  costShare: number;
  tokens: string;
  sparkline: number[];
}

export const TOP_USERS: TopUser[] = [
  {
    rank: 1,
    name: 'Ahyeon Lee',
    cost: '',
    costShare: 92,
    tokens: '7.6M',
    sparkline: [3, 5, 4, 7, 6, 8, 6],
  },
  {
    rank: 2,
    name: 'Kihoon Kim',
    cost: '',
    costShare: 74,
    tokens: '5.6M',
    sparkline: [2, 3, 5, 4, 6, 5, 7],
  },
  {
    rank: 3,
    name: 'Byungju Lee',
    cost: '',
    costShare: 58,
    tokens: '4.3M',
    sparkline: [4, 3, 4, 5, 4, 6, 5],
  },
  {
    rank: 4,
    name: 'Jimin Hong',
    cost: '',
    costShare: 56,
    tokens: '4.2M',
    sparkline: [1, 2, 2, 3, 4, 4, 5],
  },
  {
    rank: 5,
    name: 'Chanjung Bae',
    cost: '',
    costShare: 34,
    tokens: '2.6M',
    sparkline: [3, 2, 3, 2, 3, 2, 3],
  },
];

/* ------------------------------------------------------------------ */
/* Analysis                                                             */
/* ------------------------------------------------------------------ */

export interface GroupCompareRow {
  group: string;
  projects: number;
  users: number;
  cost: string;
  tokens: string;
  sessions: number;
  share: number;
}

export const GROUP_COMPARE: GroupCompareRow[] = [
  {
    group: 'AI R&D',
    projects: 2,
    users: 3,
    cost: '$1,073.47',
    tokens: '8.4M',
    sessions: 88,
    share: 43.7,
  },
  {
    group: 'LocalCurrency_Jeju/Iksan',
    projects: 7,
    users: 4,
    cost: '$904.40',
    tokens: '6.9M',
    sessions: 36,
    share: 36.8,
  },
  {
    group: 'LocalCurrency_Seoul',
    projects: 2,
    users: 5,
    cost: '$478.12',
    tokens: '9.7M',
    sessions: 32,
    share: 19.5,
  },
];

export const SELECTED_GROUP_DETAIL = {
  group: 'LocalCurrency_Jeju/Iksan',
  projects: 7,
  users: 4,
  cost: '$904.40',
  tokens: '6.9M',
  activeUsers: 4,
  sessions: 36,
  modelMix: [
    { model: 'Opus', share: 75.9 },
    { model: 'Sonnet', share: 19.5 },
    { model: 'Haiku', share: 3.4 },
    { model: 'claude-fable-5', share: 1.1 },
  ],
};

export const COST_TREND = [
  { date: '7/1', current: 20, previous: 15 },
  { date: '7/5', current: 35, previous: 20 },
  { date: '7/9', current: 25, previous: 30 },
  { date: '7/13', current: 40, previous: 25 },
  { date: '7/17', current: 30, previous: 35 },
  { date: '7/21', current: 90, previous: 40 },
  { date: '7/23', current: 300, previous: 50 },
  { date: '7/25', current: 280, previous: 45 },
  { date: '7/27', current: 60, previous: 55 },
  { date: '7/31', current: 40, previous: 60 },
];

/* ------------------------------------------------------------------ */
/* Coaching / user insight                                              */
/* ------------------------------------------------------------------ */

export const USER_INSIGHT = {
  user: 'Kihoon Kim',
  stats: { totalSessions: 96, editSessions: 29, editedFiles: 309, filesPerEditSession: 10.7 },
  sessionCharacter: [
    { label: 'Analysis chat', count: 62, share: 66.6 },
    { label: 'Coding & implementation', count: 27, share: 28.1 },
    { label: 'Design docs', count: 7, share: 7.3 },
  ],
  workArea: [
    { ext: '.java', count: 105, share: 34.0 },
    { ext: '.md', count: 101, share: 32.7 },
    { ext: '.sh', count: 25, share: 8.1 },
    { ext: '.html', count: 20, share: 6.5 },
    { ext: '.xml', count: 14, share: 4.5 },
    { ext: '.sql', count: 7, share: 2.3 },
    { ext: '.css', count: 5, share: 1.6 },
    { ext: '.ts', count: 5, share: 1.6 },
  ],
  skillUsage: [
    { label: '/code-review', count: 9, share: 33.3 },
    { label: '/git', count: 4, share: 14.8 },
    { label: '/develop', count: 2, share: 7.4 },
    { label: '/secrets-guard', count: 2, share: 7.4 },
    { label: '/superpowers:brainstorming', count: 2, share: 7.4 },
    { label: '/we-update', count: 2, share: 7.4 },
    { label: '/command-center', count: 1, share: 3.7 },
    { label: '/dev-interview', count: 1, share: 3.7 },
  ],
  subagentDelegation: [
    { label: 'general-purpose', count: 10, share: 32.3 },
    { label: 'code-reviewer', count: 8, share: 25.8 },
    { label: 'Explore', count: 6, share: 19.4 },
    { label: 'code-investigator', count: 1, share: 3.2 },
    { label: 'db-meta-manager', count: 1, share: 3.2 },
    { label: 'dev-backend', count: 1, share: 3.2 },
    { label: 'dev-planner', count: 1, share: 3.2 },
    { label: 'plan-auditor', count: 1, share: 3.2 },
  ],
};

export const AI_USAGE_SCORE = {
  score: 70,
  band: 'Established stage',
  metrics: [
    { label: 'Instruction quality', value: 4.1, max: 5 },
    { label: 'Problem solving', value: 4.2, max: 5 },
    { label: 'Tool utilization', value: 2.9, max: 5 },
    { label: 'Verification habits', value: 3.0, max: 5 },
  ],
  suggestions: [
    {
      quote:
        'Add exclude_path.\nEven for a single config change or an ad hoc iteration, instructions keep being broken down manually with no skill or subagent delegation.',
      advice:
        'When starting work that looks likely to repeat (edit code → test → commit), say something like "verify this with the /code-review skill and handle the commit with the git skill" — pre-assign the key skills so the flow is standardized instead of improvised each time.',
    },
    {
      quote:
        'Hold off on flyway for a bit.\nEven on a compound task (investigate → fix → verify → commit), the whole thing stayed as plain conversation with no subagent or skill delegation.',
      advice:
        'Once you spot a structural pattern like this, delegate root-cause investigation to a subagent and route result verification through the code-review skill — split the work by role instead of directing it all yourself.',
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Security                                                             */
/* ------------------------------------------------------------------ */

export const SECURITY_TABS = [
  { key: 'needsReview', label: 'Needs review', count: 7 },
  { key: 'high', label: 'High risk', count: 7 },
  { key: 'reviewed', label: 'Reviewed', count: 116 },
  { key: 'notAnIssue', label: 'Not an issue', count: 3 },
  { key: 'all', label: 'All', count: 126 },
] as const;

export interface SecurityItem {
  id: string;
  severity: Chip;
  type: Chip;
  target: string;
  reference: string;
  project: string;
}

export const SECURITY_ITEMS: SecurityItem[] = [
  {
    id: '990',
    severity: { label: 'High', tone: 'red' },
    type: { label: 'PII', tone: 'violet' },
    target: 'conversation:630',
    reference: 'Account number (1234567890)',
    project: 'API',
  },
  {
    id: '989',
    severity: { label: 'High', tone: 'red' },
    type: { label: 'PII', tone: 'violet' },
    target: 'conversation:76',
    reference: 'Account number (2392810699)',
    project: 'Unregistered',
  },
  {
    id: '988',
    severity: { label: 'High', tone: 'red' },
    type: { label: 'Sensitive file read', tone: 'amber' },
    target: 'C:\\Users\\user\\workspaces\\dino-workspace\\dino-api\\gateway\\...',
    reference: 'Config file (application.yml) opened (Read/Grep · subagent code-investigator)',
    project: 'Unregistered',
  },
  {
    id: '987',
    severity: { label: 'High', tone: 'red' },
    type: { label: 'PII', tone: 'violet' },
    target: 'command:88',
    reference: 'Account number (26060100000002)',
    project: 'API',
  },
  {
    id: '986',
    severity: { label: 'High', tone: 'red' },
    type: { label: 'PII', tone: 'violet' },
    target: 'command:88',
    reference: 'Account number (26010100000001)',
    project: 'API',
  },
  {
    id: '985',
    severity: { label: 'High', tone: 'red' },
    type: { label: 'Sensitive file read', tone: 'amber' },
    target: 'C:\\WorkSpaces\\SLP\\.we-adk\\composition.yaml',
    reference: 'Config file (application.yml) opened (Read/Grep)',
    project: 'Unregistered',
  },
  {
    id: '984',
    severity: { label: 'High', tone: 'red' },
    type: { label: 'PII', tone: 'violet' },
    target: 'conversation:817',
    reference: 'Account number (26042300000870)',
    project: 'Portal',
  },
];

export const SECURITY_DETAIL = {
  id: '990',
  type: 'sensitive_file_read',
  severity: { label: 'High', tone: 'red' as const },
  status: { label: 'Needs review', tone: 'amber' as const },
  location:
    'C:\\Users\\user\\workspaces\\dino-workspace\\dino-api\\gateway\\src\\main\\resources\\application.yml',
  basis: 'Config file (application.yml)',
  summary: 'File opened (Read/Grep · subagent code-investigator)',
  project: 'Unregistered repository',
  user: 'Kihoon Kim',
  detectedAt: '2026-07-28 12:11 KST',
  session: {
    id: '2903ee62-e0b3-46bf-b5b1-68c97421a498',
    workedAt: '07-28 11:16 → 07-28 13:43',
    branch: 'Unknown',
    repo: '192.168.95.11:5000/dino',
    tag: '/code-review',
  },
};
