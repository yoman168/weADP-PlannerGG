/**
 * Reference files attached to a meeting folder — what the customer handed over
 * or what we captured in the room: their spreadsheet, a photo of the whiteboard,
 * a recording, the RFP.
 *
 * Seeded files below are sample data. Files a user attaches in the UI are kept
 * in workspace state as metadata only: this is a mockup, so it records the name,
 * size and type rather than pretending to store the bytes.
 */
import { workspaceStore } from '@/lib/api/workspace-store';

export type MeetingFileKind =
  'pdf' | 'doc' | 'sheet' | 'image' | 'audio' | 'video' | 'link' | 'zip';

export interface MeetingFile {
  id: string;
  name: string;
  kind: MeetingFileKind;
  /** Absent for links. */
  sizeKb?: number;
  uploadedBy: string;
  uploadedAt: string;
  /** For links: where it points. */
  url?: string;
  /** Why this file matters — shown under the name. */
  note?: string;
  /**
   * Text pulled out of the file: a sheet's rows, a PDF's paragraphs, a
   * recording's transcript. This is what the screen generator reads — images
   * and links have none.
   */
  text?: string;
  /** True for files attached through the UI; only these can be removed. */
  uploaded?: boolean;
  /**
   * Base64 data URL for image files uploaded via the UI (capped at ~500 KB
   * raw so the value stays a sane size). Absent for seeded files.
   */
  dataUrl?: string;
}

