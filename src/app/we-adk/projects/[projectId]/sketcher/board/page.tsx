'use client';

import {
  ArrowLeft,
  CalendarDays,
  Check,
  FileStack,
  HelpCircle,
  Layers,
  Loader2,
  NotebookPen,
  Paperclip,
  Server,
  Wand2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  cn,
} from '@/components/ui';
import {
  MockupBoard,
  ZoomControl,
  businessCanvasHref,
  type BoardScreen,
  type ZoomId,
} from '@/components/we-adk/mockup-board';
import { ClaudeTerminal } from '@/components/we-adk/claude-terminal';
import { MeetingFilePanel } from '@/components/we-adk/meeting-files';
import { StatusChip } from '@/components/we-adk/status-chip';
import {
  loadUploadedFiles,
  mergeReferenceText,
  sessionFiles,
  type MeetingFile,
} from '@/lib/we-adk-mock/meeting-files';
import { findProject, projectFolders } from '@/lib/we-adk-mock/projects';
import { BASELINE_VERSION, versionFolderId } from '@/lib/we-adk-mock/versions';
import {
  loadGeneratedScreens,
  materialiseGeneratedScreens,
  removeGeneratedScreen,
  type SketchScreen,
  type SketchSession,
} from '@/lib/we-adk-mock/sketches';
import { loadScreenBlocks } from '@/lib/we-adk-mock/sketcher';
import { type GeneratedScreen } from '@/lib/we-adk/sketcher-operations';
import { useLocale } from '@/lib/locale';

const FROM_SCRATCH = 'scratch';

/* ------------------------------------------------------------------ */
/* Meeting notes → screens (new, or a revision of an existing screen)  */
/* ------------------------------------------------------------------ */

