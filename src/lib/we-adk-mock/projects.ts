/**
 * Sketcher is organised the way a design tool is — a project is a folder, and a
 * folder holds design files:
 *
 *   Project → folder → design file → canvas
 *
 * Every project carries its own Sketcher: its own meeting folders, where each
 * meeting's notes turn into concept designs, and its own `real-screens` folder
 * holding what that project's live product looks like today. A change request
 * therefore starts from the real screen next to it, not from a blank canvas.
 */
import { loadCreatedProjects } from './created-projects';
import { PRODUCTION_SCREENS, type ProductionScreen, type SolutionName } from './production-screens';
import {
  loadGeneratedScreens,
  type SeedPattern,
  type SketchScreen,
  type SketchSession,
} from './sketches';
import { type Chip, type VersionStatus } from './types';

/** The pipeline a project walks: an idea becomes a brief, then screens. */
export const PROJECT_STAGES = ['Project Brief', 'Summary', 'Design', 'Prototype'] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

/** Tile colour on the project card — deterministic per project, mock data only. */
export type ProjectAccent = 'indigo' | 'violet' | 'green' | 'teal' | 'amber' | 'slate';

/** Whether a customer engagement started a product or added to one already under way. */
export type ProjectLinkKind = 'new-build' | 'feature-improvement';

export interface DesignProject {
  id: string;
  /**
   * Folder name in the project list. On the Customer side that is the customer
   * itself; on the Product side it is the product.
   */
  name: string;
  /** For a product: the customer it is for, by that customer's name. */
  customer: string;
  /** For a customer: what kind of business it is — Bank, Logistics, Retail. */
  companyType?: string;
  owner: string;
  status: Chip;
  updatedAt: string;
  summary: string;
  /** How far this project has got down the pipeline. */
  stage: ProjectStage;
  /** True once the current stage's output is committed to GitLab. */
  saved?: boolean;
  /** Claude spend on this project so far, in USD. */
  spend: number;
  accent: ProjectAccent;
  /** Archived projects are kept for reference, off the Active tab. */
  archived?: boolean;
  /**
   * For a customer project: the id of the product it's for. Set at creation —
   * every customer engagement says up front whether it starts a product or
   * adds to one, rather than leaving that link to a free-text company name.
   */
  relatedProductId?: string;
  /** Whether this engagement started `relatedProductId` or added a feature to it. */
  linkKind?: ProjectLinkKind;
  /** The feature this engagement added, set when `linkKind` is `feature-improvement`. */
  featureArea?: string;
  /** Live solution whose captured screens fill this project's real-screens folder. */
  solution?: SolutionName;
  /** One concept folder per customer meeting. */
  sessions: SketchSession[];
}

export const PROJECTS: DesignProject[] = [];

