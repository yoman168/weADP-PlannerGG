/**
 * A round, written up as a document.
 *
 * The Overview tab can say what a round contains on screen, but a round is also
 * the thing a business analyst hands to somebody who is not going to open this
 * app: the screens it defines, the order they run in, the work it carries, and
 * the decisions and open questions behind it. That is a document, and this
 * builds it — the same content as Markdown for a repository or as HTML for
 * anyone with a browser.
 *
 * Assembled from a plain input object rather than reading storage itself, so the
 * page that already has the designs, the tasks and the diff markers on screen is
 * the one thing deciding what goes in. A builder that fetched its own data would
 * be a second answer to "what is in this round".
 */

import { type SurfaceKind } from '@/lib/we-adk-mock/design-surface';
import { zipBlob } from '@/lib/we-adk/zip';

/* ------------------------------------------------------------------ */
/* What goes in                                                        */
/* ------------------------------------------------------------------ */

/** One element of a screen, in the order it is drawn. */
export interface ReportBlock {
  /** What it is — `Table`, `Filter bar`, `Button bar`. */
  kind: string;
  /** What it says on screen. */
  label?: string;
  /** Columns, options, buttons — what makes it this block rather than any other. */
  detail?: string;
}

export interface ReportDesign {
  name: string;
  fileName: string;
  route?: string;
  surface: SurfaceKind;
  /** Folder inside the round, when it sits in one. */
  folder?: string;
  /** `added` / `modified` / `unchanged` against the round it was cut from. */
  change: 'added' | 'modified' | 'unchanged';
  status: string;
  /**
   * The screen's own elements, so it can be built from this document rather
   * than reverse-engineered from the html beside it.
   */
  blocks: ReportBlock[];
}

/** A service the project needs running — one row of the environment. */
export interface ReportService {
  id: string;
  role: string;
  image: string;
  ports: string[];
  source: string;
  note: string;
}

/**
 * A test the build has to pass.
 *
 * Carried in full — steps and expected result — because this is the half of the
 * document that says when the work is done. A specification without acceptance
 * criteria is a description of an intention.
 */
export interface ReportTest {
  code: string;
  module: string;
  title: string;
  description?: string;
  precondition?: string;
  steps: string[];
  expected: string;
  type: string;
  priority: string;
  status: string;
  assignee?: string;
  /** Traceability back to the task and the design it belongs to. */
  linkedTask?: string;
  linkedDesign?: string;
}

export interface ReportTask {
  code: string;
  title: string;
  status: string;
  assignee: string;
  testedBy: string;
  priority: 1 | 2 | 3;
  description?: string;
  /**
   * What the task was worked from — the material a reader of this document would
   * otherwise have to be told about verbally.
   *
   * Three kinds, kept apart because they answer different questions: a reference
   * file is what the customer supplied, a design reference is the screen the work
   * is built against, and a board is what somebody drew to explain it. Collapsed
   * into one list they would read as a pile of attachments.
   */
  files: { name: string; note?: string }[];
  designs: { name: string; fileName: string; route?: string; note?: string }[];
  boards: { title: string; caption?: string }[];
}

/**
 * A meeting, as the document carries it.
 *
 * The whole thing, not the conclusions. Decisions and open questions are what a
 * round is justified by, but the notes are where the reasoning is — "nobody uses
 * the search box; they scan the list" is the sentence that explains a screen,
 * and a document that keeps only the ruling makes the next person re-derive it.
 */
export interface ReportMeeting {
  title: string;
  metAt: string;
  /** Workshop, change request, review — what kind of conversation it was. */
  kind?: string;
  attendees?: string;
  durationMin?: number;
  /** The raw notes, newlines intact. */
  notes?: string;
  decisions: string[];
  openQuestions: string[];
  /** What was drawn out of it. */
  screens: { name: string; route?: string }[];
}

/** The project's own facts — the header of a document about the whole thing. */
export interface ReportProfile {
  stage: string;
  /** The project's status chip, e.g. `Live`. */
  status: string;
  /** Claude spend so far, in USD. */
  spend: number;
  /** The live solution behind it, when there is one. */
  solution?: string;
}

/** One round of the project, for the register that lists them all. */
export interface ReportRound {
  version: number;
  name: string;
  status: string;
  complete: boolean;
  designs: number;
  tasks: number;
  /** True for the round this document leads with. */
  current: boolean;
}

/**
 * A task anywhere in the project.
 *
 * Deliberately thinner than `ReportTask`: this is the register, one line each
 * across every round, while the round in focus gets its tasks written out in
 * full. Repeating the descriptions and attachments for a project's whole task
 * history would bury the round the document is about.
 */
export interface ReportTaskLine {
  code: string;
  title: string;
  status: string;
  assignee: string;
  /** The round it is filed against, named. */
  round: string;
}

export interface VersionReport {
  projectName: string;
  customer: string;
  owner: string;
  summary: string;
  /** What the round is called — its name if it has one, else `version 4`. */
  roundName: string;
  version: number;
  status: string;
  /** True once the round has shipped. A report of an open round is a draft. */
  complete: boolean;
  /** `YYYY-MM-DD`, passed in so the document is reproducible. */
  preparedOn: string;
  designs: ReportDesign[];
  tasks: ReportTask[];
  meetings: ReportMeeting[];
  /* ---- The project around the round ---- */
  /** Facts about the project itself. */
  profile: ReportProfile;
  /** Every round, so the one in focus has a place in the sequence. */
  rounds: ReportRound[];
  /** Every task in the project, one line each. */
  allTasks: ReportTaskLine[];
  /** The services the project needs running, in boot order. */
  stack: { name: string; services: ReportService[] };
  /** The acceptance tests on the QA sheet. */
  tests: ReportTest[];
}

/* ------------------------------------------------------------------ */
/* Shared shaping                                                      */
/* ------------------------------------------------------------------ */

const CHANGE_WORD: Record<ReportDesign['change'], string> = {
  added: 'New in this round',
  modified: 'Changed in this round',
  unchanged: 'Carried over unchanged',
};

const PRIORITY_WORD: Record<1 | 2 | 3, string> = { 1: 'High', 2: 'Medium', 3: 'Low' };

/** Screens in the order they are arranged, popups after them. */
function screensFirst(designs: ReportDesign[]): {
  screens: ReportDesign[];
  popups: ReportDesign[];
} {
  return {
    screens: designs.filter((design) => design.surface === 'screen'),
    popups: designs.filter((design) => design.surface === 'popup'),
  };
}

