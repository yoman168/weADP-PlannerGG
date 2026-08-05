'use client';

/**
 * Who a generated design is handed to.
 *
 * A sample used to go straight into a round, which skipped the person whose task
 * it was: designs arrived in Main without anyone having looked at them. It goes
 * into that person's workspace instead, and reaches Main only when they merge it
 * from the User tab.
 */
import { UserRoundPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from '@/components/ui';
import {
  findMemberByName,
  handoffBlocker,
  memberWorkspaceVersion,
  projectTeam,
  type HandoffBlocker,
  type TeamMember,
} from '@/lib/we-adk/user-workspace';

export function memberLabel(member: TeamMember): string {
  return `${member.name} · ${member.role.toLowerCase()}`;
}

/**
 * The team, defaulting to whoever the task is assigned to — the person the work
 * belongs to, and so the sensible owner of anything generated from it.
 */
export function useMemberTargets(projectId: string, assignee: string, refreshKey: unknown = 0) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [blocker, setBlocker] = useState<HandoffBlocker>(null);

  // The team and the rounds both live in localStorage, so this settles after
  // mount rather than during render.
  useEffect(() => {
    const team = projectTeam(projectId);
    setMembers(team);
    setVersion(memberWorkspaceVersion(projectId));
    setBlocker(handoffBlocker(projectId));
    setMemberId((current) => {
      if (current !== null && team.some((entry) => entry.id === current)) return current;
      return (findMemberByName(projectId, assignee) ?? team[0])?.id ?? null;
    });
  }, [projectId, assignee, refreshKey]);

  const selected = members.find((entry) => entry.id === memberId) ?? null;
  return { members, memberId, setMemberId, selected, version, blocker };
}

export function MemberTargetSelect({
  members,
  memberId,
  onChange,
  version,
  blocker,
  className,
}: {
  members: TeamMember[];
  memberId: string | null;
  onChange: (id: string) => void;
  /** The round their workspace mirrors, for the line under the picker. */
  version: number | null;
  blocker: HandoffBlocker;
  className?: string;
}) {
  if (blocker !== null) {
    return (
      <p className={cn('text-muted-foreground text-xs', className)}>
        {blocker === 'no-round'
          ? 'No round is open yet — start one in the Main tab before handing designs over.'
          : `version ${version} has been released, so nothing can be handed into it.`}
      </p>
    );
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <UserRoundPlus className="text-muted-foreground size-3.5 shrink-0" />
      <span className="text-muted-foreground shrink-0 text-xs">Hand to</span>
      <Select value={memberId ?? undefined} onValueChange={onChange}>
        <SelectTrigger size="sm" className="h-7 min-w-0 text-xs">
          <SelectValue placeholder="Pick a person" />
        </SelectTrigger>
        <SelectContent align="end">
          {members.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {memberLabel(member)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {version !== null && (
        <span className="text-muted-foreground/70 shrink-0 font-mono text-[10px]">
          version {version}
        </span>
      )}
    </div>
  );
}
