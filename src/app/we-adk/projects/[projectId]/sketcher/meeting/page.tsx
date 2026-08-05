'use client';

import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  GitMerge,
  HelpCircle,
  LayoutTemplate,
  Loader2,
  NotebookPen,
  Paperclip,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@/components/ui';
import { useLocale } from '@/lib/locale';
import { ChatPane, type ChatTurn } from '@/components/we-adk/claude-chat';
import { MeetingFileIcon } from '@/components/we-adk/meeting-files';
import { ResearchText } from '@/components/we-adk/research-text';
import { businessCanvasHref, previewHref } from '@/components/we-adk/mockup-board';
import { StatusChip } from '@/components/we-adk/status-chip';
import {
  formatFileSize,
  loadUploadedFiles,
  mergeReferenceText,
  sessionFiles,
  type MeetingFile,
} from '@/lib/we-adk-mock/meeting-files';
import { findProject, relativeUpdated, type DesignProject } from '@/lib/we-adk-mock/projects';
import {
  addBlankDesign,
  loadGeneratedScreens,
  materialiseGeneratedScreens,
  type SketchScreen,
  type SketchSession,
} from '@/lib/we-adk-mock/sketches';
import { type Chip } from '@/lib/we-adk-mock/types';
import {
  BASELINE_VERSION,
  FIRST_EDITABLE_VERSION,
  isVersionLocked,
  loadVersionCount,
  loadVersionStatuses,
  saveVersionCount,
  versionFolderId,
  versionFolderKey,
  type VersionStatuses,
} from '@/lib/we-adk-mock/versions';
import { type GeneratedScreen } from '@/lib/we-adk/sketcher-operations';

/** Settled once nothing was left hanging; otherwise it says how much is open. */
function meetingStatus(session: SketchSession): Chip {
  const open = session.openQuestions?.length ?? 0;
  return open > 0 ? { label: `${open} open`, tone: 'amber' } : { label: 'Settled', tone: 'green' };
}

function initials(attendees: string): string {
  const first = attendees.split(',')[0]?.trim() ?? '?';
  const word = first.replace(/\(.*?\)/g, '').trim();
  return (word[0] ?? '?').toUpperCase();
}

const MEETING_CHAT_KEY = 'we-adk:meeting-chat';