/** Seeded references per meeting folder, keyed by session id. */
export const MEETING_FILES: Record<string, MeetingFile[]> = {
  /* eACC Cloud ----------------------------------------------------------- */
  'ses-cloud-accountant-workshop': [
    {
      id: 'mf-cloud-ws-1',
      name: 'month-end-checklist.xlsx',
      kind: 'sheet',
      sizeKb: 48,
      uploadedBy: 'Cloud accounting team',
      uploadedAt: '2026-06-11',
      note: 'The spreadsheet they keep open next to the app — the real close process.',
    },
    {
      id: 'mf-cloud-ws-2',
      name: 'whiteboard-close-flow.jpg',
      kind: 'image',
      sizeKb: 1840,
      uploadedBy: 'Taehyuk Park',
      uploadedAt: '2026-06-11',
    },
    {
      id: 'mf-cloud-ws-3',
      name: 'close-walkthrough.mp4',
      kind: 'video',
      sizeKb: 86_400,
      uploadedBy: 'Namwon Moon',
      uploadedAt: '2026-06-12',
      note: '18 min screen recording of an accountant closing June.',
    },
  ],
  'ses-cloud-cr-june': [
    {
      id: 'mf-cloud-jun-1',
      name: 'support-tickets-june.csv',
      kind: 'sheet',
      sizeKb: 22,
      uploadedBy: 'Cloud support desk',
      uploadedAt: '2026-06-30',
    },
  ],
  'ses-cloud-cr-july': [
    {
      id: 'mf-cloud-jul-1',
      name: 'support-tickets-july.csv',
      kind: 'sheet',
      sizeKb: 31,
      uploadedBy: 'Cloud support desk',
      uploadedAt: '2026-07-28',
    },
    {
      id: 'mf-cloud-jul-2',
      name: 'corp-card-list-annotated.png',
      kind: 'image',
      sizeKb: 640,
      uploadedBy: 'Cloud support desk',
      uploadedAt: '2026-07-28',
      note: 'Their markup of the current list — the bulk-approve ask in one picture.',
    },
    {
      id: 'mf-cloud-jul-3',
      name: 'GitLab: eacc-cloud#1482',
      kind: 'link',
      url: 'https://gitlab.internal/eacc-cloud/-/issues/1482',
      uploadedBy: 'Taehyuk Park',
      uploadedAt: '2026-07-29',
      note: 'Where these three requests are tracked.',
    },
  ],

  /* HD Korea Shipbuilding ----------------------------------------------- */
  'ses-hd-kickoff': [
    {
      id: 'mf-hd-kick-1',
      name: 'hd-scope-of-work.pdf',
      kind: 'pdf',
      sizeKb: 2210,
      uploadedBy: 'Seongmin Yoo',
      uploadedAt: '2026-05-19',
      note: 'Signed scope. Section 4 is the crew requirement.',
    },
    {
      id: 'mf-hd-kick-2',
      name: 'department-tree-sample.xlsx',
      kind: 'sheet',
      sizeKb: 96,
      uploadedBy: 'HD IT',
      uploadedAt: '2026-05-20',
      note: 'HR export — read-only source for the department picker.',
    },
    {
      id: 'mf-hd-kick-3',
      name: 'whiteboard-crew-vs-person.jpg',
      kind: 'image',
      sizeKb: 1520,
      uploadedBy: 'Moka',
      uploadedAt: '2026-05-19',
    },
  ],
  'ses-hd-approval-fix': [
    {
      id: 'mf-hd-appr-1',
      name: 'current-approval-flow.pdf',
      kind: 'pdf',
      sizeKb: 780,
      uploadedBy: 'HD travel desk',
      uploadedAt: '2026-07-26',
      note: 'Their own diagram of who signs what today.',
    },
    {
      id: 'mf-hd-appr-2',
      name: 'live-pending-list.png',
      kind: 'image',
      sizeKb: 512,
      uploadedBy: 'Seongmin Yoo',
      uploadedAt: '2026-07-26',
      note: 'Live screen with the department column our capture is missing.',
    },
  ],
  'ses-hd-uat': [
    {
      id: 'mf-hd-uat-1',
      name: 'uat-feedback.xlsx',
      kind: 'sheet',
      sizeKb: 64,
      uploadedBy: 'HD travel desk',
      uploadedAt: '2026-07-30',
      note: 'One row per pilot user, 8 users.',
    },
    {
      id: 'mf-hd-uat-2',
      name: 'uat-session-recording.mp4',
      kind: 'video',
      sizeKb: 412_000,
      uploadedBy: 'Seongmin Yoo',
      uploadedAt: '2026-07-30',
    },
    {
      id: 'mf-hd-uat-3',
      name: 'blocked-adding-crew.png',
      kind: 'image',
      sizeKb: 388,
      uploadedBy: 'Pilot user (yard 2)',
      uploadedAt: '2026-07-30',
      note: 'Screenshot of the wall two users hit.',
    },
  ],

  /* NongHyup ------------------------------------------------------------ */
  'ses-nh-kickoff': [
    {
      id: 'mf-nh-kick-1',
      name: 'nonghyup-rfp.pdf',
      kind: 'pdf',
      sizeKb: 3480,
      uploadedBy: 'NongHyup digital team',
      uploadedAt: '2026-07-14',
      note: 'The brief we are answering.',
    },
    {
      id: 'mf-nh-kick-2',
      name: 'competitor-app-screens.zip',
      kind: 'zip',
      sizeKb: 12_800,
      uploadedBy: 'Moka',
      uploadedAt: '2026-07-15',
      note: 'Three competitor loan apps, captured for comparison.',
    },
    {
      id: 'mf-nh-kick-3',
      name: 'callback-request-note.docx',
      kind: 'doc',
      sizeKb: 38,
      uploadedBy: 'NongHyup digital team',
      uploadedAt: '2026-07-14',
      note: 'Why they want a human callback and not a chatbot.',
    },
  ],
  'ses-nh-followup': [
    {
      id: 'mf-nh-follow-1',
      name: 'document-checklist-markup.png',
      kind: 'image',
      sizeKb: 720,
      uploadedBy: 'NongHyup digital team',
      uploadedAt: '2026-07-22',
      note: '"Too much at once" — circled in red.',
    },
    {
      id: 'mf-nh-follow-2',
      name: 'call-recording-2026-07-22.m4a',
      kind: 'audio',
      sizeKb: 9_600,
      uploadedBy: 'Moka',
      uploadedAt: '2026-07-22',
    },
  ],
  'ses-nh-compliance': [
    {
      id: 'mf-nh-comp-1',
      name: 'kyc-requirements.pdf',
      kind: 'pdf',
      sizeKb: 1240,
      uploadedBy: 'NongHyup compliance',
      uploadedAt: '2026-07-29',
      note: 'Identity check before any product is shown — page 6.',
    },
    {
      id: 'mf-nh-comp-2',
      name: 'retention-notice-examples.pdf',
      kind: 'pdf',
      sizeKb: 460,
      uploadedBy: 'NongHyup compliance',
      uploadedAt: '2026-07-29',
      note: 'Khmer and English wording from another product.',
    },
    {
      id: 'mf-nh-comp-3',
      name: 'Legal ticket: consent wording',
      kind: 'link',
      url: 'https://gitlab.internal/nonghyup-loan/-/issues/44',
      uploadedBy: 'Moka',
      uploadedAt: '2026-07-30',
      note: 'Blocking the consent screen until legal replies.',
    },
  ],

  /* SK Hynix ------------------------------------------------------------ */
  'ses-sk-scoping': [
    {
      id: 'mf-sk-scope-1',
      name: 'manual-approval-process.xlsx',
      kind: 'sheet',
      sizeKb: 54,
      uploadedBy: 'SK Hynix travel desk',
      uploadedAt: '2026-07-24',
      note: 'How routing is done by hand today.',
    },
    {
      id: 'mf-sk-scope-2',
      name: 'org-chart-travel.pdf',
      kind: 'pdf',
      sizeKb: 890,
      uploadedBy: 'SK Hynix travel desk',
      uploadedAt: '2026-07-24',
    },
  ],
  'ses-sk-proposal-walkthrough': [
    {
      id: 'mf-sk-prop-1',
      name: 'sk-hynix-proposal-v2.pdf',
      kind: 'pdf',
      sizeKb: 5120,
      uploadedBy: '설욱환',
      uploadedAt: '2026-07-28',
      note: 'Deck shown in the room. v3 needs the HD timeline.',
    },
    {
      id: 'mf-sk-prop-2',
      name: 'licence-pricing-questions.xlsx',
      kind: 'sheet',
      sizeKb: 28,
      uploadedBy: 'SK Hynix purchasing',
      uploadedAt: '2026-07-28',
      note: 'Purchasing wants per-department; we quoted per-seat.',
    },
  ],

  /* Harim --------------------------------------------------------------- */
  'ses-hr-intro': [
    {
      id: 'mf-hr-intro-1',
      name: 'regional-voucher-regulation.pdf',
      kind: 'pdf',
      sizeKb: 1680,
      uploadedBy: 'Harim planning',
      uploadedAt: '2026-07-18',
      note: 'Expiry rules are in here somewhere — nobody had read it yet.',
    },
  ],
  'ses-hr-merchant-interviews': [
    {
      id: 'mf-hr-int-1',
      name: 'shop-1-till-setup.jpg',
      kind: 'image',
      sizeKb: 2240,
      uploadedBy: 'Moka',
      uploadedAt: '2026-07-19',
      note: 'Butcher: phone in the back, till at the front.',
    },
    {
      id: 'mf-hr-int-2',
      name: 'shop-2-owner-only.jpg',
      kind: 'image',
      sizeKb: 1980,
      uploadedBy: 'Moka',
      uploadedAt: '2026-07-19',
    },
    {
      id: 'mf-hr-int-3',
      name: 'interview-transcripts.docx',
      kind: 'doc',
      sizeKb: 76,
      uploadedBy: 'Harim planning',
      uploadedAt: '2026-07-20',
      note: 'All three shops. Search for "when do I get the money".',
    },
  ],

  /* Archived pilot ------------------------------------------------------ */
  'ses-vi-review': [
    {
      id: 'mf-vi-1',
      name: 'pilot-close-out-report.pdf',
      kind: 'pdf',
      sizeKb: 1320,
      uploadedBy: 'Moka',
      uploadedAt: '2026-03-12',
      note: 'Why issuing was parked. Worth reading before Harim goes further.',
    },
    {
      id: 'mf-vi-2',
      name: 'issuing-screens.zip',
      kind: 'zip',
      sizeKb: 8_400,
      uploadedBy: 'Local Currency BU',
      uploadedAt: '2026-03-12',
    },
  ],

  /* Task reference files ------------------------------------------------- */
  'task:proj-eacc-cloud:task-dev-01': [
    { id: 'tf-01-1', name: 'csv-export-spec.md', kind: 'doc', sizeKb: 12, uploadedBy: 'Chheng Udam', uploadedAt: '2026-08-04' },
    { id: 'tf-01-2', name: 'receipt-list-sample.csv', kind: 'sheet', sizeKb: 34, uploadedBy: 'Chheng Udam', uploadedAt: '2026-08-04' },
  ],
  'task:proj-eacc-cloud:task-dev-02': [
    { id: 'tf-02-1', name: 'bulk-approve-wireframe.png', kind: 'image', sizeKb: 420, uploadedBy: 'Chheng Udam', uploadedAt: '2026-08-03' },
    { id: 'tf-02-2', name: 'bulk-approve-flow.pdf', kind: 'pdf', sizeKb: 198, uploadedBy: 'Seongmin Yoo', uploadedAt: '2026-08-03' },
  ],
  'task:proj-eacc-cloud:task-dev-03': [
    { id: 'tf-03-1', name: 'dashboard-performance-profile.json', kind: 'doc', sizeKb: 8, uploadedBy: 'Seongmin Yoo', uploadedAt: '2026-08-01' },
  ],
  'task:proj-eacc-cloud:task-dev-04': [
    { id: 'tf-04-1', name: 'a11y-keyboard-nav-spec.md', kind: 'doc', sizeKb: 6, uploadedBy: 'Moka', uploadedAt: '2026-07-31' },
  ],
  'task:proj-eacc-cloud:task-dev-05': [
    { id: 'tf-05-1', name: 'login-error-states.fig', kind: 'image', sizeKb: 1_200, uploadedBy: 'Chheng Udam', uploadedAt: '2026-07-30' },
    { id: 'tf-05-2', name: 'design-conformance-checklist.xlsx', kind: 'sheet', sizeKb: 28, uploadedBy: 'Seongmin Yoo', uploadedAt: '2026-07-30' },
  ],
  'task:proj-eacc-cloud:task-dev-06': [
    { id: 'tf-06-1', name: 'upload-error-screenshot.png', kind: 'image', sizeKb: 340, uploadedBy: 'Chheng Udam', uploadedAt: '2026-08-05' },
    { id: 'tf-06-2', name: 'file-size-limit-policy.md', kind: 'doc', sizeKb: 4, uploadedBy: 'Seongmin Yoo', uploadedAt: '2026-08-05' },
  ],
  'task:proj-eacc-cloud:task-dev-07': [
    { id: 'tf-07-1', name: 'totp-enrolment-flow.pdf', kind: 'pdf', sizeKb: 175, uploadedBy: 'Seongmin Yoo', uploadedAt: '2026-08-06' },
    { id: 'tf-07-2', name: 'recovery-code-ux.fig', kind: 'image', sizeKb: 890, uploadedBy: 'Moka', uploadedAt: '2026-08-06' },
  ],
  'task:proj-eacc-cloud:task-dev-08': [
    { id: 'tf-08-1', name: 'close-checklist-export-sample.pdf', kind: 'pdf', sizeKb: 310, uploadedBy: 'Moka', uploadedAt: '2026-08-04' },
  ],
  'task:proj-eacc-cloud:task-dev-09': [
    { id: 'tf-09-1', name: 'audit-trail-schema.sql', kind: 'doc', sizeKb: 3, uploadedBy: 'Seongmin Yoo', uploadedAt: '2026-08-06' },
    { id: 'tf-09-2', name: 'approval-override-scenarios.xlsx', kind: 'sheet', sizeKb: 22, uploadedBy: 'Seongmin Yoo', uploadedAt: '2026-08-06' },
  ],
};

