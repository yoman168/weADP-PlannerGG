'use client';

import { Upload } from 'lucide-react';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { useState } from 'react';
import { StatusChip } from '@/components/we-adk/status-chip';
import { useLocale } from '@/lib/locale';
import { REQUIREMENTS } from '@/lib/we-adk-mock/builder';

const ALL = 'all';

export default function RequirementsPage() {
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL);

  const statuses = [...new Set(REQUIREMENTS.map((row) => row.status.label))].sort();
  const needle = search.trim().toLowerCase();
  const rows = REQUIREMENTS.filter((row) => {
    if (status !== ALL && row.status.label !== status) return false;
    if (!needle) return true;
    return [row.title, row.kind, row.planner, row.developer]
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Requirements spec</h1>
        <Button size="sm" disabled title={t('misc.notMockup')}>
          <Upload />
          Upload
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="req-search">
          Search requirements
        </label>
        <Input
          id="req-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('builder.searchRequirements')}
          className="h-8 w-64"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger size="sm" className="w-36" aria-label={t('builder.filterStatus')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {statuses.map((entry) => (
              <SelectItem key={entry} value={entry}>
                {entry}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground ml-auto text-xs">
          {rows.length} of {REQUIREMENTS.length}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Kind</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Difficulty</TableHead>
            <TableHead>Planner</TableHead>
            <TableHead>Developer</TableHead>
            <TableHead>Status changed</TableHead>
            <TableHead>Completed</TableHead>
            <TableHead>Comment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              <TableCell className="text-muted-foreground">☆</TableCell>
              <TableCell className="text-muted-foreground max-w-52 truncate">{row.kind}</TableCell>
              <TableCell className="max-w-52 truncate font-medium">{row.title}</TableCell>
              <TableCell>
                <StatusChip {...row.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">{row.difficulty ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">{row.planner}</TableCell>
              <TableCell className="text-muted-foreground">{row.developer}</TableCell>
              <TableCell className="text-muted-foreground">{row.statusChangedAt}</TableCell>
              <TableCell className="text-muted-foreground">{row.completedAt}</TableCell>
              <TableCell className="text-muted-foreground">{row.comment}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