function loadMeetingTurns(projectId: string, sessionId: string): ChatTurn[] {
  try {
    const raw = window.localStorage.getItem(`${MEETING_CHAT_KEY}:${projectId}:${sessionId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatTurn[]) : [];
  } catch {
    return [];
  }
}

function saveMeetingTurns(projectId: string, sessionId: string, turns: ChatTurn[]): void {
  try {
    window.localStorage.setItem(
      `${MEETING_CHAT_KEY}:${projectId}:${sessionId}`,
      JSON.stringify(turns.slice(-40)),
    );
  } catch {
    // Storage unavailable — the conversation just won't survive a reload.
  }
}

/** Everything this meeting knows, for the chat pinned under it. */
function meetingChatContext(
  project: DesignProject,
  session: SketchSession,
  files: MeetingFile[],
  screens: SketchScreen[],
): string {
  const parts = [
    `Project: ${project.name} — ${project.customer}.`,
    `Meeting: "${session.title}" (${session.metAt}${session.kind ? `, ${session.kind}` : ''}).`,
    `Attendees: ${session.attendees}.`,
    '',
    'Notes:',
    session.notes,
  ];
  if (session.decisions?.length) {
    parts.push('', 'Decided:', ...session.decisions.map((entry) => `- ${entry}`));
  }
  if (session.openQuestions?.length) {
    parts.push('', 'Still open:', ...session.openQuestions.map((entry) => `- ${entry}`));
  }
  if (screens.length > 0) {
    parts.push(
      '',
      'Designs from this meeting:',
      ...screens.map(
        (screen) => `- ${screen.name} (${screen.route ?? 'no route'}, ${screen.status.label})`,
      ),
    );
  }
  const merged = mergeReferenceText(files, 6_000);
  if (merged.text) parts.push('', 'Reference files:', merged.text);
  return parts.join('\n').slice(0, 14_000);
}

/** Meeting notes read as prose — bullet lines become a list, the rest paragraphs. */
function NotesText({ lines }: { lines: string[] }) {
  const blocks: ({ type: 'para'; text: string } | { type: 'list'; items: string[] })[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-•]\s+(.*)$/.exec(line);
    if (bullet) {
      const last = blocks.at(-1);
      if (last?.type === 'list') last.items.push(bullet[1] ?? '');
      else blocks.push({ type: 'list', items: [bullet[1] ?? ''] });
    } else {
      blocks.push({ type: 'para', text: line });
    }
  }
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, index) =>
        block.type === 'list' ? (
          <ul key={index} className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={index} className="text-sm leading-relaxed">
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}

/** Notes are long; the panel opens on the first few lines like a feed post does. */
const NOTE_PREVIEW_LINES = 4;

/**
 * What the meeting produced, in one strip under the gist. The avatar and the
 * chevron stay out of it, so it wraps inside the narrow index column.
 */
function MeetingMeta({
  session,
  decisions,
  open,
  designs,
  references,
}: {
  session: SketchSession;
  decisions: number;
  open: number;
  designs: number;
  references: number;
}) {
  return (
    <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
      <span className="flex items-center gap-1" title={session.attendees}>
        <Users className="size-3" />
        {session.attendees.split(',').length} attendees
      </span>
      {session.durationMin && (
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {session.durationMin} min
        </span>
      )}
      <span className="flex items-center gap-1">
        <Check className="size-3" />
        {decisions} decided
      </span>
      {open > 0 && (
        <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
          <HelpCircle className="size-3" />
          {open} open
        </span>
      )}
      <span className="flex items-center gap-1">
        <LayoutTemplate className="size-3" />
        {designs} design{designs === 1 ? '' : 's'}
      </span>
      {references > 0 && (
        <span className="flex items-center gap-1">
          <Paperclip className="size-3" />
          {references}
        </span>
      )}
    </span>
  );
}

/**
 * As real a download as a mockup allows: links open their target, files with
 * extracted text download it as text, and anything else has nothing to give.
 */
function downloadFile(file: MeetingFile): void {
  if (file.url) {
    window.open(file.url, '_blank', 'noreferrer');
    return;
  }
  if (!file.text) return;
  const blob = new Blob([file.text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${file.name}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadTitle(file: MeetingFile): string {
  if (file.url) return 'Open the link target';
  if (file.text) return 'Download the extracted text';
  return 'Nothing downloadable — the mockup keeps no file contents';
}

/** A file opened from the meeting, previewed beside it. */
function FilePreviewPanel({
  project,
  file,
  meeting,
  onClose,
}: {
  project: DesignProject;
  file: MeetingFile;
  meeting: string;
  onClose: () => void;
}) {
  const { t } = useLocale();
  return (
    <aside className="bg-background flex w-[24rem] shrink-0 flex-col border-l xl:w-[28rem]">
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5">
        <MeetingFileIcon kind={file.kind} />
        <p className="min-w-0 flex-1 truncate font-mono text-sm">{file.name}</p>
        <button
          type="button"
          onClick={() => downloadFile(file)}
          disabled={!file.text && !file.url}
          title={downloadTitle(file)}
          aria-label={`Download ${file.name}`}
          className="text-muted-foreground hover:text-foreground shrink-0 rounded-md p-1 disabled:opacity-40"
        >
          <Download className="size-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('meeting.closePreview')}
          className="text-muted-foreground hover:text-foreground shrink-0 rounded-md p-1"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="text-muted-foreground text-xs">
          {meeting} · {file.uploadedBy} · {file.uploadedAt}
          {file.sizeKb ? ` · ${formatFileSize(file.sizeKb)}` : ''}
        </p>
        {file.note && (
          <p className="bg-muted/40 text-muted-foreground mt-3 rounded-md border px-3 py-2 text-xs leading-relaxed">
            {file.note}
          </p>
        )}
        {file.url && (
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className="text-primary mt-3 flex w-fit items-center gap-1.5 text-xs hover:underline"
          >
            <ExternalLink className="size-3" />
            {file.url}
          </a>
        )}
        <div className="mt-4 border-t pt-4">
          {file.text ? (
            <ResearchText text={file.text} />
          ) : (
            <p className="text-muted-foreground text-sm">
              No text to preview — this {file.kind === 'link' ? 'link' : 'file'} keeps only its name
              in the mockup.
            </p>
          )}
        </div>
        <Link
          href={`/we-adk/projects/${project.id}/sketcher/research?file=${file.id}`}
          className="text-muted-foreground mt-5 inline-flex items-center gap-1 text-xs hover:underline"
        >
          <ExternalLink className="size-3" />
          Open in Research
        </Link>
      </div>
    </aside>
  );
}

function MeetingDetail({
  project,
  session,
  index,
  screens,
  files,
  onPreview,
  onClose,
  onScreenGenerated,
}: {
  project: DesignProject;
  session: SketchSession;
  index: number;
  screens: SketchScreen[];
  files: MeetingFile[];
  onPreview: (file: MeetingFile) => void;
  onClose: () => void;
  onScreenGenerated: (sessionId: string, screens: SketchScreen[]) => void;
}) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [savedTurns, setSavedTurns] = useState<ChatTurn[]>([]);

  // Generate panel state
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateNotes, setGenerateNotes] = useState(session.notes);
  const [generating, setGenerating] = useState(false);
  const [genElapsed, setGenElapsed] = useState(0);
  const [genMsg, setGenMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Promote-to-version state
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [versionCount, setVersionCount] = useState(BASELINE_VERSION);
  /** Which rounds have shipped — a released one takes no new designs. */
  const [versionStatuses, setVersionStatuses] = useState<VersionStatuses>({});

  const merged = mergeReferenceText(files, 6_000);

  useEffect(() => {
    setExpanded(false);
    setSavedTurns(loadMeetingTurns(project.id, session.id));
    setShowGenerate(false);
    setGenerateNotes(session.notes);
    setGenMsg(null);
    setPromotingId(null);
    setVersionCount(loadVersionCount(project.id));
    setVersionStatuses(loadVersionStatuses(project.id));
  }, [project.id, session.id]);

  useEffect(() => {
    if (!generating) return;
    setGenElapsed(0);
    const timer = window.setInterval(() => setGenElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [generating]);

  const generateDesigns = async () => {
    if (generating || generateNotes.trim().length < 20) return;
    setGenerating(true);
    setGenMsg(null);
    try {
      const response = await fetch('/api/sketcher/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: generateNotes,
          customer: project.customer,
          sessionTitle: session.title,
          maxScreens: 4,
          ...(merged.used.length > 0
            ? { references: merged.text, referenceNames: merged.unreadable.map((f) => f.name) }
            : {}),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const err =
          typeof payload === 'object' &&
          payload !== null &&
          typeof (payload as { error?: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : `Request failed (${response.status}).`;
        setGenMsg({ kind: 'error', text: err });
        return;
      }
      const data = payload as { reply?: string; screens?: GeneratedScreen[] } | null;
      const proposals = data?.screens ?? [];
      if (proposals.length === 0) {
        setGenMsg({ kind: 'error', text: 'Claude proposed no screens from those notes.' });
        return;
      }
      const created = materialiseGeneratedScreens(
        session.id,
        proposals.map((s) => ({ name: s.name, route: s.route, blocks: s.blocks })),
        new Date().toISOString().slice(0, 10),
      );
      onScreenGenerated(session.id, created);
      setGenMsg({
        kind: 'ok',
        text: `${data?.reply ?? 'Done.'} Added ${created.length} design${created.length === 1 ? '' : 's'}.`,
      });
      setShowGenerate(false);
    } catch {
      setGenMsg({ kind: 'error', text: 'Could not reach the generator (/api/sketcher/generate).' });
    } finally {
      setGenerating(false);
    }
  };

  /** Copy a design to an editable version folder so it appears in the sketcher workspace. */
  const promoteToVersion = (screen: SketchScreen, targetVersion: number) => {
    // A released round takes no new designs, whichever door they arrive by.
    if (isVersionLocked(targetVersion, loadVersionStatuses(project.id))) {
      setPromotingId(null);
      setGenMsg({
        kind: 'error',
        text: `version ${targetVersion} has been released — pick a round that is still open.`,
      });
      return;
    }
    // Ensure the version exists by bumping the counter if needed.
    if (targetVersion > versionCount) {
      saveVersionCount(project.id, targetVersion);
      setVersionCount(targetVersion);
    }
    const key = versionFolderKey(project.id, targetVersion);
    addBlankDesign(
      key,
      { name: screen.name, route: screen.route, seedPattern: screen.seedPattern },
      new Date().toISOString().slice(0, 10),
    );
    setPromotingId(null);
    setGenMsg({
      kind: 'ok',
      text: `"${screen.name}" added to version ${targetVersion} in your design workspace.`,
    });
  };

  // Rounds a design can be promoted into: the ones still open. A released round
  // is not offered, so the only thing the picker can do is legal.
  const highestVersion = Math.max(versionCount, FIRST_EDITABLE_VERSION);
  const versionOptions = Array.from(
    { length: highestVersion - BASELINE_VERSION },
    (_, i) => FIRST_EDITABLE_VERSION + i,
  ).filter((version) => !isVersionLocked(version, versionStatuses));

  const lines = session.notes.split('\n');
  const clipped = lines.length > NOTE_PREVIEW_LINES;
  const shown = expanded ? lines : lines.slice(0, NOTE_PREVIEW_LINES);
  const boardHref = `/we-adk/projects/${project.id}/sketcher/board?session=${session.id}`;
  const status = meetingStatus(session);

  return (
    <section className="bg-background flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5">
        <span className="bg-primary/80 size-2.5 shrink-0 rounded-sm" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{session.title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('meeting.closePanel')}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* ChatPane owns the scroll and pins the composer; the meeting document
          rides above the conversation as its context. */}
      <ChatPane
        project={project}
        contextText={meetingChatContext(project, session, files, screens)}
        folderLabel={`meeting/${session.title} (${session.metAt})`}
        initialTurns={savedTurns}
        onPersist={(turns) => saveMeetingTurns(project.id, session.id, turns)}
      >
        <div className="mx-auto w-full max-w-5xl pb-2">
          <div className="flex items-start gap-3 px-4 pt-4">
            <span
              aria-hidden
              className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            >
              {initials(session.attendees)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{project.owner}</p>
              <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                {session.metAt}
                {session.durationMin ? ` · ${session.durationMin} min` : ''}
                <Users className="size-3" />
              </p>
            </div>
            <Link
              href={boardHref}
              className="text-primary shrink-0 text-xs font-medium hover:underline"
            >
              Go to the board
            </Link>
          </div>

          <div className="flex items-start justify-between gap-2 px-4 pt-4">
            <h2 className="text-lg font-semibold">{session.title}</h2>
            <Badge variant="outline" className="mt-1 shrink-0 font-mono text-[10px]">
              Meeting #{String(index + 1).padStart(2, '0')}
            </Badge>
          </div>

          <dl className="flex flex-col gap-2.5 px-4 pt-4 text-sm">
            <div className="flex items-center gap-4">
              <dt className="text-muted-foreground w-20 shrink-0 text-xs">Status</dt>
              <dd>
                <StatusChip {...status} />
              </dd>
            </div>
            <div className="flex items-center gap-4">
              <dt className="text-muted-foreground w-20 shrink-0 text-xs">Kind</dt>
              <dd className="text-xs">{session.kind ?? 'Meeting'}</dd>
            </div>
            <div className="flex items-start gap-4">
              <dt className="text-muted-foreground w-20 shrink-0 text-xs">Attendees</dt>
              <dd className="min-w-0 flex-1 text-xs">{session.attendees}</dd>
            </div>
          </dl>

          <div className="px-4 pt-4">
            <p className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[11px] font-medium">
              <NotebookPen className="size-3" />
              Notes
            </p>
            <NotesText lines={shown} />
            {clipped && (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="text-muted-foreground hover:text-foreground mt-1.5 flex items-center gap-1 text-xs font-medium"
              >
                {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          {/* The wide pane fits the checklist and the designs side by side. */}
          <div className="mt-4 grid border-t xl:grid-cols-2 xl:divide-x">
            <div className="px-4 py-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium">
                <Check className="size-3.5" />
                Decisions &amp; questions
                <span className="text-muted-foreground">
                  {(session.decisions?.length ?? 0) + (session.openQuestions?.length ?? 0)}
                </span>
              </p>
              <div className="flex flex-col gap-1.5">
                {session.decisions?.map((entry) => (
                  <div key={entry} className="flex items-start gap-2 rounded-md border px-2.5 py-2">
                    <StatusChip label="Decided" tone="green" className="shrink-0 text-[10px]" />
                    <span className="min-w-0 flex-1 text-xs">{entry}</span>
                  </div>
                ))}
                {session.openQuestions?.map((entry) => (
                  <div key={entry} className="flex items-start gap-2 rounded-md border px-2.5 py-2">
                    <StatusChip label="Open" tone="amber" className="shrink-0 text-[10px]" />
                    <span className="min-w-0 flex-1 text-xs">{entry}</span>
                  </div>
                ))}
                {(session.decisions?.length ?? 0) + (session.openQuestions?.length ?? 0) === 0 && (
                  <p className="text-muted-foreground text-xs">
                    Nothing recorded — the notes are all this meeting left behind.
                  </p>
                )}
              </div>
            </div>

            <div className="border-t px-4 py-4 xl:border-t-0">
              <div className="mb-2 flex items-center gap-1.5">
                <LayoutTemplate className="size-3.5" />
                <p className="text-xs font-medium">Designs from this meeting</p>
                <span className="text-muted-foreground text-xs">{screens.length}</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowGenerate((v) => !v);
                    setGenMsg(null);
                  }}
                  title={showGenerate ? 'Hide generator' : 'Generate designs from meeting notes'}
                  aria-label={t('meeting.generateDesigns')}
                  className={cn(
                    'ml-auto rounded p-0.5 transition-colors',
                    showGenerate ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Wand2 className="size-3.5" />
                </button>
              </div>

              {/* Inline generate panel */}
              {showGenerate && (
                <div className="bg-muted/30 mb-3 flex flex-col gap-2 rounded-md border p-3">
                  <p className="text-muted-foreground text-[11px]">
                    Edit the notes below then generate — Claude reads the meeting context
                    {merged.used.length > 0
                      ? ` and ${merged.used.length} reference file${merged.used.length === 1 ? '' : 's'}`
                      : ''}
                    .
                  </p>
                  <textarea
                    value={generateNotes}
                    onChange={(e) => setGenerateNotes(e.target.value)}
                    rows={6}
                    disabled={generating}
                    className="border-input bg-background w-full resize-y rounded-md border px-3 py-2 font-mono text-xs leading-relaxed disabled:opacity-50"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => void generateDesigns()}
                      disabled={generating || generateNotes.trim().length < 20}
                    >
                      {generating ? <Loader2 className="animate-spin" /> : <Wand2 />}
                      {generating ? `Generating… ${genElapsed}s` : 'Generate designs'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowGenerate(false)}
                      className="text-muted-foreground hover:text-foreground text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {genMsg && (
                <p
                  className={cn(
                    'mb-2 rounded-md border px-3 py-2 text-xs',
                    genMsg.kind === 'ok'
                      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-950/40'
                      : 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-950/40',
                  )}
                >
                  {genMsg.text}
                </p>
              )}

              <div className="flex flex-col gap-1.5">
                {screens.map((screen) => (
                  <div key={screen.id} className="group/screen rounded-md border">
                    <div className="hover:bg-muted/40 flex items-center gap-2 rounded-md px-2.5 py-2">
                      <Link
                        href={businessCanvasHref(
                          project.id,
                          screen.id,
                          versionFolderId(BASELINE_VERSION),
                        )}
                        className="min-w-0 flex-1 truncate text-xs hover:underline"
                      >
                        {screen.name}
                      </Link>
                      <StatusChip {...screen.status} />
                      {/* Promote to version */}
                      <button
                        type="button"
                        onClick={() => setPromotingId(promotingId === screen.id ? null : screen.id)}
                        title={t('meeting.moveToVersion')}
                        aria-label={`Move "${screen.name}" to a design version`}
                        className={cn(
                          'shrink-0 opacity-0 transition-opacity group-hover/screen:opacity-100 focus-visible:opacity-100',
                          promotingId === screen.id
                            ? 'text-primary'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <GitMerge className="size-3" />
                      </button>
                      <a
                        href={previewHref(screen.id, project.id)}
                        target="_blank"
                        rel="noreferrer"
                        title={`Preview ${screen.name}`}
                        aria-label={`Preview ${screen.name} in a new tab`}
                        className="text-muted-foreground hover:text-foreground shrink-0 opacity-0 transition-opacity group-hover/screen:opacity-100 focus-visible:opacity-100"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    </div>

                    {/* Version picker — expands inline below the row */}
                    {promotingId === screen.id && (
                      <div className="flex flex-wrap items-center gap-2 border-t px-2.5 py-2">
                        <GitMerge className="text-muted-foreground size-3 shrink-0" />
                        <span className="text-muted-foreground text-xs">Add to version:</span>
                        <Select onValueChange={(v) => promoteToVersion(screen, Number(v))}>
                          <SelectTrigger size="sm" className="h-6 w-32 text-xs">
                            <SelectValue placeholder={t('meeting.pickVersion')} />
                          </SelectTrigger>
                          <SelectContent>
                            {versionOptions.map((v) => (
                              <SelectItem key={v} value={String(v)}>
                                Version {v}
                              </SelectItem>
                            ))}
                            <SelectItem value={String(highestVersion + 1)}>
                              New version {highestVersion + 1}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <button
                          type="button"
                          onClick={() => setPromotingId(null)}
                          className="text-muted-foreground hover:text-foreground text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {screens.length === 0 && !showGenerate && (
                  <p className="text-muted-foreground text-xs">
                    No designs from this meeting yet —{' '}
                    <button
                      type="button"
                      onClick={() => setShowGenerate(true)}
                      className="text-primary hover:underline"
                    >
                      generate some
                    </button>
                    .
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Everything the customer handed over in this meeting. */}
          <div className="border-t px-4 py-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium">
              <Paperclip className="size-3.5" />
              Reference files
              <span className="text-muted-foreground">{files.length}</span>
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="group/file hover:bg-muted/40 flex items-center gap-2 rounded-md border px-2.5 py-2"
                >
                  <button
                    type="button"
                    onClick={() => onPreview(file)}
                    title={`Preview ${file.name}`}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <MeetingFileIcon kind={file.kind} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs group-hover/file:underline">
                        {file.name}
                      </span>
                      {file.note && (
                        <span className="text-muted-foreground block truncate text-[11px]">
                          {file.note}
                        </span>
                      )}
                    </span>
                  </button>
                  <span className="text-muted-foreground shrink-0 text-[10px]">
                    {file.sizeKb ? formatFileSize(file.sizeKb) : 'link'}
                  </span>
                  <button
                    type="button"
                    onClick={() => downloadFile(file)}
                    disabled={!file.text && !file.url}
                    title={downloadTitle(file)}
                    aria-label={`Download ${file.name}`}
                    className="text-muted-foreground hover:text-foreground shrink-0 rounded-md p-0.5 disabled:opacity-40"
                  >
                    <Download className="size-3.5" />
                  </button>
                </div>
              ))}
              {files.length === 0 && (
                <p className="text-muted-foreground text-xs">{t('meeting.nothingAttached')}</p>
              )}
            </div>
          </div>
        </div>
      </ChatPane>
    </section>
  );
}

/**
 * The meetings behind the baseline, as a feed: one line each on the left, the
 * whole meeting in a panel on the right when you click it. Which meeting is open
 * lives in the URL, so a particular meeting can be linked to.
 */
function MeetingFeed() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const project = findProject(params.projectId);

  const selectedId = searchParams.get('meeting');
  const [created, setCreated] = useState<Record<string, SketchScreen[]>>({});
  // Seeded files are plain data, so they render on the server; only files
  // someone attached wait for localStorage.
  const [refFiles, setRefFiles] = useState<Record<string, MeetingFile[]>>(() => {
    const seeded: Record<string, MeetingFile[]> = {};
    for (const session of project?.sessions ?? []) seeded[session.id] = sessionFiles(session.id);
    return seeded;
  });
  // File opened from the meeting — it previews in a panel on the right, and the
  // meetings list steps aside to make room for it.
  const [previewFile, setPreviewFile] = useState<MeetingFile | null>(null);
  // Relative dates need today's date, which would not match between server and
  // client, so the absolute date renders first and the relative part fills in.
  const [today, setToday] = useState<string | null>(null);

  // Generated designs and attached files live in localStorage.
  useEffect(() => {
    if (!project) return;
    const screens: Record<string, SketchScreen[]> = {};
    const attached: Record<string, MeetingFile[]> = {};
    for (const session of project.sessions) {
      screens[session.id] = loadGeneratedScreens(session.id);
      attached[session.id] = sessionFiles(session.id, loadUploadedFiles(session.id));
    }
    setCreated(screens);
    setRefFiles(attached);
    setToday(new Date().toISOString().slice(0, 10));
  }, [project]);

  if (!project) {
    return (
      <p className="text-muted-foreground px-6 py-16 text-center text-sm">
        That project does not exist.
      </p>
    );
  }

  const ordered = [...project.sessions].sort((a, b) => b.metAt.localeCompare(a.metAt));
  const selectedIndex = project.sessions.findIndex((session) => session.id === selectedId);
  const selected = selectedIndex >= 0 ? project.sessions[selectedIndex] : null;
  const base = `/we-adk/projects/${project.id}/sketcher/meeting`;

  const select = (sessionId: string | null) => {
    setPreviewFile(null);
    router.replace(sessionId ? `${base}?meeting=${sessionId}` : base, { scroll: false });
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* A narrow index column, the way a mail client keeps its list: the meeting
          itself gets the room. Below lg only one of the two is on screen. */}
      <div
        className={cn(
          'bg-background flex min-h-0 flex-col border-r lg:w-[22rem] lg:shrink-0',
          previewFile ? 'hidden' : selected ? 'hidden lg:flex' : 'w-full',
        )}
      >
        <div className="shrink-0 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Meetings</h2>
          <p className="text-muted-foreground text-[11px]">
            {ordered.length} behind <span className="font-mono">version 1</span>, newest first
          </p>
        </div>

        <div className="min-h-0 flex-1 divide-y overflow-y-auto">
          {ordered.map((session) => {
            const screens = [...session.screens, ...(created[session.id] ?? [])];
            const isSelected = session.id === selectedId;
            const references = (refFiles[session.id] ?? []).length;
            const decisions = session.decisions?.length ?? 0;
            const open = session.openQuestions?.length ?? 0;
            // The opening line of the notes is the meeting in one sentence.
            const gist = session.notes.split('\n')[0] ?? '';
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => select(isSelected ? null : session.id)}
                aria-pressed={isSelected}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors',
                  isSelected ? 'bg-primary/5' : 'hover:bg-muted/40',
                )}
              >
                {/* Rail instead of a moving highlight, so the row does not shift. */}
                <span
                  aria-hidden
                  className={cn(
                    'w-0.5 shrink-0 self-stretch rounded-full',
                    isSelected ? 'bg-primary' : 'bg-transparent',
                  )}
                />
                <span
                  aria-hidden
                  className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                >
                  {initials(session.attendees)}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'min-w-0 truncate text-sm font-medium',
                        isSelected && 'text-primary',
                      )}
                    >
                      {session.title}
                    </span>
                    <StatusChip {...meetingStatus(session)} className="ml-auto" />
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                    {session.kind && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {session.kind}
                      </Badge>
                    )}
                    <span className="truncate">
                      {session.metAt}
                      {today ? ` · ${relativeUpdated(session.metAt, today)}` : ''}
                    </span>
                  </span>
                  <span className="text-muted-foreground line-clamp-2 text-xs">{gist}</span>
                  <MeetingMeta
                    session={session}
                    decisions={decisions}
                    open={open}
                    designs={screens.length}
                    references={references}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selected ? (
        <>
          <MeetingDetail
            key={selected.id}
            project={project}
            session={selected}
            index={selectedIndex}
            screens={[...selected.screens, ...(created[selected.id] ?? [])]}
            files={refFiles[selected.id] ?? []}
            onPreview={setPreviewFile}
            onClose={() => select(null)}
            onScreenGenerated={(sessionId, newScreens) =>
              setCreated((current) => ({
                ...current,
                [sessionId]: [...(current[sessionId] ?? []), ...newScreens],
              }))
            }
          />
          {previewFile && (
            <FilePreviewPanel
              project={project}
              file={previewFile}
              meeting={selected.title}
              onClose={() => setPreviewFile(null)}
            />
          )}
        </>
      ) : (
        <div className="text-muted-foreground hidden min-w-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center lg:flex">
          <NotebookPen className="size-5" />
          <p className="text-foreground text-sm font-medium">Pick a meeting on the left.</p>
          <p className="max-w-sm text-xs">
            Its notes, what was decided, what is still open and the designs it produced all open
            here.
          </p>
        </div>
      )}
    </div>
  );
}

export default function BusinessMeetingPage() {
  return (
    <Suspense
      fallback={
        <p className="text-muted-foreground px-6 py-16 text-center text-sm">Loading meetings…</p>
      }
    >
      <MeetingFeed />
    </Suspense>
  );
}
