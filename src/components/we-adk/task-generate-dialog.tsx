'use client';

import { ArrowRight, Code2, Eye, FileText, FolderInput, Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@/components/ui';
import { useLocale } from '@/lib/locale';
import { claudeHeaders } from '@/lib/we-adk/claude-account';
import { DesignThumbnail } from '@/components/we-adk/design-thumbnail';
import { businessEditHref, businessPreviewHref } from '@/components/we-adk/mockup-board';
import { MemberTargetSelect, useMemberTargets } from '@/components/we-adk/member-target-select';
import {
  designHtmlFileName,
  designToHtml,
  downloadDesignHtml,
  openDesignHtml,
} from '@/lib/we-adk/design-html';
import {
  addTaskDesigns,
  markTaskDesignHandedTo,
  taskBrief,
  taskReferences,
  taskStageKey,
  type TaskDesign,
} from '@/lib/we-adk/task-design';
import { type GeneratedScreen } from '@/lib/we-adk/sketcher-operations';
import { type MeetingFile } from '@/lib/we-adk-mock/meeting-files';
import { type DesignProject } from '@/lib/we-adk-mock/projects';
import { giveScreenToMember } from '@/lib/we-adk/user-workspace';
import { loadScreenBlocks } from '@/lib/we-adk-mock/sketcher';
import { materialiseGeneratedScreens, type SketchScreen } from '@/lib/we-adk-mock/sketches';
import { type ProjectTask } from '@/lib/we-adk-mock/tasks';
import { type TaskComment } from '@/lib/we-adk-mock/task-comments';
import { type ChatTurn } from '@/components/we-adk/claude-chat';
import { versionFolderId } from '@/lib/we-adk-mock/versions';
import { existingScreensContext } from '@/lib/we-adk/round-screens';

/**
 * Generates the screens for one task.
 *
 * Everything the task carries goes in — title, description, category, tags,
 * status, priority, and the text of the files attached to it — and what comes
 * back is staged on the task as samples — a thumbnail, a canvas and an html
 * page — until someone chooses the round they belong in and moves them there.
 */
export function TaskGenerateDialog({
  open,
  project,
  task,
  files,
  chatTurns = [],
  comments = [],
  onClose,
  onCreated,
  onMoved,
}: {
  open: boolean;
  project: DesignProject;
  task: ProjectTask;
  files: MeetingFile[];
  /** AI Chat conversation turns — ideas and requirements discussed in the chat. */
  chatTurns?: ChatTurn[];
  /** Task thread comments — discussion, decisions, and activity on this task. */
  comments?: TaskComment[];
  onClose: () => void;
  onCreated: (designs: TaskDesign[]) => void;
  /** A sample went into a version — the task pane relists and logs it. */
  onMoved: (designs: TaskDesign[], name: string, version: number) => void;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [screens, setScreens] = useState('3');
  const [useFiles, setUseFiles] = useState(true);
  const [pending, setPending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [created, setCreated] = useState<SketchScreen[]>([]);
  /** Screen id → the version it was moved into during this session. */
  const [movedTo, setMovedTo] = useState<Record<string, number>>({});
  const [moveRefresh, setMoveRefresh] = useState(0);

  // The destination is chosen here, before any sample moves anywhere.
  const {
    members,
    memberId,
    setMemberId,
    selected: moveSelected,
    version: moveVersion,
    blocker: moveBlocker,
  } = useMemberTargets(project.id, task.assignee, moveRefresh);

  const references = taskReferences(files);
  const baseBrief = taskBrief(project, task, useFiles ? files : []);

  /**
   * What Main already holds. Read on open rather than at mount, so a screen
   * generated a minute ago is in the list the next generation reasons about.
   */
  const [existingScreens, setExistingScreens] = useState('');
  useEffect(() => {
    if (!open) return;
    setExistingScreens(existingScreensContext(project.id));
  }, [open, project.id]);

  // Append the AI Chat discussion and task comments so the generator uses
  // ideas, requirements, and decisions the team discussed on this task.
  const brief = (() => {
    const parts = [baseBrief];

    // The product as it stands — checked before the discussion, so a screen
    // that already exists is extended rather than proposed a second time.
    if (existingScreens) parts.push(existingScreens);

    // Chat turns — the AI conversation about this task's scope and ideas.
    const meaningful = chatTurns.filter((turn) => turn.text && !turn.error);
    if (meaningful.length > 0) {
      parts.push(
        '',
        'AI Chat discussion on this task (use these ideas and requirements for the screens):',
      );
      for (const turn of meaningful.slice(-20)) {
        parts.push(`${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.text.slice(0, 800)}`);
      }
    }

    // Thread comments — human discussion, decisions, and pinned notes.
    const userComments = comments.filter(
      (c) => c.kind === 'comment' || (c.kind === 'system' && c.pinned),
    );
    if (userComments.length > 0) {
      parts.push('', 'Task thread (decisions and notes from the team):');
      for (const c of userComments.slice(-10)) {
        parts.push(`${c.author}: ${c.text.slice(0, 400)}`);
      }
    }

    return parts.join('\n').slice(0, 11_800);
  })();

  useEffect(() => {
    if (!open) return;
    setError(null);
    setReply(null);
    setSkipped([]);
    setCreated([]);
    setMovedTo({});
    setMoveRefresh((count) => count + 1);
  }, [open, task.id, project.id]);

  useEffect(() => {
    if (!pending) return;
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  const generate = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    setReply(null);
    try {
      const response = await fetch('/api/sketcher/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...claudeHeaders() },
        body: JSON.stringify({
          notes: brief,
          customer: project.customer,
          sessionTitle: `[${task.code}] ${task.title}`,
          maxScreens: Number(screens),
          ...(useFiles && references.text.length > 0
            ? { references: references.text, referenceNames: references.names }
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
        setError(detail);
        return;
      }

      const data = payload as {
        reply?: string;
        screens?: GeneratedScreen[];
        skipped?: string[];
      } | null;
      const proposals = data?.screens ?? [];
      if (proposals.length === 0) {
        setError('Claude proposed no screens for this task. Try adding detail to the description.');
        return;
      }

      // Proposals are staged on the task first — they are samples until
      // someone picks a round and moves them into it.
      const today = new Date().toISOString().slice(0, 10);
      const made = materialiseGeneratedScreens(
        taskStageKey(project.id, task.id),
        proposals.map((screen) => ({
          name: screen.name,
          route: screen.route,
          blocks: screen.blocks,
        })),
        today,
      );

      const designs: TaskDesign[] = made.map((screen) => ({
        screenId: screen.id,
        name: screen.name,
        route: screen.route,
        createdAt: today,
      }));
      addTaskDesigns(project.id, task.id, designs);
      onCreated(designs);

      setCreated(made);
      setSkipped(data?.skipped ?? []);
      setReply(data?.reply ?? t('generate.done'));
    } catch {
      setError('Could not reach the local Claude Code bridge (/api/sketcher/generate).');
    } finally {
      setPending(false);
    }
  };

  const htmlFor = (screen: SketchScreen): string =>
    designToHtml({
      name: screen.name,
      blocks: loadScreenBlocks(screen.id, screen.seedPattern),
      route: screen.route,
      origin: `${project.name} · task [${task.code}] ${task.title}`,
      createdAt: screen.updatedAt,
    });

  const openIn = (href: string) => {
    onClose();
    router.push(href);
  };

  /**
   * Hands a sample to the chosen person. It lands in their workspace as their
   * own copy — Main only sees it once they merge it from the User tab.
   */
  const handToMember = (screen: SketchScreen) => {
    if (!moveSelected) return;
    const today = new Date().toISOString().slice(0, 10);
    const given = giveScreenToMember(project.id, moveSelected.id, screen);
    if (!given) return;
    const designs = markTaskDesignHandedTo(
      project.id,
      task.id,
      screen.id,
      {
        id: moveSelected.id,
        name: moveSelected.name,
        version: given.version,
        screenId: given.screen.id,
      },
      today,
    );
    setMovedTo((current) => ({ ...current, [screen.id]: given.version }));
    setMoveRefresh((count) => count + 1);
    onMoved(designs, screen.name, given.version);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            {t('generate.title')}
          </DialogTitle>
          <DialogDescription>
            Everything on [{task.code}] goes to Claude Code — title, description, category, tags,
            status, priority, attached files, and the AI Chat discussion. What comes back lands in
            this project&rsquo;s working version as an editable canvas and an html page.
          </DialogDescription>
        </DialogHeader>

        {created.length === 0 ? (
          <div className="flex flex-col gap-3">
            {/* What is being sent, named out loud rather than implied. */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {task.status}
              </Badge>
              {task.category && (
                <Badge variant="outline" className="text-[10px]">
                  {task.category}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px]">
                {task.description
                  ? `${task.description.length} ${t('generate.charsDesc')}`
                  : t('generate.noDesc')}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {files.length} file{files.length === 1 ? '' : 's'}
                {references.read > 0 ? ` · text from ${references.read}` : ''}
              </Badge>
              {chatTurns.filter((t) => !t.error).length > 0 && (
                <Badge variant="info" className="text-[10px]">
                  {chatTurns.filter((t) => !t.error).length} chat turns
                </Badge>
              )}
              {comments.filter((c) => c.kind === 'comment').length > 0 && (
                <Badge variant="info" className="text-[10px]">
                  {comments.filter((c) => c.kind === 'comment').length} comments
                </Badge>
              )}
              {(task.tags ?? []).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="bg-muted/40 max-h-44 overflow-auto rounded-md border p-3">
              <pre className="text-muted-foreground font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                {brief}
              </pre>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">{t('generate.screensToPropose')}</Label>
                <Select value={screens} onValueChange={setScreens} disabled={pending}>
                  <SelectTrigger className="h-8 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['1', '2', '3', '4', '5'].map((value) => (
                      <SelectItem key={value} value={value} className="text-xs">
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {files.length > 0 && (
                <label className="text-muted-foreground flex items-center gap-2 pb-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={useFiles}
                    onChange={(event) => setUseFiles(event.target.checked)}
                    disabled={pending}
                    className="size-3.5"
                  />
                  {t('generate.readAttached')}
                  {references.truncated && useFiles && (
                    <span className="text-amber-600 dark:text-amber-400">
                      {t('generate.longFilesTrimmed')}
                    </span>
                  )}
                </label>
              )}
            </div>

            {error && (
              <p className="text-destructive rounded-md border border-current/20 px-3 py-2 text-xs">
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {reply && <p className="text-sm">{reply}</p>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <p className="text-muted-foreground min-w-0 flex-1 text-xs">
                {t('generate.samplesHint')}
              </p>
              <MemberTargetSelect
                members={members}
                memberId={memberId}
                onChange={setMemberId}
                version={moveVersion}
                blocker={moveBlocker}
              />
            </div>
            {/* The reply may describe more screens than survived validation. */}
            {skipped.length > 0 && (
              <p className="text-muted-foreground text-xs">
                {skipped.length} proposed screen{skipped.length === 1 ? '' : 's'} did not match the
                block catalog and {skipped.length === 1 ? 'was' : 'were'} dropped:{' '}
                <span className="font-mono text-[10px]">{skipped.slice(0, 3).join(' · ')}</span>
              </p>
            )}

            <div className="flex max-h-80 flex-col gap-2 overflow-auto">
              {created.map((screen) => {
                const moved = movedTo[screen.id];
                return (
                  <div key={screen.id} className="flex gap-3 rounded-md border p-3">
                    {/* The sample itself — the blocks, small. */}
                    <DesignThumbnail screenId={screen.id} width={180} height={124} />

                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Code2 className="text-muted-foreground size-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {screen.name}
                        </span>
                        {moved ? (
                          <Badge variant="success" className="shrink-0 text-[10px]">
                            in version {moved}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            sample
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground truncate font-mono text-[11px]">
                        {screen.route ?? designHtmlFileName(screen.name)}
                      </p>

                      <div className="flex flex-wrap gap-1.5">
                        {moved ? (
                          <>
                            <Button
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() =>
                                openIn(
                                  businessEditHref(project.id, screen.id, versionFolderId(moved)),
                                )
                              }
                            >
                              {t('generate.editDesign')}
                              <ArrowRight className="size-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() =>
                                openIn(
                                  businessPreviewHref(
                                    project.id,
                                    screen.id,
                                    versionFolderId(moved),
                                  ),
                                )
                              }
                            >
                              <Eye className="size-3" />
                              {t('generate.preview')}
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={() => handToMember(screen)}
                            disabled={!moveSelected || moveBlocker !== null}
                            title={
                              moveBlocker !== null
                                ? 'No open round to hand this into'
                                : moveSelected
                                  ? `Put a copy in ${moveSelected.name}'s workspace`
                                  : 'Pick a person first'
                            }
                          >
                            <FolderInput className="size-3" />
                            Hand to {moveSelected?.name ?? '…'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => openDesignHtml(htmlFor(screen))}
                        >
                          <FileText className="size-3" />
                          {t('generate.openHtml')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => downloadDesignHtml(screen.name, htmlFor(screen))}
                        >
                          .html
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <span
            className={cn(
              'text-muted-foreground self-center text-xs',
              !pending && 'invisible sm:visible',
            )}
          >
            {pending ? `${t('generate.drawing')}${elapsed}s` : t('generate.drawingHint')}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
              {created.length > 0 ? t('live.done') : 'Cancel'}
            </Button>
            {created.length === 0 && (
              <Button
                size="sm"
                className="gap-1"
                onClick={() => void generate()}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {pending ? t('generate.generating') : 'Generate'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