/* ------------------------------------------------------------------ */
/* Extracted text                                                      */
/* ------------------------------------------------------------------ */

/**
 * What a real extraction pipeline would pull out of each seeded file. Kept
 * beside the metadata rather than inside it so the file list stays readable.
 */
const SEEDED_TEXT: Record<string, string> = {
  'mf-cloud-ws-1': [
    'Month-end close checklist (their spreadsheet)',
    'Step,Owner,Blocked by,Done',
    '1,Corporate card evidence collected,Accounting,Cards with no receipt,No',
    '2,Tax invoices matched to POs,Accounting,3 unmatched suppliers,No',
    '3,Personal expenses approved,Team leads,12 items returned to staff,No',
    '4,Cash receipts reconciled,Accounting,,Yes',
    'Note in cell G14: "cannot see which cost centre is holding us up"',
  ].join('\n'),
  'mf-cloud-ws-3': [
    'Transcript excerpt — close walkthrough',
    '[04:12] "I filter Draft first, always. Everything else is noise."',
    '[07:48] "This is the bit I do in Excel because the screen cannot tell me what is missing."',
    '[11:05] "By cost centre. My manager asks by cost centre, not by person."',
    '[15:30] "Then I print it and walk it upstairs."',
  ].join('\n'),
  'mf-cloud-jun-1': [
    'ticket,summary,requested_by,priority',
    'CS-3312,Cash receipt list shows internal id not receipt number,Accounting,High',
    'CS-3318,Tax invoice date range should default to current month,Accounting,Medium',
    'CS-3325,Bulk download of evidence files,Accounting,Low (deferred)',
  ].join('\n'),
  'mf-cloud-jul-1': [
    'ticket,summary,requested_by,priority',
    'CS-3401,Approve a whole month of card transactions at once,Accounting,High',
    'CS-3407,Supplier CEO column is empty — remove it,Accounting,Medium',
    'CS-3412,"Returned to me" tab on personal expense,Staff,High',
  ].join('\n'),
  'mf-hd-kick-1': [
    'Scope of work — extract',
    '4.1 A trip plan may cover a crew of up to 20 travellers going to one yard.',
    '4.2 Settlement remains per traveller; the plan is the approval unit.',
    '4.3 The department hierarchy is owned by HR. The system reads it and must not modify it.',
    '7.2 Single sign-on is explicitly out of phase 1.',
  ].join('\n'),
  'mf-hd-kick-2': [
    'department_code,department_name,parent_code,head',
    'HD-100,Shipbuilding Division,,Kim',
    'HD-110,Yard 1 Operations,HD-100,Park',
    'HD-111,Yard 1 Welding,HD-110,Choi',
    'HD-120,Yard 2 Operations,HD-100,Jeong',
    'HD-900,Travel Desk,HD-100,Yoo',
  ].join('\n'),
  'mf-hd-appr-1': [
    'Current approval flow (their diagram, transcribed)',
    'Domestic trip: traveller -> team lead -> done',
    'Overseas trip: traveller -> team lead -> division head -> done',
    'Both approvers are notified by email today; the queue is shared and unfiltered.',
    'Delegation is handled by forwarding the email.',
  ].join('\n'),
  'mf-hd-uat-1': [
    'user,department,submitted,issue',
    'U1,Yard 1 Welding,yes,"Wanted to add a crew member after submitting"',
    'U2,Yard 1 Welding,yes,"Same — had to start over"',
    'U3,Yard 2 Operations,yes,"Unclear what in approval means"',
    'U4,Travel Desk,yes,"Asked to duplicate last month trip"',
    'U5,Yard 2 Operations,yes,',
    'U6,Yard 1 Operations,yes,"Wording: pending vs in approval"',
    'U7,Travel Desk,yes,"Duplicate would save me 10 minutes"',
    'U8,Yard 1 Welding,yes,"Duplicate, yes"',
  ].join('\n'),
  'mf-hd-uat-2': [
    'Transcript excerpt — UAT session',
    '[22:10] "I forgot one welder. Can I just add him? ... Oh. I have to do the whole thing again."',
    '[38:55] "In approval, pending — which one means someone is looking at it?"',
    '[51:02] "Last month I did this exact trip. Copy it?"',
  ].join('\n'),
  'mf-nh-kick-1': [
    'RFP extract — mobile loan onboarding',
    '2.1 Target users are migrant small-business owners; primary languages Khmer and English.',
    '3.4 Applicants must be able to compare loan products (rate, term, limit) before applying.',
    '3.7 Document upload must show progress and what is still outstanding.',
    '5.2 A human callback option is required. Automated chat agents are not acceptable.',
    '6.1 Repayment simulation: to be confirmed by the bank during design.',
  ].join('\n'),
  'mf-nh-kick-3': [
    'Why a callback, not a chatbot',
    'Our segment distrusts automated replies about money.',
    'Branch staff already handle these calls; the app should book the call, not replace it.',
    'A visible phone/callback button raised completion by 18% in our SMS pilot.',
  ].join('\n'),
  'mf-nh-follow-2': [
    'Transcript excerpt — follow-up call',
    '[03:20] "Fourteen documents on one screen. Nobody will do that."',
    '[06:40] "Mandatory first. The optional ones can come after we accept the application."',
    '[12:15] "Simulation yes — but after the documents pass, not before."',
  ].join('\n'),
  'mf-nh-comp-1': [
    'KYC requirements — extract',
    'p.6 Identity verification must complete before any product terms are displayed.',
    'p.7 Consent for a credit-bureau enquiry must be captured as a distinct, revocable action.',
    'p.9 Consent may not be bundled with terms acceptance or presented as a pre-ticked box.',
    'p.14 Retention notice must appear at the point of document upload, in the applicant language.',
  ].join('\n'),
  'mf-nh-comp-2': [
    'Retention notice — approved wording from another product',
    'EN: "We keep your documents for 5 years after your application closes."',
    'KH: "យើងរក្សាទុកឯកសាររបស់អ្នករយៈពេល ៥ ឆ្នាំ បន្ទាប់ពីពាក្យសុំរបស់អ្នកបានបិទ។"',
    'Placement: directly above the upload control, not in a modal.',
  ].join('\n'),
  'mf-sk-scope-1': [
    'How routing works today (their sheet)',
    'trip_type,approvers,average_days,pain',
    'Domestic,1,1.5,"Approver often on leave"',
    'Overseas,2,4.0,"Second approver only told after the first signs"',
    'Note: "we track this in email; nothing shows the queue per department"',
  ].join('\n'),
  'mf-sk-prop-2': [
    'Licence questions from purchasing',
    'Q: Is the licence per named user or per department?',
    'Q: Do approvers who never create a trip need a seat?',
    'Their assumption: per department. Our quote: per seat.',
    'Budget cycle closes in September; no signature before then.',
  ].join('\n'),
  'mf-hr-intro-1': [
    'Regional voucher regulation — extract',
    'Art. 12 Vouchers expire 6 months after issue unless extended by the issuing authority.',
    'Art. 14 On expiry the unspent balance returns to the issuing budget; no merchant claim.',
    'Art. 19 Merchants must be settled within 5 business days of redemption.',
  ].join('\n'),
  'mf-hr-int-3': [
    'Merchant interview transcripts — excerpts',
    'Shop 1 (butcher): "The phone is in the back. Redemption has to happen at the till."',
    'Shop 2 (grocer): "It is only me. If I have to log in every morning I will stop using it."',
    'Shop 3 (bakery): "Four staff. I need to know who took which voucher."',
    'All three, unprompted: "When do I get the money?"',
    'None mentioned wanting to see a voucher balance.',
  ].join('\n'),
  'mf-vi-1': [
    'Pilot close-out report — findings',
    'Consumer-side issuing was built but never rolled out: the BU could not fund distribution.',
    'Batch issuing screen was the most reused artefact; keep it.',
    'Expiry handling was left undecided and became the blocker for the next phase.',
  ].join('\n'),
};