/* removed: proj-hd-trip, proj-nonghyup-loan, proj-sk-hynix-trip, proj-harim-voucher, proj-voucher-issuing
    name: 'Trip management rollout',
    customer: 'HD Korea Shipbuilding',
    owner: 'Seongmin Yoo (PM)',
    status: { label: 'In delivery', tone: 'blue' },
    updatedAt: '2026-07-27',
    summary:
      'Live trip screens plus the approval-routing rework the travel desk asked for in the July review.',
    stage: 'Design',
    spend: 19.0,
    accent: 'violet',
    solution: 'HD Korea Shipbuilding',
    sessions: [
      {
        id: 'ses-hd-kickoff',
        title: 'Rollout kickoff',
        metAt: '2026-05-19',
        attendees: 'HD travel desk, HD IT (2), Seongmin Yoo, Moka',
        kind: 'Kickoff',
        durationMin: 90,
        notes: [
          'Rolling the Cloud trip screens out to HD, department by department.',
          'Shipbuilding travels in crews, not individuals — that is the whole difference.',
          '- one trip plan often covers 6–12 people going to the same yard',
          '- per-person expenses still settle separately afterwards',
          '- their HR system owns the department tree; we read it, never edit it',
          'IT asked about SSO on day one. Answer: phase 2.',
        ].join('\n'),
        decisions: [
          'A trip plan can carry a crew; settlement stays per person.',
          'Department tree is read-only, sourced from HR.',
          'SSO is phase 2 — username login for the pilot.',
        ],
        openQuestions: ['Which department goes first for the pilot?'],
        screens: [
          {
            id: 'sk-hd-crew-plan',
            name: 'Trip plan — crew of travellers',
            route: '/hd-business-plan/create',
            seedPattern: 'detailPage',
            status: { label: 'Reviewed', tone: 'green' },
            updatedAt: '2026-05-26',
            basedOnRoute: '/hd-business-plan/create',
          },
          {
            id: 'sk-hd-crew-roster',
            name: 'Crew roster picker',
            route: '/hd-business-plan/create/crew',
            seedPattern: 'listPage',
            status: { label: 'In review', tone: 'blue' },
            updatedAt: '2026-06-02',
          },
        ],
      },
      {
        id: 'ses-hd-approval-fix',
        title: 'Approval routing review',
        metAt: '2026-07-26',
        attendees: 'HD travel desk, Seongmin Yoo',
        kind: 'Review',
        durationMin: 60,
        notes: [
          'Walked the pending-approvals screen with the travel desk.',
          'Their complaint is not the screen itself — it shows everything to everyone.',
          '- filter the queue to what the signed-in approver can actually act on',
          '- overseas trips need the second approver visible before the first one signs',
          '- our captured screen is stale (June); the live one already has a department column',
          'They also asked for a printable summary, then agreed it can wait.',
        ].join('\n'),
        decisions: ['Queue is scoped to the signed-in approver.', 'Printable summary is deferred.'],
        openQuestions: ['Do delegated approvers see the delegator's queue as well as their own?'],
        screens: [
          {
            id: 'sk-hd-approvals-scoped',
            name: 'Pending approvals — scoped to me',
            route: '/hd-approval/pending',
            seedPattern: 'listPage',
            status: { label: 'Reviewed', tone: 'green' },
            updatedAt: '2026-07-27',
            basedOnRoute: '/hd-approval/pending',
          },
        ],
      },
      {
        id: 'ses-hd-uat',
        title: 'UAT — first department',
        metAt: '2026-07-30',
        attendees: 'HD travel desk, 8 pilot users, Seongmin Yoo',
        kind: 'UAT',
        durationMin: 150,
        notes: [
          'Eight pilot users, one hour of real trip plans, then questions.',
          'Nobody failed to submit a plan. Two hit the same wall:',
          '- adding a crew member after submitting means starting over',
          '- the approval status wording is unclear ("in approval" vs "pending")',
          'One asked to duplicate last month's trip. Three others nodded.',
          'The travel desk wants the pilot extended by two weeks before the next department.',
        ].join('\n'),
        decisions: [
          'Duplicate-a-trip is in scope for the pilot.',
          'Pilot extended two weeks; second department waits.',
        ],
        openQuestions: [
          'Can a crew member be added after submit without a fresh approval round?',
          'What wording replaces "in approval"?',
        ],
        screens: [
          {
            id: 'sk-hd-duplicate-trip',
            name: 'Duplicate last trip',
            route: '/hd-business-plan/duplicate',
            seedPattern: 'detailPage',
            status: { label: 'Draft', tone: 'slate' },
            updatedAt: '2026-07-31',
          },
        ],
      },
    ],
  },
  {
    id: 'proj-nonghyup-loan',
    archived: true,
    name: 'Mobile loan onboarding',
    customer: 'NongHyup',
    owner: 'Moka (PL)',
    status: { label: 'In discussion', tone: 'blue' },
    updatedAt: '2026-07-30',
    summary:
      'Greenfield concept work — nothing is live yet, so every design in here starts from a customer meeting.',
    stage: 'Design',
    saved: true,
    spend: 6.56,
    accent: 'green',
    sessions: [
      {
        id: 'ses-nh-kickoff',
        title: 'Kickoff call',
        metAt: '2026-07-14',
        attendees: 'NongHyup digital team, Moka, Taehyuk Park',
        kind: 'Kickoff',
        durationMin: 75,
        decisions: [
          'No chatbot. A human callback button instead.',
          'Khmer and English at launch; Korean later.',
        ],
        openQuestions: ['Is repayment simulation needed before submitting?'],
        notes: [
          'Customer wants migrant workers to apply for a small business loan from the phone.',
          'They kept coming back to three things:',
          '- applicants abandon at the document upload step, so show progress and what is still missing',
          '- loan products must be comparable side by side before applying (rate, term, limit)',
          '- Khmer and English both required; Korean is secondary for this segment',
          'They did NOT want a chatbot. They asked twice for a human callback button instead.',
          'Open question: do they need repayment simulation before submitting? Park thinks yes.',
        ].join('\n'),
        screens: [
          {
            id: 'sk-nh-products',
            name: 'Loan product comparison',
            route: '/loan/products',
            seedPattern: 'listPage',
            status: { label: 'Reviewed', tone: 'green' },
            updatedAt: '2026-07-16',
          },
          {
            id: 'sk-nh-apply',
            name: 'Application form',
            route: '/loan/apply',
            seedPattern: 'detailPage',
            status: { label: 'Reviewed', tone: 'green' },
            updatedAt: '2026-07-16',
          },
          {
            id: 'sk-nh-docs',
            name: 'Document checklist',
            route: '/loan/apply/documents',
            seedPattern: 'listPage',
            status: { label: 'Needs rework', tone: 'amber' },
            updatedAt: '2026-07-15',
          },
        ],
      },
      {
        id: 'ses-nh-followup',
        title: 'Follow-up — document step',
        metAt: '2026-07-22',
        attendees: 'NongHyup digital team, Moka',
        kind: 'Follow-up',
        durationMin: 45,
        decisions: [
          'Document checklist splits: mandatory first, optional after.',
          'Repayment simulation is in — but only once documents pass.',
        ],
        openQuestions: ['How long can a half-finished application sit before it expires?'],
        notes: [
          'Walked through the document checklist mockup. Verdict: too much at once.',
          'They want it split — mandatory documents first, optional later.',
          'Confirmed repayment simulation IS needed, but only after documents pass.',
          'New ask: a status screen the applicant can return to, showing where the application sits.',
        ].join('\n'),
        screens: [
          {
            id: 'sk-nh-docs-split',
            name: 'Document checklist (split)',
            route: '/loan/apply/documents',
            seedPattern: 'listPage',
            status: { label: 'In review', tone: 'blue' },
            updatedAt: '2026-07-23',
            variantOf: 'sk-nh-docs',
          },
          {
            id: 'sk-nh-status',
            name: 'Application status',
            route: '/loan/status',
            seedPattern: 'dashboard',
            status: { label: 'Draft', tone: 'slate' },
            updatedAt: '2026-07-23',
          },
        ],
      },
      {
        id: 'ses-nh-compliance',
        title: 'Compliance & KYC review',
        metAt: '2026-07-29',
        attendees: 'NongHyup compliance (2), NongHyup digital team, Moka',
        kind: 'Review',
        durationMin: 90,
        notes: [
          'Compliance joined for the first time and moved the goalposts, politely.',
          '- identity check must happen before any product comparison is shown',
          '- consent for credit enquiry is a separate, explicit step — not a checkbox in the form',
          '- every document upload needs a retention notice in the applicant's language',
          'They were relaxed about the callback button, strict about consent wording.',
          'Legal will send the exact consent text next week; do not invent it.',
        ].join('\n'),
        decisions: [
          'Identity check comes before product comparison.',
          'Credit-enquiry consent is its own step with its own screen.',
        ],
        openQuestions: [
          'Exact consent wording — legal is sending it.',
          'Does a failed identity check block re-application, or just pause it?',
        ],
        screens: [
          {
            id: 'sk-nh-identity',
            name: 'Identity check',
            route: '/loan/identity',
            seedPattern: 'detailPage',
            status: { label: 'In review', tone: 'blue' },
            updatedAt: '2026-07-30',
          },
          {
            id: 'sk-nh-consent',
            name: 'Credit enquiry consent',
            route: '/loan/consent',
            seedPattern: 'detailPage',
            status: { label: 'Blocked on legal', tone: 'amber' },
            updatedAt: '2026-07-30',
          },
          {
            id: 'sk-nh-retention',
            name: 'Document retention notice',
            route: '/loan/apply/documents/notice',
            seedPattern: 'detailPage',
            status: { label: 'Draft', tone: 'slate' },
            updatedAt: '2026-07-30',
          },
        ],
      },
    ],
  },
  {
    id: 'proj-sk-hynix-trip',
    archived: true,
    name: 'Trip management proposal',
    customer: 'SK Hynix',
    owner: 'Seongmin Yoo (PM)',
    status: { label: 'Proposal', tone: 'violet' },
    updatedAt: '2026-07-28',
    summary:
      'Pre-contract proposal. Nothing captured from a live system yet — the HD project next door is the closest reference.',
    stage: 'Summary',
    spend: 0.05,
    accent: 'teal',
    sessions: [
      {
        id: 'ses-sk-scoping',
        title: 'Scoping workshop',
        metAt: '2026-07-24',
        attendees: 'SK Hynix travel desk, Seongmin Yoo',
        kind: 'Workshop',
        durationMin: 120,
        notes: [
          'Their pain is approval routing, not the form itself.',
          'Overseas trips need two approvers; domestic needs one. Today this is manual.',
          'They want to see pending approvals at a glance, per department.',
          'Budget visibility came up but is lower priority than routing.',
        ].join('\n'),
        decisions: [
          'Two approvers for overseas, one for domestic.',
          'Budget visibility is out of the first phase.',
        ],
        openQuestions: ['How many departments in phase one?'],
        screens: [
          {
            id: 'sk-hx-approvals',
            name: 'Approval queue',
            route: '/trip/approvals',
            seedPattern: 'listPage',
            status: { label: 'Reviewed', tone: 'green' },
            updatedAt: '2026-07-26',
          },
          {
            id: 'sk-hx-routing',
            name: 'Routing rules',
            route: '/trip/settings/routing',
            seedPattern: 'detailPage',
            status: { label: 'Draft', tone: 'slate' },
            updatedAt: '2026-07-26',
          },
        ],
      },
      {
        id: 'ses-sk-proposal-walkthrough',
        title: 'Proposal walkthrough',
        metAt: '2026-07-28',
        attendees: 'SK Hynix travel desk, SK Hynix purchasing, Seongmin Yoo, 설욱환',
        kind: 'Review',
        durationMin: 60,
        notes: [
          'Showed the two concept screens plus the HD project as evidence we have done this.',
          'Purchasing joined uninvited and asked about licence counting, not screens.',
          'Travel desk liked the queue; wants delegation ("I am on leave, route to my deputy").',
          'They will not sign before the September budget cycle. Nothing to build yet.',
          'Asked for the proposal deck to include the HD rollout timeline as a reference.',
        ].join('\n'),
        decisions: ['Delegation is in the proposal scope.'],
        openQuestions: [
          'Licence counting model — purchasing wants per-department, we quoted per-seat.',
          'Signature waits for the September budget cycle.',
        ],
        screens: [
          {
            id: 'sk-hx-delegation',
            name: 'Approver delegation',
            route: '/trip/settings/delegation',
            seedPattern: 'detailPage',
            status: { label: 'Draft', tone: 'slate' },
            updatedAt: '2026-07-28',
          },
        ],
      },
    ],
  },
  {
    id: 'proj-harim-voucher',
    archived: true,
    name: 'Regional voucher pilot',
    customer: 'Harim',
    owner: 'Moka (PL)',
    status: { label: 'Early', tone: 'slate' },
    updatedAt: '2026-07-19',
    summary:
      'Early pilot. The voucher screens already running for Harim sit alongside the first concept sketches.',
    stage: 'Project Brief',
    spend: 0,
    accent: 'amber',
    solution: 'Harim',
    sessions: [
      {
        id: 'ses-hr-intro',
        title: 'Intro meeting',
        metAt: '2026-07-18',
        attendees: 'Harim planning, Moka',
        kind: 'Kickoff',
        durationMin: 40,
        notes: [
          'Very early. They mostly asked questions rather than giving requirements.',
          'Interested in merchant-side redemption, not consumer-side issuing.',
          'Asked what expiry handling looks like — no decision yet.',
        ].join('\n'),
        decisions: ['Merchant-side redemption first; issuing is not in scope.'],
        openQuestions: ['What happens to an expired voucher — refund, lapse, or extend?'],
        screens: [
          {
            id: 'sk-hr-redeem',
            name: 'Merchant redemption',
            route: '/voucher/redeem',
            seedPattern: 'detailPage',
            status: { label: 'Draft', tone: 'slate' },
            updatedAt: '2026-07-19',
          },
        ],
      },
      {
        id: 'ses-hr-merchant-interviews',
        title: 'Merchant interviews (3 shops)',
        metAt: '2026-07-19',
        attendees: 'Three merchants, Harim planning, Moka',
        kind: 'Interviews',
        durationMin: 180,
        notes: [
          'Visited three shops in one afternoon. Very different from the planning meeting.',
          'Shop 1 (butcher): phone stays in the back, redemption happens at the till. Wants a fixed tablet.',
          'Shop 2 (small grocer): one owner, no staff — anything with a login is friction.',
          'Shop 3 (bakery, 4 staff): needs to know which staff member redeemed what.',
          'All three asked the same first question: "when do I get the money?".',
          'None of them cared about the voucher balance screen the BU asked for.',
        ].join('\n'),
        decisions: [
          'Settlement timing must be visible on the redemption screen itself.',
          'Per-staff attribution is needed where a shop has staff.',
        ],
        openQuestions: [
          'One device per shop or per staff member?',
          'Is a login acceptable for a single-owner shop, or does it need a PIN?',
        ],
        screens: [
          {
            id: 'sk-hr-till-redeem',
            name: 'Till redemption (tablet)',
            route: '/voucher/redeem/till',
            seedPattern: 'detailPage',
            status: { label: 'In review', tone: 'blue' },
            updatedAt: '2026-07-20',
          },
          {
            id: 'sk-hr-settlement',
            name: 'When do I get paid',
            route: '/voucher/settlement',
            seedPattern: 'dashboard',
            status: { label: 'Draft', tone: 'slate' },
            updatedAt: '2026-07-20',
          },
        ],
      },
    ],
  },
  {
    id: 'proj-voucher-issuing',
    archived: true,
    name: 'Voucher issuing pilot',
    customer: 'Local Currency BU',
    owner: 'Moka (PL)',
    status: { label: 'Closed', tone: 'slate' },
    updatedAt: '2026-03-12',
    summary:
      'Closed pilot, kept for reference: the consumer-side issuing flow the Harim project decided not to build.',
    stage: 'Design',
    saved: true,
    spend: 12.4,
    accent: 'slate',
    archived: true,
    sessions: [
      {
        id: 'ses-vi-review',
        title: 'Pilot close-out review',
        metAt: '2026-03-10',
        attendees: 'Local Currency BU, Moka',
        kind: 'Close-out',
        durationMin: 60,
        decisions: [
          'Consumer-side issuing parked; merchant-side comes first.',
          'Keep the batch issuing screen for reuse.',
        ],
        openQuestions: ['Expiry handling — still undecided when the pilot closed.'],
        notes: [
          'Consumer-side issuing is parked — the BU wants merchant-side first.',
          'Keep the batch issuing screen: the same idea came back in the Harim conversation.',
          'Expiry handling was never decided here either.',
        ].join('\n'),
        screens: [
          {
            id: 'sk-vi-issue',
            name: 'Issue voucher to citizen',
            route: '/voucher/issue',
            seedPattern: 'detailPage',
            status: { label: 'Parked', tone: 'slate' },
            updatedAt: '2026-03-11',
          },
          {
            id: 'sk-vi-batch',
            name: 'Batch issuing',
            route: '/voucher/issue/batch',
            seedPattern: 'listPage',
            status: { label: 'Parked', tone: 'slate' },
            updatedAt: '2026-03-11',
          },
        ],
      },
    ],
  },
*/