function GeneratePanel({
  session,
  customer,
  sessionScreens,
  referenceFiles,
  onGenerated,
}: {
  session: SketchSession;
  customer: string;
  /** Files already in this folder, so one can be picked as the base to revise. */
  sessionScreens: SketchScreen[];
  /** Reference files attached to this meeting — their text goes into the prompt. */
  referenceFiles: MeetingFile[];
  onGenerated: (screens: SketchScreen[]) => void;
}) {
  const { t } = useLocale();
  const [notes, setNotes] = useState(session.notes);
  const [maxScreens, setMaxScreens] = useState('4');
  const [baseId, setBaseId] = useState(FROM_SCRATCH);
  const [useReferences, setUseReferences] = useState(true);
  const [pending, setPending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Swap the notes when the developer switches meeting.
  useEffect(() => {
    setNotes(session.notes);
    setBaseId(FROM_SCRATCH);
    setMessage(null);
  }, [session.id, session.notes]);

  useEffect(() => {
    if (!pending) return;
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  const revising = sessionScreens.find((screen) => screen.id === baseId) ?? null;
  const merged = mergeReferenceText(referenceFiles);

  const generate = async () => {
    if (pending || notes.trim().length < 20) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch('/api/sketcher/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes,
          customer,
          sessionTitle: session.title,
          maxScreens: revising ? 1 : Number(maxScreens),
          ...(useReferences && merged.text.length > 0
            ? {
                references: merged.text,
                referenceNames: merged.unreadable.map((file) => file.name),
              }
            : {}),
          ...(revising
            ? {
                baseScreen: {
                  path: revising.name,
                  route: revising.route ?? '',
                  blocks: loadScreenBlocks(revising.id, revising.seedPattern).map((block) => ({
                    kind: block.kind,
                    label: typeof block.props.label === 'string' ? block.props.label : undefined,
                  })),
                },
              }
            : {}),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          typeof payload === 'object' &&
          payload !== null &&
          typeof (payload as { error?: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : `Request failed (${response.status}).`;
        setMessage({ kind: 'error', text: detail });
        return;
      }

      const data = payload as { reply?: string; screens?: GeneratedScreen[] } | null;
      const proposals = data?.screens ?? [];
      if (proposals.length === 0) {
        setMessage({ kind: 'error', text: 'Claude proposed no screens from those notes.' });
        return;
      }

      const created = materialiseGeneratedScreens(
        session.id,
        proposals.map((screen) => ({
          name: screen.name,
          route: screen.route,
          blocks: screen.blocks,
        })),
        new Date().toISOString().slice(0, 10),
      );
      onGenerated(created);
      const readFrom =
        useReferences && merged.used.length > 0
          ? ` Read ${merged.used.length} reference file${merged.used.length === 1 ? '' : 's'}.`
          : '';
      setMessage({
        kind: 'ok',
        text: `${data?.reply ?? 'Done.'} Added ${created.length} design file${created.length === 1 ? '' : 's'} to this folder.${readFrom}`,
      });
    } catch {
      setMessage({
        kind: 'error',
        text: 'Could not reach the local Claude Code bridge (/api/sketcher/generate).',
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <NotebookPen className="size-4" />
          <p className="text-sm font-semibold">Meeting notes</p>
          {session.kind && (
            <Badge variant="outline" className="text-[10px]">
              {session.kind}
            </Badge>
          )}
          <span className="text-muted-foreground ml-auto text-xs">
            {session.metAt}
            {session.durationMin ? ` · ${session.durationMin} min` : ''}
          </span>
        </div>
        <p className="text-muted-foreground -mt-1 text-xs">{session.attendees}</p>

        <label className="sr-only" htmlFor="meeting-notes">
          Meeting notes
        </label>
        <textarea
          id="meeting-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={9}
          disabled={pending}
          className="border-input bg-background w-full resize-y rounded-md border px-3 py-2 font-mono text-xs leading-relaxed disabled:opacity-50"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Select value={baseId} onValueChange={setBaseId}>
            <SelectTrigger
              size="sm"
              className="w-full"
              aria-label={t('board.designFromScratch')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FROM_SCRATCH}>New screens from notes</SelectItem>
              {sessionScreens.map((screen) => (
                <SelectItem key={screen.id} value={screen.id}>
                  Revise: {screen.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!revising && (
            <Select value={maxScreens} onValueChange={setMaxScreens}>
              <SelectTrigger size="sm" className="w-40" aria-label={t('board.maxScreens')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['2', '3', '4', '6', '8'].map((value) => (
                  <SelectItem key={value} value={value}>
                    up to {value} screens
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {merged.used.length > 0 && (
            <label className="flex w-full items-center gap-2 text-xs">
              <Switch
                checked={useReferences}
                onCheckedChange={setUseReferences}
                aria-label={t('board.includeRefFiles')}
              />
              <Paperclip className="text-muted-foreground size-3" />
              <span>
                Include {merged.used.length} reference file
                {merged.used.length === 1 ? '' : 's'}
              </span>
              <span className="text-muted-foreground font-mono text-[10px]">
                {(merged.text.length / 1000).toFixed(1)}k chars
                {merged.truncated ? ' · trimmed' : ''}
              </span>
            </label>
          )}
          <Button
            size="sm"
            onClick={() => void generate()}
            disabled={pending || notes.trim().length < 20}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {pending
              ? `Reading notes… ${elapsed}s`
              : revising
                ? 'Propose revision'
                : 'Generate screens'}
          </Button>
          <span className="text-muted-foreground text-[10px]">
            {revising
              ? `Keeps what the notes didn't question about "${revising.name}"`
              : 'Runs on your local Claude Code · concept level, no backend assumptions'}
          </span>
        </div>

        {message && (
          <p
            className={cn(
              'rounded-md border px-3 py-2 text-xs',
              message.kind === 'ok'
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-950/40'
                : 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-950/40',
            )}
          >
            {message.text}
          </p>
        )}

        {/* What the room actually settled, and what it left hanging. */}
        {((session.decisions?.length ?? 0) > 0 || (session.openQuestions?.length ?? 0) > 0) && (
          <div className="flex flex-col gap-2 border-t pt-3">
            {(session.decisions?.length ?? 0) > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Decided
                </p>
                {session.decisions?.map((decision) => (
                  <p key={decision} className="flex items-start gap-1.5 text-xs">
                    <Check className="mt-0.5 size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{decision}</span>
                  </p>
                ))}
              </div>
            )}
            {(session.openQuestions?.length ?? 0) > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                  Still open
                </p>
                {session.openQuestions?.map((question) => (
                  <p
                    key={question}
                    className="text-muted-foreground flex items-start gap-1.5 text-xs"
                  >
                    <HelpCircle className="mt-0.5 size-3 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>{question}</span>
                  </p>
                ))}
                <p className="text-muted-foreground mt-0.5 text-[10px]">
                  A design covering these is a guess until the customer answers.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Board                                                               */
/* ------------------------------------------------------------------ */

function ProjectBoard() {
  const { t } = useLocale();
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const project = findProject(params.projectId);

  const [zoom, setZoom] = useState<ZoomId>('md');
  const [sessionId, setSessionId] = useState(
    searchParams.get('session') ?? project?.sessions[0]?.id ?? '',
  );
  const [showNotes, setShowNotes] = useState(true);
  const [generated, setGenerated] = useState<Record<string, SketchScreen[]>>({});
  const [uploaded, setUploaded] = useState<Record<string, MeetingFile[]>>({});

  // Files the user created live in localStorage, so load them after mount.
  useEffect(() => {
    if (!project) return;
    const loaded: Record<string, SketchScreen[]> = {};
    const files: Record<string, MeetingFile[]> = {};
    for (const session of project.sessions) {
      loaded[session.id] = loadGeneratedScreens(session.id);
      files[session.id] = loadUploadedFiles(session.id);
    }
    setGenerated(loaded);
    setUploaded(files);
  }, [project]);

  if (!project) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm font-medium">That project does not exist.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/we-adk">
            <ArrowLeft />
            Back to design projects
          </Link>
        </Button>
      </div>
    );
  }

  const session = project.sessions.find((entry) => entry.id === sessionId) ?? project.sessions[0];
  const sessionFolder = projectFolders(project, generated).find(
    (folder) => folder.id === session?.id,
  );
  const nameById = new Map(
    project.sessions.flatMap((entry) => entry.screens.map((screen) => [screen.id, screen.name])),
  );

  // Board shows every meeting folder's designs, grouped, with created ones appended.
  const boardScreens: BoardScreen[] = project.sessions.flatMap((entry) => {
    const groupLabel = `${entry.title} · ${entry.metAt}`;
    const own = entry.screens.map<BoardScreen>((screen) => ({
      id: screen.id,
      name: screen.name,
      route: screen.route,
      seedPattern: screen.seedPattern,
      status: screen.status,
      updatedAt: screen.updatedAt,
      variantOfName: screen.variantOf ? nameById.get(screen.variantOf) : undefined,
      basedOnRoute: screen.basedOnRoute,
      groupLabel,
    }));
    const gen = (generated[entry.id] ?? []).map<BoardScreen>((screen) => ({
      id: screen.id,
      name: screen.name,
      route: screen.route,
      seedPattern: screen.seedPattern,
      status: screen.status,
      updatedAt: screen.updatedAt,
      groupLabel,
      generated: true,
      basedOnRoute: screen.basedOnRoute,
    }));
    return [...own, ...gen];
  });

  const generatedCount = Object.values(generated).reduce((sum, list) => sum + list.length, 0);

  const deleteGenerated = (screen: BoardScreen) => {
    const owning = project.sessions.find((entry) =>
      (generated[entry.id] ?? []).some((candidate) => candidate.id === screen.id),
    );
    if (!owning) return;
    const next = removeGeneratedScreen(owning.id, screen.id);
    setGenerated((current) => ({ ...current, [owning.id]: next }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Board toolbar */}
      <div className="bg-background flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {/* Files ↔ Board are two views of the same designs. */}
          <div className="bg-muted flex shrink-0 rounded-md p-0.5">
            <Link
              href={`/we-adk/projects/${project.id}/sketcher`}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded px-2.5 py-1 text-xs"
            >
              <FileStack className="size-3.5" />
              Files
            </Link>
            <span className="bg-background flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium shadow-xs">
              <Layers className="size-3.5" />
              Board
            </span>
          </div>
          <span className="text-muted-foreground shrink-0 text-xs">
            {boardScreens.length} design{boardScreens.length === 1 ? '' : 's'}
          </span>
          {generatedCount > 0 && (
            <StatusChip
              label={`${generatedCount} created here`}
              tone="violet"
              className="flex shrink-0 items-center gap-1"
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={session?.id ?? ''} onValueChange={setSessionId}>
            <SelectTrigger size="sm" className="w-56" aria-label={t('board.selectMeeting')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {project.sessions.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.title} · {entry.metAt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/we-adk/projects/${project.id}/sketcher/research`}>
              <Server />
              Real screens
            </Link>
          </Button>
          <Button
            variant={showNotes ? 'default' : 'outline'}
            size="sm"
            aria-pressed={showNotes}
            onClick={() => setShowNotes((value) => !value)}
          >
            {showNotes ? <X /> : <NotebookPen />}
            {showNotes ? 'Hide notes' : 'Notes'}
          </Button>
          <ZoomControl zoom={zoom} onChange={setZoom} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {showNotes && session && (
          <aside className="bg-background w-96 shrink-0 overflow-y-auto border-r p-4">
            <div className="mb-3 flex items-center gap-1.5">
              <CalendarDays className="text-muted-foreground size-3.5" />
              <p className="text-sm font-medium">{session.title}</p>
            </div>
            <GeneratePanel
              session={session}
              customer={project.customer}
              sessionScreens={[...session.screens, ...(generated[session.id] ?? [])]}
              referenceFiles={sessionFiles(session.id, uploaded[session.id] ?? [])}
              onGenerated={(screens) =>
                setGenerated((current) => ({
                  ...current,
                  [session.id]: [...(current[session.id] ?? []), ...screens],
                }))
              }
            />

            {/* What the customer handed over in this meeting. */}
            <Card className="mt-3">
              <CardContent>
                <MeetingFilePanel
                  sessionId={session.id}
                  files={sessionFiles(session.id, uploaded[session.id] ?? [])}
                  uploadedBy="설욱환"
                  onChange={() =>
                    setUploaded((current) => ({
                      ...current,
                      [session.id]: loadUploadedFiles(session.id),
                    }))
                  }
                />
              </CardContent>
            </Card>

            {/* This meeting folder's own Claude Code session, on the local CLI. */}
            {sessionFolder && (
              <div className="mt-3 h-[26rem] overflow-hidden rounded-xl border">
                <ClaudeTerminal key={session.id} project={project} folder={sessionFolder} />
              </div>
            )}
          </aside>
        )}

        <MockupBoard
          screens={boardScreens}
          zoom={zoom}
          projectId={project.id}
          // A design file belongs to the workspace, so it opens with the explorer.
          // Everything on this board came out of a meeting, so it is the baseline.
          hrefFor={(screenId) =>
            businessCanvasHref(project.id, screenId, versionFolderId(BASELINE_VERSION))
          }
          emptyMessage="No designs in this project yet — paste the meeting notes and generate some."
          onDelete={deleteGenerated}
          footnote="Frames are grouped by the meeting folder they live in. Files created here can be deleted; the rest are part of the sample data."
        />
      </div>
    </div>
  );
}

export default function ProjectBoardPage() {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground py-16 text-center text-sm">Loading board…</p>}
    >
      <ProjectBoard />
    </Suspense>
  );
}
