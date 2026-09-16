'use client';

import { ArrowLeft, Bell, FolderX, Globe } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import { ProjectTile } from '@/components/we-adk/project-chrome';
import { useLocale, LOCALE_LABELS, type Locale } from '@/lib/locale';
import {
  PROJECTS,
  WORKSPACE_LABEL,
  findProject,
  projectWorkspace,
} from '@/lib/we-adk-mock/projects';

/**
 * A project has one tool — Business, at `/sketcher` — so there is no tool rail:
 * the top bar carries the project's identity and the page below it is the tool.
 */
export default function ProjectLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ projectId: string }>();
  const { locale, setLocale, t } = useLocale();

  /**
   * A created project lives in storage, which a server render cannot read.
   *
   * So for one of those the first render here has to agree with the nothing the
   * server sent, and the project arrives on the tick after mount. Seeded
   * projects are in the bundle and start ready, so nothing about them waits.
   * This gate covers the tool pages too — they look the project up themselves,
   * and holding them one tick keeps every one of those lookups on the same side
   * of hydration as this one.
   */
  const seeded = PROJECTS.some((entry) => entry.id === params.projectId);
  const [ready, setReady] = useState(seeded);
  useEffect(() => setReady(true), []);

  const project = ready ? findProject(params.projectId) : null;
  const base = `/we-adk/projects/${params.projectId}`;

  /*
   * Back to the list this project is actually in.
   *
   * "Projects" named neither of them and led to whichever tab the home page
   * opened on, so leaving a Product project put you in the Customer list with
   * no sign of the project you just left. Until a created project arrives from
   * storage there is nothing to name, and the generic label stands in for the
   * one tick that takes.
   */
  const workspace = project ? projectWorkspace(project) : null;
  const backHref = workspace ? `/we-adk?tab=${workspace}` : '/we-adk';
  const backLabel = workspace ? WORKSPACE_LABEL[workspace] : t('nav.projects');

  return (
    // The full viewport, not a minimum: with `min-h` the row grew past the
    // viewport whenever a child asked for full height, which is the strip of
    // empty background under every tool. Nothing is subtracted for a header —
    // the shell hides its own inside a project, and the top bar below is
    // `fixed`, so it takes no height in the flow.
    <div className="-mx-6 -my-6 flex h-dvh">
      {/* ---- Project top bar ---- */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-12 items-center gap-3 border-b bg-[#fafafa] px-4 dark:bg-[#1f1430]">
        {/* Left: back + project identity */}
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1.5 text-xs"
        >
          <ArrowLeft className="size-3" />
          {backLabel}
        </Link>

        {project && (
          <Link
            href={base}
            className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <ProjectTile project={project} className="size-5 shrink-0 rounded text-[9px]" />
            <span className="truncate text-sm font-semibold">{project.name}</span>
          </Link>
        )}

        <div className="flex-1" />

        {/* Right side */}
        <div className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1">
          <Globe className="text-muted-foreground size-3.5" />
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="bg-transparent text-xs font-medium outline-none cursor-pointer"
          >
            <option value="en">{LOCALE_LABELS.en}</option>
            <option value="ko">{LOCALE_LABELS.ko}</option>
          </select>
        </div>

        <button
          type="button"
          className="text-muted-foreground hover:text-foreground relative shrink-0"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          <span className="bg-destructive absolute -top-1 -right-1.5 flex size-3.5 items-center justify-center rounded-full text-[8px] font-medium text-white">
            9+
          </span>
        </button>
      </div>

      {/* A column so a page can fill the row with `flex-1`, and scrolling so a
          page taller than the row scrolls inside it rather than the window.
          `pt-12` clears the fixed bar; there is deliberately no bottom padding,
          because every full-height page had to cancel it with a negative
          margin and any mismatch showed up as a strip of dead background. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto px-6 pt-12">
        {/* A project this browser does not have gets an explanation, not the
            tools. Rendering them anyway is how this used to crash: every page
            under here assumes a project, and the first hook that reached for
            one threw. The likeliest reason is not a typo but the mock's nature
            — created projects live in browser storage, so one made on
            localhost does not exist on the LAN address, in another browser, or
            in a private window. */}
        {ready &&
          (project ? (
            children
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
              <FolderX className="text-muted-foreground/50 size-10" aria-hidden />
              <p className="text-sm font-semibold">{t('project.missing')}</p>
              <p className="text-muted-foreground max-w-sm text-xs leading-relaxed">
                {t('project.missingHint')}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-2 text-xs">
                <Link href="/we-adk">{t('project.missingBack')}</Link>
              </Button>
            </div>
          ))}
      </div>
    </div>
  );
}