/* ------------------------------------------------------------------ */
/* Project lookups                                                     */
/* ------------------------------------------------------------------ */

/**
 * A project by id, seeded or created.
 *
 * Created projects live in storage, so this answers seeds-only during a server
 * render and finds everything once there is a browser. Callers already handle a
 * null — a project id that matches nothing is an ordinary 404 here — and every
 * one of them gets created projects for free by going through this door.
 */
export function findProject(projectId: string): DesignProject | null {
  const seeded = PROJECTS.find((entry) => entry.id === projectId);
  if (seeded) return seeded;
  return loadCreatedProjects().find((entry) => entry.id === projectId) ?? null;
}

/**
 * The two workspaces a project is filed in: work done for a customer, and the
 * products we own.
 *
 * Keyed on `archived` because that is the field the store has always used, and
 * renaming it would orphan every project already filed under the old value.
 * The mapping lives here so the home page's tabs and a project's back link
 * cannot drift into disagreeing about which list a project belongs to.
 */
export type ProjectWorkspace = 'customer' | 'product';

export const WORKSPACE_LABEL: Record<ProjectWorkspace, string> = {
  customer: 'Customer',
  product: 'Product',
};

export function projectWorkspace(project: DesignProject): ProjectWorkspace {
  return project.archived === true ? 'customer' : 'product';
}