/** What the round actually changes — the sentence the scope section opens with. */
function scopeLine(report: VersionReport): string {
  const added = report.designs.filter((design) => design.change === 'added').length;
  const modified = report.designs.filter((design) => design.change === 'modified').length;
  const carried = report.designs.filter((design) => design.change === 'unchanged').length;

  const parts = [
    `${added} new`,
    `${modified} changed`,
    carried > 0 ? `${carried} carried over unchanged` : null,
  ].filter(Boolean);

  return `${report.designs.length} design${report.designs.length === 1 ? '' : 's'} (${parts.join(', ')}) and ${
    report.tasks.length
  } task${report.tasks.length === 1 ? '' : 's'}.`;
}

/** Tasks grouped by status, so the work reads as a state of play. */
function tasksByStatus(tasks: ReportTask[]): { status: string; tasks: ReportTask[] }[] {
  const groups = new Map<string, ReportTask[]>();
  for (const task of tasks) {
    const found = groups.get(task.status);
    if (found) found.push(task);
    else groups.set(task.status, [task]);
  }
  return [...groups.entries()].map(([status, entries]) => ({ status, tasks: entries }));
}

/**
 * Whether a task carries any material at all.
 *
 * Asked once rather than three times at each call site: a task with nothing
 * attached should say so plainly, and three empty headings say it three times
 * while looking like an omission.
 */
function hasReferences(task: ReportTask): boolean {
  return task.files.length > 0 || task.designs.length > 0 || task.boards.length > 0;
}

/** `2 h 30`, `45 min` — a duration nobody has to convert in their head. */
function duration(minutes: number | undefined): string | undefined {
  if (minutes === undefined || minutes <= 0) return undefined;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

/** The line under a meeting's title: when, what kind, who, how long. */
function meetingMeta(meeting: ReportMeeting): string {
  return [meeting.metAt, meeting.kind, meeting.attendees, duration(meeting.durationMin)]
    .filter(Boolean)
    .join(' · ');
}

/**
 * What the download is called.
 *
 * Takes only the three fields it reads, so the page can name the files it is
 * about to produce without assembling the document first — a full report just
 * to print a filename would mean reading every canvas out of storage on render.
 */
export function reportFileName(
  report: Pick<VersionReport, 'projectName' | 'roundName' | 'version'>,
  extension: 'md' | 'html' | 'zip',
): string {
  const slug = report.roundName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${report.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${slug || `v${report.version}`}.${extension}`;
}

/* ------------------------------------------------------------------ */
/* Markdown                                                            */
/* ------------------------------------------------------------------ */

/** A cell that cannot break the table it sits in. */
function cell(value: string | undefined): string {
  return (value ?? '—').replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

/**
 * One task, with everything it was worked from.
 *
 * The table this replaced could hold the five columns that fit a row and nothing
 * else — so the reference files, the design references and the boards were all
 * absent from the document, which is exactly the material a reader who was not
 * in the room needs. A block per task has room for them.
 */
function taskMarkdown(task: ReportTask): string {
  const parts: string[] = [
    `#### \`${task.code}\` ${task.title}`,
    '',
    [
      task.assignee,
      `${PRIORITY_WORD[task.priority]} priority`,
      `verified by ${task.testedBy}`,
    ].join(' · '),
  ];

  if (task.description) parts.push('', task.description);

  if (task.designs.length > 0) {
    parts.push(
      '',
      '**Design references**',
      ...task.designs.map(
        (design) =>
          `- ${design.name} — \`${design.fileName}\`${design.route ? ` (${design.route})` : ''}${
            design.note ? ` — ${design.note}` : ''
          }`,
      ),
    );
  }

  if (task.files.length > 0) {
    parts.push(
      '',
      '**Reference files**',
      ...task.files.map((file) => `- ${file.name}${file.note ? ` — ${file.note}` : ''}`),
    );
  }

  if (task.boards.length > 0) {
    parts.push(
      '',
      '**Whiteboard**',
      ...task.boards.map(
        (board) => `- ${board.title}${board.caption ? ` — ${board.caption}` : ''}`,
      ),
    );
  }

  if (!hasReferences(task)) parts.push('', '_Nothing attached._');

  return parts.join('\n');
}

/**
 * The project as a document, with one round written out in full.
 *
 * Not a summary of the round. Somebody handed this file has no app to open and
 * no meeting to have attended: they need the project's own facts, the
 * conversations it came out of, every round it has been through and every task
 * on the board — and then the round in focus, in the detail that makes it
 * buildable. The round is the subject; the project is the context that makes the
 * subject mean anything.
 */
/**
 * Where a design's html sits, relative to the report at the root of the archive.
 *
 * Encoded, because a file name is a design name that has been slugged and a slug
 * is not a promise: a space or a bracket that survives it would end the href
 * early and the link would open nothing.
 */
function designHref(design: { fileName: string; folder?: string }): string {
  return encodeURI(`designs/${design.folder ? `${design.folder}/` : ''}${design.fileName}`);
}

/**
 * A link back to the report, put into a design page.
 *
 * Every design in the archive gets one, whether it was drawn from blocks or
 * fetched from the running prototype — a page you can reach and not leave is
 * half a link. Inserted before `</body>` where there is one, appended where
 * there is not, so a page this code did not write is not reshaped by it.
 */
function withBackLink(html: string, href: string, label: string): string {
  const link =
    `<a href="${href}" style="position:fixed;left:12px;bottom:12px;z-index:2147483647;` +
    `display:inline-block;padding:6px 10px;border-radius:9999px;border:1px solid rgba(0,0,0,.12);` +
    `background:#fff;color:#111827;font:500 12px/1 system-ui,-apple-system,sans-serif;` +
    `text-decoration:none;box-shadow:0 1px 3px rgba(0,0,0,.12)">&larr; ${escapeHtml(label)}</a>`;
  const close = html.lastIndexOf('</body>');
  return close === -1
    ? `${html}\n${link}\n`
    : `${html.slice(0, close)}${link}\n${html.slice(close)}`;
}

/* ------------------------------------------------------------------ */
/* Markdown, one file per section                                      */
/* ------------------------------------------------------------------ */

/** One document in the set. */
export interface ReportFile {
  /** Path inside `report/`, e.g. `03-rounds.md`. */
  name: string;
  text: string;
}

/** A file name from a title — `Business background` becomes `business-background`. */
function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'untitled'
  );
}

/** `01`, `02` — so a directory listing is in reading order. */
function ordinal(index: number): string {
  return String(index).padStart(2, '0');
}

/** The heading and the standing footer every section file carries. */
function page(title: string, body: string): string {
  return `# ${title}\n\n${body}\n`;
}

/* ---- The sections ---- */

