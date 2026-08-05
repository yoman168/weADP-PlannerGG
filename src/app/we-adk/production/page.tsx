'use client';

import { ArrowLeft, Copy, Eye, FolderOpen, Server } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@/components/ui';
import { CANVAS_ROUTE } from '@/components/we-adk/mockup-board';
import { StatusChip } from '@/components/we-adk/status-chip';
import {
  PRODUCTION_SCREENS,
  SOLUTIONS,
  type ProductionScreen,
  type SolutionName,
} from '@/lib/we-adk-mock/production-screens';
import { PROJECTS, projectForSolution } from '@/lib/we-adk-mock/projects';
import { addCopiedScreen } from '@/lib/we-adk-mock/sketches';
import { loadScreenBlocks } from '@/lib/we-adk-mock/sketcher';

function CopyDialog({
  screen,
  onClose,
}: {
  screen: ProductionScreen | null;
  onClose: (result?: { projectId: string; screenName: string }) => void;
}) {
  const firstProject = PROJECTS[0];
  const [projectId, setProjectId] = useState(firstProject?.id ?? '');
  const [sessionId, setSessionId] = useState(firstProject?.sessions[0]?.id ?? '');
  const [name, setName] = useState('');

  const project = PROJECTS.find((entry) => entry.id === projectId) ?? firstProject;
  const suggested = screen
    ? `${screen.path.split('>').pop()?.trim() ?? screen.path} (revised)`
    : '';

  const copy = () => {
    if (!screen || !sessionId) return;
    const blocks = loadScreenBlocks(screen.id, screen.seedPattern);
    addCopiedScreen(
      sessionId,
      {
        name: (name.trim() || suggested).slice(0, 80),
        route: screen.route,
        seedPattern: screen.seedPattern,
        blocks,
        basedOnRoute: screen.route,
      },
      new Date().toISOString().slice(0, 10),
    );
    onClose({ projectId, screenName: name.trim() || suggested });
  };

  return (
    <Dialog open={screen !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy into a project folder</DialogTitle>
        </DialogHeader>
        {screen && (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="bg-muted/40 min-w-0 rounded-md border p-3 text-xs">
              <p className="truncate font-medium">{screen.path}</p>
              <p className="text-muted-foreground truncate font-mono">{screen.route}</p>
              <p className="text-muted-foreground mt-1">
                {screen.solution} · captured {screen.capturedAt}
              </p>
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="copy-project">Project</Label>
              <Select
                value={projectId}
                onValueChange={(value) => {
                  setProjectId(value);
                  const next = PROJECTS.find((entry) => entry.id === value);
                  setSessionId(next?.sessions[0]?.id ?? '');
                }}
              >
                <SelectTrigger id="copy-project" className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECTS.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {project && (
                <p className="text-muted-foreground truncate text-xs">{project.customer}</p>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="copy-session">Meeting folder</Label>
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger id="copy-session" className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(project?.sessions ?? []).map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.title} · {session.metAt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="copy-name">Screen name</Label>
              <Input
                id="copy-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={suggested}
              />
            </div>

            <p className="text-muted-foreground text-xs">
              The copy gets its own canvas, so editing it never changes the production screen — you
              can show the customer both, side by side.
            </p>

            <Button onClick={copy} disabled={!sessionId}>
              <Copy />
              Copy into folder
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ProductionShelfPage() {
  const [solution, setSolution] = useState<SolutionName>(SOLUTIONS[0]);
  const [search, setSearch] = useState('');
  const [copying, setCopying] = useState<ProductionScreen | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const owningProject = projectForSolution(solution);
  const needle = search.trim().toLowerCase();
  const rows = PRODUCTION_SCREENS.filter((entry) => {
    if (entry.solution !== solution) return false;
    if (!needle) return true;
    return `${entry.path} ${entry.route}`.toLowerCase().includes(needle);
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" asChild>
            <Link href="/we-adk">
              <ArrowLeft className="size-3.5" />
              Projects
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-lg font-semibold">All captured screens</h1>
        </div>
        <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
          Every screen captured from a live product, across projects. Each solution&rsquo;s screens
          also sit in their own project&rsquo;s{' '}
          <span className="font-mono text-xs">real-screens</span> folder — copy one into a meeting
          folder to start from reality instead of a blank canvas.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="bg-muted flex flex-nowrap gap-1 overflow-x-auto rounded-md p-0.5">
          {SOLUTIONS.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setSolution(entry)}
              aria-pressed={solution === entry}
              className={cn(
                'shrink-0 rounded px-2.5 py-1 text-xs whitespace-nowrap',
                solution === entry ? 'bg-background shadow-xs' : 'text-muted-foreground',
              )}
            >
              {entry}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="prod-search">
          Search production screens
        </label>
        <Input
          id="prod-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by menu path or route"
          className="h-8 w-64"
        />
        <span className="text-muted-foreground text-xs">{rows.length} screens</span>
        {owningProject && (
          <Button variant="outline" size="sm" className="ml-auto h-8 gap-1 text-xs" asChild>
            <Link href={`/we-adk/projects/${owningProject.id}/sketcher/research`}>
              <FolderOpen className="size-3.5" />
              Open in {owningProject.name}
            </Link>
          </Button>
        )}
      </div>

      <div className="bg-background overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Screen path</th>
              <th className="px-3 py-2 text-left font-medium">Route</th>
              <th className="px-3 py-2 text-left font-medium">Capture</th>
              <th className="px-3 py-2 text-left font-medium">Captured at</th>
              <th className="px-3 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/30 border-t">
                <td className="px-3 py-2">
                  {row.nested && <span className="text-muted-foreground mr-1">›</span>}
                  <Link
                    href={`${CANVAS_ROUTE}?screen=${row.id}`}
                    className="font-medium hover:underline"
                  >
                    {row.path}
                  </Link>
                </td>
                <td className="text-muted-foreground px-3 py-2 font-mono text-xs">{row.route}</td>
                <td className="px-3 py-2">
                  <StatusChip {...row.status} />
                </td>
                <td className="text-muted-foreground px-3 py-2">{row.capturedAt}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
                      <Link href={`${CANVAS_ROUTE}?screen=${row.id}`}>
                        <Eye className="size-3" />
                        View
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => setCopying(row)}
                    >
                      <Copy className="size-3" />
                      Copy into folder
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
            <Server className="size-4" />
            No production screens match that search.
          </p>
        )}
      </div>

      <CopyDialog
        screen={copying}
        onClose={(result) => {
          setCopying(null);
          if (result) {
            const target = PROJECTS.find((entry) => entry.id === result.projectId);
            setToast(`Copied “${result.screenName}” into ${target?.name ?? 'the project'}.`);
            window.setTimeout(() => setToast(null), 3000);
          }
        }}
      />

      {toast && (
        <div className="bg-foreground text-background fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md px-3 py-2 text-xs shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