/**
 * Whether this id is one of the samples that ship with the mockup.
 *
 * The seeded projects carry demo content that only makes sense as a
 * demonstration — QA test cases about a login screen, past test runs, meetings
 * that were held. A project someone creates here starts with none of it, and
 * every module holding that kind of seed asks this before handing it over.
 * Deliberately not "is it in storage": an unknown id is not a sample either,
 * and answering from the bundle keeps this usable during a server render.
 */
export function isSeededProject(projectId: string): boolean {
  return PROJECTS.some((entry) => entry.id === projectId);
}

/** Initial shown on the project's card tile. */
export function projectInitial(project: DesignProject): string {
  const first = project.name.trim()[0] ?? '?';
  // Keep two characters for bracketed Korean names, one otherwise.
  return project.name.startsWith('[') ? project.name.slice(1, 3) : first.toUpperCase();
}

/** How far along the pipeline a project is, 1-based. */
export function stageIndex(stage: ProjectStage): number {
  return PROJECT_STAGES.indexOf(stage) + 1;
}

/**
 * "1 day ago" / "2 weeks ago", both dates as `YYYY-MM-DD`. The caller passes
 * today explicitly so server and client render the same string.
 */
export function relativeUpdated(updatedAt: string, today: string): string {
  const days = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${updatedAt}T00:00:00Z`)) / 86_400_000,
  );
  if (!Number.isFinite(days) || days < 0) return `on ${updatedAt}`;
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

/** Which project owns a live solution's screens. */
export function projectForSolution(solution: SolutionName): DesignProject | null {
  return PROJECTS.find((entry) => entry.solution === solution) ?? null;
}

/** Concept screens seeded into a project (excludes files the user created). */
export function projectSketchScreens(project: DesignProject): SketchScreen[] {
  return project.sessions.flatMap((session) => session.screens);
}

/** The live screens captured for this project. */
export function projectRealScreens(project: DesignProject): ProductionScreen[] {
  if (!project.solution) return [];
  return PRODUCTION_SCREENS.filter((entry) => entry.solution === project.solution);
}

/* ------------------------------------------------------------------ */
/* Folders & design files                                             */
/* ------------------------------------------------------------------ */

/** Folder id of the real-screens folder every project has. */
export const REAL_FOLDER_ID = 'real-screens';

/** Folder id of the consolidated design-phase screen set. */
export const DESIGN_FOLDER_ID = 'design-phase';

/**
 * Storage key for the design-phase folder. Design files are keyed by the folder
 * they live in; concept folders use the meeting id, so this needs its own.
 */
export function designFolderKey(projectId: string): string {
  return `design:${projectId}`;
}

export type DesignFileKind =
  'concept' | 'variant' | 'generated' | 'copied' | 'blank' | 'real' | 'prototype';

export const FILE_KIND_LABELS: Record<DesignFileKind, string> = {
  concept: 'Concept',
  variant: 'Variant',
  generated: 'From notes',
  copied: 'Live copy',
  blank: 'New',
  real: 'Real screen',
  prototype: 'HTML',
};

export interface DesignFile {
  /** Canvas id — the same id the editor opens. */
  id: string;
  /** File name as it reads in the list, e.g. `loan-product-comparison.design`. */
  fileName: string;
  name: string;
  route?: string;
  seedPattern: SeedPattern;
  status: Chip;
  updatedAt: string;
  kind: DesignFileKind;
  folderId: string;
  folderLabel: string;
  /** Name of the design this one is an alternative of. */
  variantOfName?: string;
  /** Live route this design was copied from or revises. */
  basedOnRoute?: string;
  /** Concept folders only — the meeting that owns the file. */
  sessionId?: string;
  /** Files the user created can be deleted; seeded ones cannot. */
  removable: boolean;
}

export interface DesignFolder {
  /**
   * Session id for concept folders, REAL_FOLDER_ID for the live screens,
   * DESIGN_FOLDER_ID for the consolidated design-phase set, `version-N` for the
   * Business explorer's version folders.
   */
  id: string;
  /** Folder name in the tree, e.g. `01-kickoff-call`. */
  name: string;
  /** Human label, e.g. `Kickoff call · 2026-07-14`. */
  label: string;
  kind: 'concept' | 'real' | 'design' | 'version' | 'group';
  /** Present on concept folders — the meeting whose notes fill this folder. */
  session?: SketchSession;
  /**
   * Workspace-state key holding the files a user created here. Absent on folders
   * nothing can be created in, like real-screens.
   */
  storageKey?: string;
  /** Version folders only — 1 is the baseline, later numbers are iterations. */
  versionNumber?: number;
  /** Version folders only — released, or still being worked on. */
  versionStatus?: VersionStatus;
  /** Folders inside this one. A version can be organised into groups. */
  children?: DesignFolder[];
  files: DesignFile[];
}

function slug(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return cleaned || 'design';
}

export function designFileName(name: string, kind: DesignFileKind): string {
  return `${slug(name)}.${kind === 'real' ? 'screen' : 'design'}`;
}

function screenKind(screen: SketchScreen): DesignFileKind {
  if (screen.origin === 'generated') return 'generated';
  if (screen.origin === 'copied') return 'copied';
  if (screen.origin === 'blank') return 'blank';
  return screen.variantOf ? 'variant' : 'concept';
}

/**
 * A design file as it reads inside a folder. The same screen can appear in more
 * than one folder view — a meeting folder and the version tree, say — so the
 * folder it is being listed under is passed in rather than derived.
 */
export function designFileFromScreen(
  screen: SketchScreen,
  folder: { id: string; label: string; storageKey?: string },
  variantOfName?: string,
): DesignFile {
  const kind = screenKind(screen);
  return {
    id: screen.id,
    fileName: designFileName(screen.name, kind),
    name: screen.name,
    route: screen.route,
    seedPattern: screen.seedPattern,
    status: screen.status,
    updatedAt: screen.updatedAt,
    kind,
    folderId: folder.id,
    folderLabel: folder.label,
    variantOfName,
    basedOnRoute: screen.basedOnRoute,
    sessionId: folder.storageKey,
    removable: screen.generated === true,
  };
}

/**
 * Every folder in a project, with its files.
 *
 * `created` holds the files the user made, keyed by folder (session) id — the
 * caller reads those from workspace state after mount, so this stays renderable on
 * the server.
 */
export function projectFolders(
  project: DesignProject,
  created: Record<string, SketchScreen[]> = {},
): DesignFolder[] {
  const nameById = new Map(
    projectSketchScreens(project).map((screen) => [screen.id, screen.name] as const),
  );

  const conceptFolders = project.sessions.map<DesignFolder>((session, index) => {
    const label = `${session.title} · ${session.metAt}`;
    const target = { id: session.id, label, storageKey: session.id };
    const toFile = (screen: SketchScreen): DesignFile =>
      designFileFromScreen(
        screen,
        target,
        screen.variantOf ? nameById.get(screen.variantOf) : undefined,
      );

    return {
      id: session.id,
      name: `${String(index + 1).padStart(2, '0')}-${slug(session.title)}`,
      label,
      kind: 'concept',
      session,
      storageKey: session.id,
      files: [...session.screens.map(toFile), ...(created[session.id] ?? []).map(toFile)],
    };
  });

  const designFiles = created[designFolderKey(project.id)] ?? [];
  const designFolder: DesignFolder = {
    id: DESIGN_FOLDER_ID,
    name: 'design-phase',
    label: 'Consolidated design set',
    kind: 'design',
    storageKey: designFolderKey(project.id),
    files: designFiles.map<DesignFile>((screen) => ({
      id: screen.id,
      fileName: designFileName(screen.name, 'generated'),
      name: screen.name,
      route: screen.route,
      seedPattern: screen.seedPattern,
      status: screen.status,
      updatedAt: screen.updatedAt,
      kind: 'generated',
      folderId: DESIGN_FOLDER_ID,
      folderLabel: 'Consolidated design set',
      basedOnRoute: screen.basedOnRoute,
      sessionId: designFolderKey(project.id),
      removable: true,
    })),
  };

  const realLabel = project.solution ? `Real screens · ${project.solution}` : 'Real screens';
  const realFolder: DesignFolder = {
    id: REAL_FOLDER_ID,
    name: 'real-screens',
    label: realLabel,
    kind: 'real',
    files: projectRealScreens(project).map<DesignFile>((screen) => ({
      id: screen.id,
      fileName: designFileName(screen.path.split('>').pop()?.trim() ?? screen.path, 'real'),
      name: screen.path,
      route: screen.route,
      seedPattern: screen.seedPattern,
      status: screen.status,
      updatedAt: screen.capturedAt,
      kind: 'real',
      folderId: REAL_FOLDER_ID,
      folderLabel: realLabel,
      removable: false,
    })),
  };

  return [...conceptFolders, ...(designFiles.length > 0 ? [designFolder] : []), realFolder];
}

export function folderFiles(folders: DesignFolder[], folderId: string | null): DesignFile[] {
  // A folder can hold folders, so both the "everything" case and a version's
  // own listing reach one level deeper.
  const flat = folders.flatMap((folder) => [folder, ...(folder.children ?? [])]);
  if (!folderId) return flat.flatMap((folder) => folder.files);
  const found = flat.find((folder) => folder.id === folderId);
  if (!found) return [];
  return [...found.files, ...(found.children ?? []).flatMap((child) => child.files)];
}

/* ------------------------------------------------------------------ */
/* Design-file lookups (used by the shared canvas editor)              */
/* ------------------------------------------------------------------ */

export interface ProjectScreenHit {
  project: DesignProject;
  session: SketchSession;
  screen: SketchScreen;
}

/** Finds a seeded concept design anywhere in the project list. */
export function findProjectScreen(screenId: string): ProjectScreenHit | null {
  for (const project of PROJECTS) {
    for (const session of project.sessions) {
      const screen = session.screens.find((entry) => entry.id === screenId);
      if (screen) return { project, session, screen };
    }
  }
  return null;
}

/** Finds a design file the user created. Reads workspace state. */
export function findCreatedScreen(screenId: string): ProjectScreenHit | null {
  for (const project of PROJECTS) {
    for (const session of project.sessions) {
      const screen = loadGeneratedScreens(session.id).find((entry) => entry.id === screenId);
      if (screen) return { project, session, screen };
    }
  }
  return null;
}
