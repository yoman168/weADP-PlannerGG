'use client';

import { Check } from 'lucide-react';
import { Badge, cn } from '@/components/ui';
import { useLocale } from '@/lib/locale';
import { StatusChip } from '@/components/we-adk/status-chip';
import {
  PROJECT_STAGES,
  projectInitial,
  stageIndex,
  type DesignProject,
  type ProjectAccent,
  type ProjectStage,
} from '@/lib/we-adk-mock/projects';
import { type ChipTone } from '@/lib/we-adk-mock/types';

const ACCENT_TILE: Record<ProjectAccent, string> = {
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  green: 'bg-emerald-600',
  teal: 'bg-teal-600',
  amber: 'bg-amber-600',
  slate: 'bg-slate-500',
};

/**
 * Stages borrow the shared chip vocabulary rather than inventing colours:
 * violet = early thinking, amber = being written up, green = designing,
 * blue = a clickable prototype exists.
 */
const STAGE_TONE: Record<ProjectStage, ChipTone> = {
  'Project Brief': 'violet',
  Summary: 'amber',
  Design: 'green',
  Prototype: 'blue',
};

/** The coloured initial tile that identifies a project in lists and headers. */
export function ProjectTile({
  project,
  className,
}: {
  project: DesignProject;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white',
        ACCENT_TILE[project.accent],
        className,
      )}
    >
      {projectInitial(project)}
    </span>
  );
}

export function StagePill({ stage }: { stage: ProjectStage }) {
  return <StatusChip label={stage} tone={STAGE_TONE[stage]} />;
}

/** The current stage's output is committed to GitLab. */
export function SavedPill() {
  const { t } = useLocale();
  return (
    <Badge variant="success">
      <Check />
      {t('project.savedGitlab')}
    </Badge>
  );
}

/** How far along the pipeline, as a percentage — for the card's progress bar. */
export function stagePercent(stage: ProjectStage): number {
  return Math.round((stageIndex(stage) / PROJECT_STAGES.length) * 100);
}

/**
 * Where this project sits in the pipeline — brief → summary → design →
 * prototype — with everything before the current stage marked done.
 */
export function StageProgress({
  project,
  className,
}: {
  project: DesignProject;
  className?: string;
}) {
  const { t } = useLocale();
  const current = stageIndex(project.stage);

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {PROJECT_STAGES.map((stage, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={stage} className="flex items-center gap-2">
            {index > 0 && (
              <span
                aria-hidden
                className={cn('h-px w-5', step <= current ? 'bg-foreground/30' : 'bg-border')}
              />
            )}
            <span
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap',
                active && 'bg-foreground text-background border-transparent font-medium',
                done &&
                  'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
                !active && !done && 'text-muted-foreground border-dashed',
              )}
            >
              {done ? <Check className="size-3" /> : <span className="font-mono">{step}</span>}
              {stage}
            </span>
          </div>
        );
      })}
      <span className="text-muted-foreground ml-1 text-[11px]">
        {project.saved === true ? t('project.committed') : t('project.notCommitted')}
      </span>
    </div>
  );
}