/* ------------------------------------------------------------------ */
/* Files attached through the UI (browser-only persistence)            */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'we-adk:sketcher:meeting-files';

function storeKey(sessionId: string): string {
  return `${STORAGE_KEY}:${sessionId}`;
}

function isMeetingFileArray(value: unknown): value is MeetingFile[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { id?: unknown }).id === 'string' &&
        typeof (entry as { name?: unknown }).name === 'string',
    )
  );
}

export function loadUploadedFiles(sessionId: string): MeetingFile[] {
  try {
    const raw = workspaceStore.getItem(storeKey(sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return isMeetingFileArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUploadedFiles(sessionId: string, files: MeetingFile[]): void {
  try {
    workspaceStore.setItem(storeKey(sessionId), JSON.stringify(files));
  } catch {
    // Storage unavailable — the reference simply won't persist.
  }
}

/** Seeded references (with their extracted text) plus anything attached here. */
export function sessionFiles(sessionId: string, uploaded: MeetingFile[] = []): MeetingFile[] {
  const seeded = (MEETING_FILES[sessionId] ?? []).map((file) => ({
    ...file,
    text: SEEDED_TEXT[file.id],
  }));
  return [...seeded, ...uploaded];
}

/**
 * One block of text for the generator: every reference that has extracted text,
 * labelled with its filename, plus a line naming the ones that have none so the
 * model knows they exist. Truncated to `maxChars` so a long transcript cannot
 * push the meeting notes out of the prompt.
 */
export function mergeReferenceText(
  files: MeetingFile[],
  maxChars = 12_000,
): { text: string; used: MeetingFile[]; unreadable: MeetingFile[]; truncated: boolean } {
  const withText = files.filter((file) => (file.text ?? '').trim().length > 0);
  const unreadable = files.filter((file) => (file.text ?? '').trim().length === 0);

  const used: MeetingFile[] = [];
  const parts: string[] = [];
  let budget = maxChars;
  let truncated = false;

  for (const file of withText) {
    const body = (file.text ?? '').trim();
    const header = `--- ${file.name} (${file.kind}, from ${file.uploadedBy}) ---`;
    const cost = header.length + body.length + 2;
    if (cost > budget) {
      truncated = true;
      continue;
    }
    parts.push(`${header}\n${body}`);
    used.push(file);
    budget -= cost;
  }

  if (unreadable.length > 0) {
    parts.push(
      `--- also attached, no extractable text: ${unreadable.map((file) => file.name).join(', ')} ---`,
    );
  }

  return { text: parts.join('\n\n'), used, unreadable, truncated };
}

/** Text-ish uploads are read for real; binaries are recorded by name only. */
const READABLE_EXTENSIONS = new Set(['txt', 'md', 'csv', 'tsv', 'json', 'log', 'yml', 'yaml']);

export function isReadableFileName(name: string): boolean {
  return READABLE_EXTENSIONS.has(name.split('.').pop()?.toLowerCase() ?? '');
}

const EXTENSION_KINDS: Record<string, MeetingFileKind> = {
  pdf: 'pdf',
  doc: 'doc',
  docx: 'doc',
  txt: 'doc',
  md: 'doc',
  rtf: 'doc',
  xls: 'sheet',
  xlsx: 'sheet',
  csv: 'sheet',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  heic: 'image',
  svg: 'image',
  mp3: 'audio',
  m4a: 'audio',
  wav: 'audio',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  zip: 'zip',
  tar: 'zip',
  gz: 'zip',
};

export function kindFromName(name: string): MeetingFileKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_KINDS[ext] ?? 'doc';
}

let counter = 0;

/**
 * Records an attachment against a meeting folder. Metadata only — the file's
 * contents are not stored, which the UI says out loud.
 */
export function addUploadedFiles(
  sessionId: string,
  incoming: { name: string; sizeKb: number; text?: string; dataUrl?: string }[],
  uploadedBy: string,
  today: string,
): MeetingFile[] {
  const created = incoming.map((file) => {
    counter += 1;
    return {
      id: `mf-up-${counter}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      kind: kindFromName(file.name),
      sizeKb: file.sizeKb,
      uploadedBy,
      uploadedAt: today,
      uploaded: true,
      ...(file.text ? { text: file.text } : {}),
      ...(file.dataUrl ? { dataUrl: file.dataUrl } : {}),
    } satisfies MeetingFile;
  });

  const next = [...loadUploadedFiles(sessionId), ...created];
  saveUploadedFiles(sessionId, next);
  return created;
}

export function removeUploadedFile(sessionId: string, fileId: string): MeetingFile[] {
  const next = loadUploadedFiles(sessionId).filter((entry) => entry.id !== fileId);
  saveUploadedFiles(sessionId, next);
  return next;
}

/** Create a blank named file in a folder (for the inline "new file" flow). */
export function createNamedFile(folderId: string, name: string): MeetingFile {
  counter += 1;
  const file: MeetingFile = {
    id: `mf-new-${counter}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    kind: kindFromName(name),
    uploadedBy: 'You',
    uploadedAt: new Date().toISOString().slice(0, 10),
    uploaded: true,
  };
  saveUploadedFiles(folderId, [...loadUploadedFiles(folderId), file]);
  return file;
}

/* ------------------------------------------------------------------ */
/* Custom folders (user-created, in workspace state)              */
/* ------------------------------------------------------------------ */

export interface CustomFolder {
  id: string;
  title: string;
  createdAt: string;
}

const CUSTOM_FOLDERS_KEY = 'we-adk:sketcher:custom-folders';

function customFoldersKey(projectId: string): string {
  return `${CUSTOM_FOLDERS_KEY}:${projectId}`;
}

export function loadCustomFolders(projectId: string): CustomFolder[] {
  try {
    const raw = workspaceStore.getItem(customFoldersKey(projectId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CustomFolder[];
  } catch {
    return [];
  }
}

export function saveCustomFolders(projectId: string, folders: CustomFolder[]): void {
  try {
    workspaceStore.setItem(customFoldersKey(projectId), JSON.stringify(folders));
  } catch {
    // Storage unavailable.
  }
}

export function formatFileSize(sizeKb?: number): string {
  if (sizeKb === undefined) return 'link';
  if (sizeKb < 1024) return `${Math.max(1, Math.round(sizeKb))} KB`;
  return `${(sizeKb / 1024).toFixed(sizeKb < 10_240 ? 1 : 0)} MB`;
}
