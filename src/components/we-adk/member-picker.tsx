'use client';

/**
 * Pick a person from the project's team.
 *
 * A free-text name is how two spellings of one person end up on a board, and
 * how "who is testing this?" becomes unanswerable. The list is the roster
 * Business keeps, plus whoever the task already names — a task assigned to
 * someone who has since left the team still has to display them rather than
 * silently reassign itself.
 */

import { useEffect, useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { projectTeam, type TeamMember } from '@/lib/we-adk/user-workspace';

/** The value used for "nobody", since a select cannot hold an empty string. */
export const NO_ONE = '__none__';

export function MemberPicker({
  projectId,
  value,
  onChange,
  id,
  placeholder = 'Unassigned',
  /** Show the role beside each name — useful when picking a tester. */
  showRoles = false,
  className,
}: {
  projectId: string;
  /** Empty or undefined means nobody. */
  value: string | undefined;
  onChange: (name: string | undefined) => void;
  id?: string;
  placeholder?: string;
  showRoles?: boolean;
  className?: string;
}) {
  const [team, setTeam] = useState<TeamMember[]>([]);

  // The roster merges seeded members with any added in the browser, so it can
  // only be read after mount.
  useEffect(() => {
    setTeam(projectTeam(projectId));
  }, [projectId]);

  const names = useMemo(() => {
    const list = team.map((member) => ({ name: member.name, role: member.role }));
    if (value && !list.some((entry) => entry.name === value)) {
      list.unshift({ name: value, role: 'Other' as TeamMember['role'] });
    }
    return list;
  }, [team, value]);

  return (
    <Select
      value={value && value.length > 0 ? value : NO_ONE}
      onValueChange={(next) => onChange(next === NO_ONE ? undefined : next)}
    >
      <SelectTrigger id={id} size="sm" className={className ?? 'h-7 w-full text-xs'}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_ONE}>{placeholder}</SelectItem>
        {names.map((entry) => (
          <SelectItem key={entry.name} value={entry.name}>
            {entry.name}
            {showRoles && (
              <span className="text-muted-foreground ml-1.5 text-[10px]">{entry.role}</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