function projectBody(report: VersionReport): string {
  return [
    report.summary,
    '',
    '| | |',
    '| --- | --- |',
    `| Customer | ${cell(report.customer)} |`,
    `| Owner | ${cell(report.owner)} |`,
    `| Status | ${cell(report.profile.status)} |`,
    `| Stage | ${cell(report.profile.stage)} |`,
    report.profile.solution ? `| Live solution | ${cell(report.profile.solution)} |` : null,
    `| Round this set is about | ${cell(report.roundName)} (version ${report.version}, ${report.status}) |`,
    `| Rounds | ${report.rounds.length} |`,
    `| Designs in this round | ${report.designs.length} |`,
    `| Tasks on the board | ${report.allTasks.length} |`,
    `| Claude spend | $${report.profile.spend.toFixed(2)} |`,
    `| Prepared | ${report.preparedOn} |`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function businessBody(report: VersionReport): string {
  if (report.meetings.length === 0) return '_No meetings recorded against this project._';
  return [
    'Every conversation this project came out of, in the order they happened.',
    '',
    report.meetings
      .map((meeting) =>
        [
          `## ${meeting.title}`,
          '',
          `_${meetingMeta(meeting)}_`,
          meeting.notes
            ? ['', '**Notes**', '', ...meeting.notes.split('\n').map((line) => `> ${line}`)]
                .join('\n')
                .trimEnd()
            : '',
          meeting.decisions.length === 0
            ? ''
            : ['', '**Decided**', '', ...meeting.decisions.map((entry) => `- ${entry}`)]
                .join('\n')
                .trimEnd(),
          meeting.openQuestions.length === 0
            ? ''
            : ['', '**Left open**', '', ...meeting.openQuestions.map((entry) => `- ${entry}`)]
                .join('\n')
                .trimEnd(),
          meeting.screens.length === 0
            ? ''
            : [
                '',
                '**Designs it produced**',
                '',
                ...meeting.screens.map(
                  (screen) => `- ${screen.name}${screen.route ? ` — \`${screen.route}\`` : ''}`,
                ),
              ]
                .join('\n')
                .trimEnd(),
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .join('\n\n'),
  ].join('\n');
}

function roundsBody(report: VersionReport): string {
  if (report.rounds.length === 0) return '_No rounds opened yet._';
  return [
    '| Round | Version | Status | Designs | Tasks |',
    '| --- | --- | --- | --- | --- |',
    ...report.rounds.map(
      (round) =>
        `| ${round.current ? `**${cell(round.name)}**` : cell(round.name)} | ${round.version} | ${round.status} | ${round.designs} | ${round.tasks} |`,
    ),
    '',
    'The round in bold is the one this set of documents is about.',
  ].join('\n');
}

function taskRegisterBody(report: VersionReport): string {
  if (report.allTasks.length === 0) return '_No tasks on the board._';
  return [
    'Every task on the board, whichever round it belongs to. The ones in this round are written out in full in the work file.',
    '',
    '| Code | Task | Round | Status | Assignee |',
    '| --- | --- | --- | --- | --- |',
    ...report.allTasks.map(
      (task) =>
        `| \`${cell(task.code)}\` | ${cell(task.title)} | ${cell(task.round)} | ${cell(task.status)} | ${cell(task.assignee)} |`,
    ),
  ].join('\n');
}

/** Scope, the two design tables and the walk-through — the shape of the round. */
function scopeBody(report: VersionReport): string {
  const { screens, popups } = screensFirst(report.designs);
  return [
    scopeLine(report),
    '',
    '## Screens',
    '',
    screens.length === 0
      ? '_No screens in this round._'
      : [
          '| Screen | Route | Change | Folder |',
          '| --- | --- | --- | --- |',
          ...screens.map(
            (design) =>
              `| ${cell(design.name)} | ${cell(design.route)} | ${CHANGE_WORD[design.change]} | ${cell(design.folder)} |`,
          ),
        ].join('\n'),
    '',
    '## Popups',
    '',
    popups.length === 0
      ? '_No popups in this round._'
      : [
          'These open over a screen rather than at an address of their own.',
          '',
          '| Popup | Change | Folder |',
          '| --- | --- | --- |',
          ...popups.map(
            (design) =>
              `| ${cell(design.name)} | ${CHANGE_WORD[design.change]} | ${cell(design.folder)} |`,
          ),
        ].join('\n'),
    '',
    '## Flow',
    '',
    screens.length === 0
      ? '_Nothing to walk through yet._'
      : [
          'The screens in the order the round arranges them:',
          '',
          ...screens.map(
            (design, index) =>
              `${index + 1}. **${design.name}**${design.route ? ` — \`${design.route}\`` : ''}`,
          ),
          popups.length === 0
            ? ''
            : `\nOpening over them: ${popups.map((design) => design.name).join(', ')}.`,
        ]
          .filter(Boolean)
          .join('\n'),
  ].join('\n');
}

/**
 * One screen, on its own.
 *
 * A file per design rather than a section per design: this is the document
 * somebody builds one screen from, and it is the one they will have open while
 * they do it. Twelve screens in a single file means scrolling past eleven of
 * them, and an agent handed the set can read exactly the one it is working on.
 */
function specBody(design: ReportDesign): string {
  // The file's own status is worth stating unless it is the change word again —
  // "Carried over unchanged · status Carried over" says one thing twice.
  const change = CHANGE_WORD[design.change];
  const status =
    change.toLowerCase().includes(design.status.toLowerCase()) ||
    design.status.toLowerCase().includes(change.toLowerCase())
      ? null
      : `status ${design.status}`;

  return [
    [
      design.route ? `\`${design.route}\`` : 'No route — opens over a screen',
      design.surface === 'popup' ? 'Popup' : 'Screen',
      change,
      design.folder ? `in ${design.folder}` : null,
      status,
    ]
      .filter(Boolean)
      .join(' · '),
    '',
    // A link, not a path in backticks — a Markdown viewer opens the first and
    // makes the reader hunt for the second. Two levels up, because these files
    // sit in `report/<nn>-screens/`.
    `Rendered: [${design.fileName}](../../${designHref(design)})`,
    '',
    design.blocks.length === 0
      ? '_This canvas is empty._'
      : [
          '| # | Element | Label | Detail |',
          '| --- | --- | --- | --- |',
          ...design.blocks.map(
            (block, index) =>
              `| ${index + 1} | ${cell(block.kind)} | ${cell(block.label)} | ${cell(block.detail)} |`,
          ),
        ].join('\n'),
  ].join('\n');
}

function workBody(report: VersionReport): string {
  if (report.tasks.length === 0) return '_No tasks filed against this round._';
  return tasksByStatus(report.tasks)
    .map(({ status, tasks }) =>
      [
        `## ${status} (${tasks.length})`,
        '',
        tasks.map((task) => taskMarkdown(task)).join('\n\n'),
      ].join('\n'),
    )
    .join('\n\n');
}

function testsBody(report: VersionReport): string {
  if (report.tests.length === 0) return '_No test cases written yet._';
  return [
    'What the build has to pass. Steps and expected result in full — this is the half of the set that says when the work is done.',
    '',
    report.tests
      .map((test) =>
        [
          `## ${test.code} — ${test.title}`,
          '',
          [test.module, test.type, `${test.priority} priority`, test.status]
            .filter(Boolean)
            .join(' · '),
          test.description ? `\n${test.description}` : '',
          test.precondition ? `\n**Given** ${test.precondition}` : '',
          test.steps.length === 0
            ? ''
            : `\n**Steps**\n\n${test.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`,
          `\n**Expected** ${test.expected}`,
          test.linkedTask || test.linkedDesign
            ? `\n_Covers ${[test.linkedTask, test.linkedDesign].filter(Boolean).join(' · ')}_`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .join('\n\n'),
  ].join('\n');
}

function stackBody(report: VersionReport): string {
  if (report.stack.services.length === 0) return '_No environment analysed._';
  return [
    `Compose project \`${report.stack.name}\`. Listed in boot order — dependencies first, the app that needs them last.`,
    '',
    '| Service | Role | Image | Ports | Where it came from |',
    '| --- | --- | --- | --- | --- |',
    ...report.stack.services.map(
      (service) =>
        `| \`${cell(service.id)}\` | ${cell(service.role)} | \`${cell(service.image)}\` | ${cell(service.ports.join(', '))} | ${cell(service.source)} |`,
    ),
    '',
    ...report.stack.services.map((service) => `- **${service.id}** — ${service.note}`),
  ].join('\n');
}

function decisionsBody(report: VersionReport): string {
  const decisions = report.meetings.flatMap((meeting) =>
    meeting.decisions.map((entry) => ({ meeting: meeting.title, entry })),
  );
  const open = report.meetings.flatMap((meeting) =>
    meeting.openQuestions.map((entry) => ({ meeting: meeting.title, entry })),
  );

  return [
    '## Decided',
    '',
    decisions.length === 0
      ? '_Nothing recorded._'
      : [
          'Gathered from every meeting, so the rulings can be read without the discussion around them.',
          '',
          ...decisions.map((item) => `- ${item.entry} _(${item.meeting})_`),
        ].join('\n'),
    '',
    '## Still open',
    '',
    open.length === 0
      ? '_Nothing outstanding._'
      : [
          'A design that answers one of these is a guess until it is settled.',
          '',
          ...open.map((item) => `- ${item.entry} _(${item.meeting})_`),
        ].join('\n'),
  ].join('\n');
}

/* ---- The set ---- */

/**
 * The document set: one Markdown file per section, plus one per screen.
 *
 * One file was the wrong shape. The thing is read in pieces — somebody wants
 * the meeting notes, or the tests, or the one screen they are building — and a
 * single file makes every one of those a scroll through the other ten. Split,
 * each part is addressable: a path to send, a file to diff, a page an agent can
 * be pointed at without handing it the whole project.
 *
 * Numbered, because the order is part of the meaning: the project before the
 * round, the round before the screens, the tests after the thing they test.
 * `README.md` is the way in and lists the rest.
 */
export function versionReportFiles(report: VersionReport): ReportFile[] {
  const files: ReportFile[] = [];
  let n = 0;
  const add = (title: string, body: string): ReportFile => {
    n += 1;
    const file = { name: `${ordinal(n)}-${slug(title)}.md`, text: page(`${n}. ${title}`, body) };
    files.push(file);
    return file;
  };

  const project = add('The project', projectBody(report));
  const business = add('Business background', businessBody(report));
  const rounds = add('Rounds', roundsBody(report));
  const register = add('Tasks across the project', taskRegisterBody(report));
  const scope = add('This round', scopeBody(report));

  // One per screen, in a folder of their own — a dozen files at the top level
  // would bury the eight sections around them.
  n += 1;
  const specDir = `${ordinal(n)}-screens`;
  const specs = report.designs.map((design, index) => {
    const name = `${specDir}/${ordinal(index + 1)}-${slug(design.name)}.md`;
    return {
      file: { name, text: page(design.name, specBody(design)) },
      design,
    };
  });
  files.push(...specs.map((entry) => entry.file));

  const work = add('Work in this round', workBody(report));
  const tests = add('Acceptance tests', testsBody(report));
  const stack = add('The stack it runs on', stackBody(report));
  const decisions = add('Decisions and open questions', decisionsBody(report));

  // The index goes first in the archive and last in the building: it can only
  // list the files once they all have names.
  files.unshift({
    name: 'README.md',
    text: [
      `# ${report.projectName} — ${report.roundName}`,
      '',
      [
        `**Customer** ${report.customer}  `,
        `**Owner** ${report.owner}  `,
        `**Round** version ${report.version} · ${report.status}  `,
        `**Prepared** ${report.preparedOn}`,
      ].join('\n'),
      '',
      report.complete
        ? null
        : '> This round is still in progress. Everything here is the round as it stands today, not a record of what shipped.\n',
      report.summary,
      '',
      '## The set',
      '',
      `- [${project.name}](${project.name}) — customer, owner, stage, spend.`,
      `- [${business.name}](${business.name}) — every meeting, with notes, decisions and open questions in full.`,
      `- [${rounds.name}](${rounds.name}) — every round and where this one sits.`,
      `- [${register.name}](${register.name}) — every task on the board, one line each.`,
      `- [${scope.name}](${scope.name}) — what this round changes: screens, popups, flow.`,
      specs.length === 0
        ? `- \`${specDir}/\` — one file per screen. This round has none yet.`
        : `- \`${specDir}/\` — one file per screen, element by element:\n${specs
            .map((entry) => `  - [${entry.design.name}](${entry.file.name})`)
            .join('\n')}`,
      `- [${work.name}](${work.name}) — the round's tasks in detail, with everything each was worked from.`,
      `- [${tests.name}](${tests.name}) — what the build has to pass.`,
      `- [${stack.name}](${stack.name}) — the services it needs running.`,
      `- [${decisions.name}](${decisions.name}) — what is settled and what is not.`,
      '',
      '## Also in the archive',
      '',
      `- \`../${reportFileName(report, 'html')}\` — all of the above as one web page, for reading rather than working from.`,
      '- `../designs/` — every design in this round as a standalone html file. Each screen file above links to its own.',
      '',
      '## Reading order',
      '',
      'Files 1–4 are the project and where this round sits in it. 5 and the screens folder are what to build. 7 is the work, 8 is how it is verified, 9 is what it runs on, 10 is what is still undecided.',
    ]
      .filter((line) => line !== null)
      .join('\n')
      .concat('\n'),
  });

  return files;
}

/* ------------------------------------------------------------------ */
/* HTML                                                                */
/* ------------------------------------------------------------------ */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The same document as a standalone page.
 *
 * One file with its styles inline, because the point of the HTML form is that it
 * can be mailed, dropped on a share or opened from a disk — a stylesheet it has
 * to find would make it a page that only works where it was made.
 */
/**
 * One task as a card, with the material it was worked from.
 *
 * The same three lists the Markdown form carries, for the same reason: a reader
 * who was not in the room needs to know what the work was built against, and a
 * five-column table had nowhere to put it.
 */
function taskHtml(task: ReportTask): string {
  const refList = (title: string, items: string[]): string =>
    items.length === 0
      ? ''
      : `<p class="reflabel">${escapeHtml(title)}</p><ul class="refs">${items
          .map((item) => `<li>${item}</li>`)
          .join('')}</ul>`;

  return `<div class="task">
  <p class="taskhead"><code>${escapeHtml(task.code)}</code> <strong>${escapeHtml(task.title)}</strong></p>
  <p class="taskmeta">${escapeHtml(
    [
      task.assignee,
      `${PRIORITY_WORD[task.priority]} priority`,
      `verified by ${task.testedBy}`,
    ].join(' · '),
  )}</p>
  ${task.description ? `<p class="taskdesc">${escapeHtml(task.description)}</p>` : ''}
  ${refList(
    'Design references',
    task.designs.map(
      (design) =>
        `${escapeHtml(design.name)} — <code>${escapeHtml(design.fileName)}</code>${
          design.route ? ` <span class="src">${escapeHtml(design.route)}</span>` : ''
        }${design.note ? ` — ${escapeHtml(design.note)}` : ''}`,
    ),
  )}
  ${refList(
    'Reference files',
    task.files.map(
      (file) => `${escapeHtml(file.name)}${file.note ? ` — ${escapeHtml(file.note)}` : ''}`,
    ),
  )}
  ${refList(
    'Whiteboard',
    task.boards.map(
      (board) =>
        `${escapeHtml(board.title)}${board.caption ? ` — ${escapeHtml(board.caption)}` : ''}`,
    ),
  )}
  ${hasReferences(task) ? '' : '<p class="empty">Nothing attached.</p>'}
</div>`;
}

export function versionReportHtml(report: VersionReport): string {
  const { screens, popups } = screensFirst(report.designs);

  const row = (cells: (string | undefined)[]) =>
    `<tr>${cells.map((value) => `<td>${escapeHtml(value ?? '—')}</td>`).join('')}</tr>`;
  const head = (cells: string[]) =>
    `<tr>${cells.map((value) => `<th>${escapeHtml(value)}</th>`).join('')}</tr>`;

  const table = (headings: string[], rows: string[]) =>
    rows.length === 0
      ? ''
      : `<table><thead>${head(headings)}</thead><tbody>${rows.join('')}</tbody></table>`;

  const sections: string[] = [];

  if (!report.complete) {
    sections.push(
      `<p class="notice">This round is still in progress. Everything below is the round as it stands today, not a record of what shipped.</p>`,
    );
  }

  /* ---- The project ---- */

  const factRow = (label: string, value: string) =>
    `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;

  sections.push(
    `<div class="archive"><p><strong>What is in this archive</strong></p><ul>
  <li><code>${escapeHtml(reportFileName(report, 'html'))}</code> — this page: all of it in one place, for reading.</li>
  <li><a href="report/README.md"><code>report/</code></a> — the same content as Markdown, a file per section plus one per screen, for working from and for filing in a repository. Start at <code>README.md</code>.</li>
  <li><code>designs/</code> — every design in this round as a standalone html file. Every screen named below links to its own, and each of those links back here.</li>
</ul><p>It reads in order: <strong>1–4</strong> are the project and where this round sits in it, <strong>5–10</strong> are what to build, <strong>11</strong> is how it is verified, <strong>12</strong> is what it runs on, <strong>13–14</strong> are what is settled and what is not.</p></div>`,
  );

  sections.push(
    `<h2>1. The project</h2><p>${escapeHtml(report.summary)}</p><table class="facts"><tbody>${[
      factRow('Customer', report.customer),
      factRow('Owner', report.owner),
      factRow('Status', report.profile.status),
      factRow('Stage', report.profile.stage),
      report.profile.solution ? factRow('Live solution', report.profile.solution) : '',
      factRow('Rounds', String(report.rounds.length)),
      factRow('Designs in this round', String(report.designs.length)),
      factRow('Tasks on the board', String(report.allTasks.length)),
      factRow('Claude spend', `$${report.profile.spend.toFixed(2)}`),
    ].join('')}</tbody></table>`,
  );

  /* ---- Where it came from ---- */

  const bullets = (title: string, items: string[]) =>
    items.length === 0
      ? ''
      : `<p class="reflabel">${escapeHtml(title)}</p><ul class="refs">${items
          .map((entry) => `<li>${escapeHtml(entry)}</li>`)
          .join('')}</ul>`;

  sections.push(
    `<h2>2. Business background</h2>${
      report.meetings.length === 0
        ? '<p class="empty">No meetings recorded against this project.</p>'
        : `<p>Every conversation this project came out of, in the order they happened.</p>${report.meetings
            .map(
              (meeting) => `<div class="meeting">
  <h3>${escapeHtml(meeting.title)}</h3>
  <p class="taskmeta">${escapeHtml(meetingMeta(meeting))}</p>
  ${meeting.notes ? `<pre class="notes">${escapeHtml(meeting.notes)}</pre>` : ''}
  ${bullets('Decided', meeting.decisions)}
  ${bullets('Left open', meeting.openQuestions)}
  ${bullets(
    'Designs it produced',
    meeting.screens.map((screen) => `${screen.name}${screen.route ? ` — ${screen.route}` : ''}`),
  )}
</div>`,
            )
            .join('')}`
    }`,
  );

  /* ---- Where the round sits ---- */

  sections.push(
    `<h2>3. Rounds</h2>${
      report.rounds.length === 0
        ? '<p class="empty">No rounds opened yet.</p>'
        : `${table(
            ['Round', 'Version', 'Status', 'Designs', 'Tasks'],
            report.rounds.map(
              (round) =>
                `<tr${round.current ? ' class="current"' : ''}><td>${escapeHtml(round.name)}</td><td>${
                  round.version
                }</td><td>${escapeHtml(round.status)}</td><td>${round.designs}</td><td>${round.tasks}</td></tr>`,
            ),
          )}<p class="src">The highlighted round is the one this document is about.</p>`
    }`,
  );

  sections.push(
    `<h2>4. Tasks across the project</h2>${
      report.allTasks.length === 0
        ? '<p class="empty">No tasks on the board.</p>'
        : `<p>Every task on the board, whichever round it belongs to. The ones in this round are written out in full further down.</p>${table(
            ['Code', 'Task', 'Round', 'Status', 'Assignee'],
            report.allTasks.map((task) =>
              row([task.code, task.title, task.round, task.status, task.assignee]),
            ),
          )}`
    }`,
  );

  /* ---- The round itself ---- */

  sections.push(`<h2>5. Scope of this round</h2><p>${escapeHtml(scopeLine(report))}</p>`);

  // The name is the link. A table of screens in an archive that contains those
  // screens should open them — printing the path as text made the reader go
  // looking through a folder for a file the document already knew the name of.
  const linkedName = (design: ReportDesign) =>
    `<a href="${designHref(design)}">${escapeHtml(design.name)}</a>`;

  sections.push(
    `<h2>6. Screens</h2>${
      screens.length === 0
        ? '<p class="empty">No screens in this round.</p>'
        : table(
            ['Screen', 'Route', 'Change', 'Folder'],
            screens.map(
              (design) =>
                `<tr><td>${linkedName(design)}</td><td>${escapeHtml(design.route ?? '—')}</td><td>${escapeHtml(
                  CHANGE_WORD[design.change],
                )}</td><td>${escapeHtml(design.folder ?? '—')}</td></tr>`,
            ),
          )
    }`,
  );

  sections.push(
    `<h2>7. Popups</h2>${
      popups.length === 0
        ? '<p class="empty">No popups in this round.</p>'
        : `<p>These open over a screen rather than at an address of their own.</p>${table(
            ['Popup', 'Change', 'Folder'],
            popups.map(
              (design) =>
                `<tr><td>${linkedName(design)}</td><td>${escapeHtml(CHANGE_WORD[design.change])}</td><td>${escapeHtml(
                  design.folder ?? '—',
                )}</td></tr>`,
            ),
          )}`
    }`,
  );

  sections.push(
    `<h2>8. Flow</h2>${
      screens.length === 0
        ? '<p class="empty">Nothing to walk through yet.</p>'
        : `<ol class="flow">${screens
            .map(
              (design) =>
                `<li><strong>${linkedName(design)}</strong>${
                  design.route ? ` <code>${escapeHtml(design.route)}</code>` : ''
                }</li>`,
            )
            .join('')}</ol>${
            popups.length === 0
              ? ''
              : `<p>Opening over them: ${escapeHtml(popups.map((design) => design.name).join(', '))}.</p>`
          }`
    }`,
  );

  /* ---- What to build ---- */

  sections.push(
    `<h2>9. Screen specifications</h2>${
      report.designs.length === 0
        ? '<p class="empty">Nothing drawn in this round yet.</p>'
        : `<p>Each design, element by element, in the order it is drawn. The matching html file is in <code>designs/</code> — this is the same screen written down, so it can be built without reading the markup back.</p>${report.designs
            .map(
              (design) => `<div class="spec">
  <h3>${escapeHtml(design.name)}</h3>
  <p class="taskmeta">${escapeHtml(
    [
      design.route ?? 'No route — opens over a screen',
      design.surface === 'popup' ? 'Popup' : 'Screen',
      CHANGE_WORD[design.change],
      design.folder ? `in ${design.folder}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  )} · <a href="${designHref(design)}"><code>${escapeHtml(`${design.folder ? `${design.folder}/` : ''}${design.fileName}`)}</code></a></p>
  ${
    design.blocks.length === 0
      ? '<p class="empty">This canvas is empty.</p>'
      : table(
          ['#', 'Element', 'Label', 'Detail'],
          design.blocks.map((block, index) =>
            row([String(index + 1), block.kind, block.label, block.detail]),
          ),
        )
  }
</div>`,
            )
            .join('')}`
    }`,
  );

  sections.push(
    `<h2>10. Work in this round</h2>${
      report.tasks.length === 0
        ? '<p class="empty">No tasks filed against this round.</p>'
        : tasksByStatus(report.tasks)
            .map(
              ({ status, tasks }) =>
                `<h3>${escapeHtml(status)} (${tasks.length})</h3>${tasks
                  .map((task) => taskHtml(task))
                  .join('')}`,
            )
            .join('')
    }`,
  );

  /* ---- What is settled and what is not ---- */

  const list = (
    items: { meeting: string; entry: string }[],
    empty: string,
    lead?: string,
  ): string =>
    items.length === 0
      ? `<p class="empty">${escapeHtml(empty)}</p>`
      : `${lead ? `<p>${escapeHtml(lead)}</p>` : ''}<ul>${items
          .map(
            (item) =>
              `<li>${escapeHtml(item.entry)} <span class="src">${escapeHtml(item.meeting)}</span></li>`,
          )
          .join('')}</ul>`;

  /* ---- How it is verified, and what it runs on ---- */

  sections.push(
    `<h2>11. Acceptance tests</h2>${
      report.tests.length === 0
        ? '<p class="empty">No test cases written yet.</p>'
        : `<p>What the build has to pass. Steps and expected result in full — this is the half of the document that says when the work is done.</p>${report.tests
            .map(
              (test) => `<div class="task">
  <p class="taskhead"><code>${escapeHtml(test.code)}</code> <strong>${escapeHtml(test.title)}</strong></p>
  <p class="taskmeta">${escapeHtml([test.module, test.type, `${test.priority} priority`, test.status].filter(Boolean).join(' · '))}</p>
  ${test.description ? `<p class="taskdesc">${escapeHtml(test.description)}</p>` : ''}
  ${test.precondition ? `<p class="taskdesc"><strong>Given</strong> ${escapeHtml(test.precondition)}</p>` : ''}
  ${
    test.steps.length === 0
      ? ''
      : `<p class="reflabel">Steps</p><ol class="refs">${test.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`
  }
  <p class="taskdesc"><strong>Expected</strong> ${escapeHtml(test.expected)}</p>
  ${
    test.linkedTask || test.linkedDesign
      ? `<p class="src">Covers ${escapeHtml([test.linkedTask, test.linkedDesign].filter(Boolean).join(' · '))}</p>`
      : ''
  }
</div>`,
            )
            .join('')}`
    }`,
  );

  sections.push(
    `<h2>12. The stack it runs on</h2>${
      report.stack.services.length === 0
        ? '<p class="empty">No environment analysed.</p>'
        : `<p>Compose project <code>${escapeHtml(report.stack.name)}</code>. Listed in boot order — dependencies first, the app that needs them last.</p>${table(
            ['Service', 'Role', 'Image', 'Ports', 'Where it came from'],
            report.stack.services.map((service) =>
              row([
                service.id,
                service.role,
                service.image,
                service.ports.join(', '),
                service.source,
              ]),
            ),
          )}<ul>${report.stack.services
            .map(
              (service) =>
                `<li><strong>${escapeHtml(service.id)}</strong> — ${escapeHtml(service.note)}</li>`,
            )
            .join('')}</ul>`
    }`,
  );

  sections.push(
    `<h2>13. Decisions</h2>${list(
      report.meetings.flatMap((meeting) =>
        meeting.decisions.map((entry) => ({ meeting: meeting.title, entry })),
      ),
      'Nothing recorded.',
      'Gathered from every meeting above, so the rulings can be read without the discussion around them.',
    )}`,
  );

  sections.push(
    `<h2>14. Still open</h2>${list(
      report.meetings.flatMap((meeting) =>
        meeting.openQuestions.map((entry) => ({ meeting: meeting.title, entry })),
      ),
      'Nothing outstanding.',
      'A design that answers one of these is a guess until it is settled.',
    )}`,
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(`${report.projectName} — ${report.roundName}`)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto; padding: 3rem 1.5rem 5rem; max-width: 52rem;
    font: 400 15px/1.65 system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #111827; background: #fff;
  }
  h1 { font-size: 1.6rem; letter-spacing: -0.02em; margin: 0 0 .5rem; }
  h2 { font-size: 1.05rem; margin: 2.5rem 0 .75rem; padding-bottom: .35rem; border-bottom: 1px solid #e5e7eb; }
  h3 { font-size: .9rem; margin: 1.5rem 0 .5rem; color: #374151; }
  .meta { color: #6b7280; font-size: .8125rem; margin: 0 0 2rem; }
  .meta b { color: #111827; font-weight: 600; }
  .notice { background: #fffbeb; border: 1px solid #fde68a; border-radius: .5rem; padding: .75rem 1rem; font-size: .8125rem; }
  table { width: 100%; border-collapse: collapse; font-size: .8125rem; margin: .5rem 0 0; }
  th { text-align: left; font-weight: 600; color: #6b7280; font-size: .6875rem; text-transform: uppercase; letter-spacing: .05em; padding: .4rem .5rem; border-bottom: 1px solid #e5e7eb; }
  td { padding: .45rem .5rem; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  code { font: 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; background: #f3f4f6; padding: .15rem .3rem; border-radius: .25rem; }
  ol.flow { padding-left: 1.25rem; }
  ol.flow li { margin: .3rem 0; }
  ul { padding-left: 1.15rem; }
  li { margin: .3rem 0; }
  .src { color: #9ca3af; font-size: .75rem; }
  .task { border: 1px solid #e5e7eb; border-radius: .625rem; padding: .85rem 1rem; margin: .6rem 0 0; }
  .taskhead { margin: 0; font-size: .875rem; }
  .taskmeta { margin: .2rem 0 0; color: #6b7280; font-size: .75rem; }
  .taskdesc { margin: .6rem 0 0; font-size: .8125rem; }
  .reflabel { margin: .7rem 0 .15rem; font-size: .6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; }
  ul.refs { margin: 0; padding-left: 1.15rem; font-size: .8125rem; }
  ul.refs li { margin: .15rem 0; }
  .empty { color: #9ca3af; font-style: italic; font-size: .8125rem; }
  table.facts th { text-transform: none; letter-spacing: 0; font-size: .8125rem; color: #6b7280; width: 12rem; vertical-align: top; border-bottom: 1px solid #f3f4f6; }
  .meeting, .spec { border: 1px solid #e5e7eb; border-radius: .625rem; padding: .85rem 1rem; margin: .8rem 0 0; }
  .spec h3 { margin: 0; }
  .archive { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: .625rem; padding: .5rem 1rem .85rem; font-size: .8125rem; }
  .archive p { margin: .5rem 0; }
  .meeting h3 { margin: 0; }
  /* The notes are minuted as they were typed — the line breaks are part of what
     they say, so they are preserved rather than reflowed into a paragraph. */
  pre.notes { margin: .6rem 0 0; padding: .6rem .75rem; background: #f9fafb; border-radius: .375rem; font: 400 .8125rem/1.6 inherit; white-space: pre-wrap; }
  tr.current td { background: #eff6ff; font-weight: 600; }
  @media (prefers-color-scheme: dark) {
    body { color: #e5e7eb; background: #0b0f16; }
    h1, .meta b { color: #f9fafb; }
    h2 { border-color: #1f2937; }
    h3 { color: #d1d5db; }
    th { border-color: #1f2937; }
    td { border-color: #111827; }
    .task { border-color: #1f2937; }
    .taskmeta, .reflabel { color: #9ca3af; }
    code { background: #111827; }
    .notice { background: #2a2109; border-color: #78350f; }
    .meeting, .spec { border-color: #1f2937; }
    .archive { background: #0f151f; border-color: #1f2937; }
    pre.notes { background: #0f151f; }
    table.facts th { color: #9ca3af; border-color: #111827; }
    tr.current td { background: #10243f; }
  }
</style>
</head>
<body>
<h1>${escapeHtml(`${report.projectName} — ${report.roundName}`)}</h1>
<p class="meta">
  <b>Customer</b> ${escapeHtml(report.customer)} &nbsp;·&nbsp;
  <b>Owner</b> ${escapeHtml(report.owner)} &nbsp;·&nbsp;
  <b>Round</b> version ${report.version} · ${escapeHtml(report.status)} &nbsp;·&nbsp;
  <b>Prepared</b> ${escapeHtml(report.preparedOn)}
</p>
${sections.join('\n')}
</body>
</html>
`;
}

/* ------------------------------------------------------------------ */
/* Handing it over                                                     */
/* ------------------------------------------------------------------ */

/** One design of the round, as a file to put in the archive. */
export interface ReportDesignFile {
  /** File name as the explorer shows it, e.g. `01-login.html`. */
  fileName: string;
  /** Folder inside the round, when it sits in one. */
  folder?: string;
  html: string;
}

/**
 * The whole round in one zip: the document, and the designs it describes.
 *
 * A report on its own is a description of files the reader does not have. The
 * point of a hand-off is that they can open the screens, so the round's designs
 * travel with it — under `designs/`, in the folders the round organised them
 * into, so the archive has the shape the explorer showed.
 *
 * Both forms of the document go in rather than being offered as a choice: the
 * HTML is one page for the person reading it, and `report/` is the same content
 * split a file per section for the repository it gets filed in — a hand-off
 * usually wants both, and they are wanted for different things.
 *
 * Browser-only — the download is the whole point.
 */
/**
 * Build the PRD markdown from the report — project summary, meetings, and
 * decisions rolled into one product-requirements document.
 */
function buildPrd(report: VersionReport): string {
  const lines: string[] = [
    `# PRD — ${report.projectName}`,
    '',
    `**Customer:** ${report.customer}  `,
    `**Owner:** ${report.owner}  `,
    `**Round:** ${report.roundName} (v${report.version})  `,
    `**Status:** ${report.status}  `,
    `**Prepared:** ${report.preparedOn}`,
    '',
    '## Summary',
    '',
    report.summary || '_No summary._',
    '',
    '## Business Background',
    '',
  ];
  if (report.meetings.length === 0) {
    lines.push('_No meetings recorded._');
  } else {
    for (const meeting of report.meetings) {
      lines.push(`### ${meeting.title}`, '', `_${meetingMeta(meeting)}_`);
      if (meeting.notes) lines.push('', ...meeting.notes.split('\n').map((l) => `> ${l}`));
      if (meeting.decisions.length > 0) {
        lines.push('', '**Decisions**', '', ...meeting.decisions.map((d) => `- ${d}`));
      }
      if (meeting.openQuestions.length > 0) {
        lines.push('', '**Open Questions**', '', ...meeting.openQuestions.map((q) => `- ${q}`));
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

/**
 * Build the FRD markdown — functional requirements derived from designs and
 * tasks: what each screen does and what work is filed against the round.
 */
function buildFrd(report: VersionReport): string {
  const { screens, popups } = screensFirst(report.designs);
  const lines: string[] = [
    `# FRD — ${report.projectName} · ${report.roundName}`,
    '',
    scopeLine(report),
    '',
    '## Screens',
    '',
  ];
  if (screens.length === 0) {
    lines.push('_No screens in this round._');
  } else {
    for (const design of screens) {
      lines.push(
        `### ${design.name}`,
        '',
        `Route: \`${design.route ?? '—'}\` · ${CHANGE_WORD[design.change]}${design.folder ? ` · ${design.folder}` : ''}`,
        '',
      );
      if (design.blocks.length > 0) {
        lines.push('| # | Element | Label | Detail |', '| --- | --- | --- | --- |');
        for (const [i, b] of design.blocks.entries()) {
          lines.push(`| ${i + 1} | ${cell(b.kind)} | ${cell(b.label)} | ${cell(b.detail)} |`);
        }
      } else {
        lines.push('_Empty canvas._');
      }
      lines.push('');
    }
  }
  if (popups.length > 0) {
    lines.push('## Popups', '');
    for (const design of popups) {
      lines.push(`### ${design.name}`, '', `${CHANGE_WORD[design.change]}${design.folder ? ` · ${design.folder}` : ''}`, '');
    }
  }
  lines.push('## Tasks', '');
  if (report.tasks.length === 0) {
    lines.push('_No tasks filed against this round._');
  } else {
    for (const task of report.tasks) {
      lines.push(taskMarkdown(task), '');
    }
  }
  return lines.join('\n');
}

/**
 * Build the IA structure markdown — the design hierarchy and flow.
 */
function buildIaStructure(report: VersionReport): string {
  const { screens, popups } = screensFirst(report.designs);
  const lines: string[] = [
    `# IA Structure — ${report.projectName} · ${report.roundName}`,
    '',
    '## Screen Map',
    '',
  ];
  if (screens.length === 0) {
    lines.push('_No screens._');
  } else {
    lines.push('| # | Screen | Route | Status | Folder |', '| --- | --- | --- | --- | --- |');
    for (const [i, d] of screens.entries()) {
      lines.push(`| ${i + 1} | ${cell(d.name)} | ${cell(d.route)} | ${cell(d.status)} | ${cell(d.folder)} |`);
    }
  }
  if (popups.length > 0) {
    lines.push('', '## Popups', '', '| Popup | Status | Folder |', '| --- | --- | --- |');
    for (const d of popups) {
      lines.push(`| ${cell(d.name)} | ${cell(d.status)} | ${cell(d.folder)} |`);
    }
  }
  lines.push('', '## Navigation Flow', '');
  if (screens.length > 0) {
    for (const [i, d] of screens.entries()) {
      lines.push(`${i + 1}. **${d.name}**${d.route ? ` — \`${d.route}\`` : ''}`);
    }
    if (popups.length > 0) {
      lines.push('', `Popups: ${popups.map((d) => d.name).join(', ')}`);
    }
  }
  return lines.join('\n');
}

/**
 * Build the task history markdown.
 */
function buildTaskHistory(report: VersionReport): string {
  const lines: string[] = [
    `# Task History — ${report.projectName}`,
    '',
    `**Round:** ${report.roundName} (v${report.version})  `,
    `**Prepared:** ${report.preparedOn}`,
    '',
  ];
  if (report.allTasks.length === 0) {
    lines.push('_No tasks on the board._');
  } else {
    lines.push('| Code | Task | Round | Status | Assignee |', '| --- | --- | --- | --- | --- |');
    for (const t of report.allTasks) {
      lines.push(`| \`${cell(t.code)}\` | ${cell(t.title)} | ${cell(t.round)} | ${cell(t.status)} | ${cell(t.assignee)} |`);
    }
  }
  if (report.tests.length > 0) {
    lines.push('', '## Acceptance Tests', '');
    for (const test of report.tests) {
      lines.push(`### ${test.code} — ${test.title}`, '');
      lines.push([test.module, test.type, `${test.priority} priority`, test.status].filter(Boolean).join(' · '));
      if (test.description) lines.push('', test.description);
      if (test.steps.length > 0) {
        lines.push('', '**Steps**', '', ...test.steps.map((s, i) => `${i + 1}. ${s}`));
      }
      lines.push('', `**Expected:** ${test.expected}`, '');
    }
  }
  return lines.join('\n');
}

/**
 * Export file name: `weplanner-export-v{version}.zip`
 */
function exportZipName(report: VersionReport): string {
  const slug = report.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `weplanner-export-${slug}-v${report.version}.zip`;
}

export function downloadReportBundle(
  report: VersionReport,
  designs: ReportDesignFile[],
  at: Date = new Date(),
): void {
  const blob = zipBlob(
    [
      // /html/ — design HTML files
      ...designs.map((design) => ({
        name: `html/${design.folder ? `${design.folder}/` : ''}${design.fileName}`,
        text: withBackLink(design.html, '../', report.roundName),
      })),
      // /prd/PRD.md
      { name: 'prd/PRD.md', text: buildPrd(report) },
      // /frd/FRD.md
      { name: 'frd/FRD.md', text: buildFrd(report) },
      // /ia/structure.md
      { name: 'ia/structure.md', text: buildIaStructure(report) },
      // /tasks/history.md
      { name: 'tasks/history.md', text: buildTaskHistory(report) },
      // Full HTML report at root for easy viewing
      { name: reportFileName(report, 'html'), text: versionReportHtml(report) },
    ],
    at,
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportZipName(report);
  link.click();
  URL.revokeObjectURL(url);
}

/** Opens the HTML form in a tab, for a look before it is filed anywhere. */
export function openReportHtml(report: VersionReport): void {
  const blob = new Blob([versionReportHtml(report)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Not revoked immediately: the new tab has to fetch it first.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
