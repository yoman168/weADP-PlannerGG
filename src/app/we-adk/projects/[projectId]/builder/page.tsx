'use client';

import { ChevronRight, Layers, Star, Upload } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@/components/ui';
import { StatusChip } from '@/components/we-adk/status-chip';
import { useLocale } from '@/lib/locale';
import { WORK_MOCKUPS } from '@/lib/we-adk-mock/builder';

const COLUMNS = [
  'Kind',
  'Title',
  'Domain',
  'Pattern',
  'Screens',
  'Author',
  'Updated',
  'Difficulty',
  'Status',
  'Comment',
  'PRD',
];

const ALL = 'all';

export default function WorkMockupsPage() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const base = `/we-adk/projects/${params.projectId}/builder`;
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState(ALL);
  const [author, setAuthor] = useState(ALL);

  const domains = [...new Set(WORK_MOCKUPS.map((row) => row.domain))].sort();
  const authors = [...new Set(WORK_MOCKUPS.map((row) => row.author))].sort();

  const needle = search.trim().toLowerCase();
  const rows = WORK_MOCKUPS.filter((row) => {
    if (bookmarkedOnly && !row.starred) return false;
    if (domain !== ALL && row.domain !== domain) return false;
    if (author !== ALL && row.author !== author) return false;
    if (!needle) return true;
    return [row.title, row.description, row.domain, row.author, ...row.screens.map((s) => s.name)]
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });
  const totalScreens = rows.reduce((sum, row) => sum + row.screens.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Work mockups</h1>
          <p className="text-muted-foreground text-xs">
            {rows.length} mockups · {totalScreens} screens. Open a mockup to see all of its screens
            on one canvas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled title={t('misc.notMockup')}>
            <Upload />
            Import existing screen
          </Button>
          <Button size="sm" disabled title={t('misc.notMockup')}>
            + New screen
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="mockup-search">
          Search work mockups
        </label>
        <Input
          id="mockup-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('builder.searchMockups')}
          className="h-8 w-64"
        />
        <Select value={domain} onValueChange={setDomain}>
          <SelectTrigger size="sm" className="w-40" aria-label={t('builder.filterDomain')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All domains</SelectItem>
            {domains.map((entry) => (
              <SelectItem key={entry} value={entry}>
                {entry}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={author} onValueChange={setAuthor}>
          <SelectTrigger size="sm" className="w-36" aria-label={t('builder.filterAuthor')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All authors</SelectItem>
            {authors.map((entry) => (
              <SelectItem key={entry} value={entry}>
                {entry}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="text-muted-foreground ml-auto flex items-center gap-2 text-xs">
          <Switch checked={bookmarkedOnly} onCheckedChange={setBookmarkedOnly} />
          Bookmarked only ({WORK_MOCKUPS.filter((row) => row.starred).length})
        </label>
      </div>

      <div className="bg-background overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs">
            <tr>
              <th className="w-8 px-2 py-2" />
              {COLUMNS.map((column) => (
                <th key={column} className="whitespace-nowrap px-3 py-2 text-left font-medium">
                  {column}
                </th>
              ))}
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => router.push(`${base}/${row.id}`)}
                className="hover:bg-muted/40 cursor-pointer border-t"
                title={`Open ${row.title} — ${row.screens.length} screens`}
              >
                <td className="px-2 py-2">
                  <Star
                    className={
                      row.starred
                        ? 'size-4 fill-amber-400 text-amber-400'
                        : 'text-muted-foreground size-4'
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline">{row.kind}</Badge>
                </td>
                <td className="px-3 py-2">
                  {/* Real link so keyboard users can reach the board; the row click is a mouse shortcut. */}
                  <Link
                    href={`${base}/${row.id}`}
                    className="font-medium hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {row.title}
                  </Link>
                  <p className="text-muted-foreground text-xs">{row.description}</p>
                </td>
                <td className="px-3 py-2">
                  <Badge variant="secondary">{row.domain}</Badge>
                </td>
                <td className="text-muted-foreground px-3 py-2">{row.pattern || '—'}</td>
                <td className="px-3 py-2">
                  <Badge variant="muted" className="gap-1">
                    <Layers className="size-3" />
                    {row.screens.length}
                  </Badge>
                </td>
                <td className="text-muted-foreground px-3 py-2">{row.author}</td>
                <td className="text-muted-foreground px-3 py-2">{row.updatedAt}</td>
                <td className="text-muted-foreground px-3 py-2">
                  {row.difficulty ? `${row.difficulty}/5` : '—'}
                </td>
                <td className="px-3 py-2">{row.status ? <StatusChip {...row.status} /> : '—'}</td>
                <td className="text-muted-foreground px-3 py-2">{row.comment ?? '—'}</td>
                <td className="px-3 py-2">{row.prd ? <StatusChip {...row.prd} /> : '—'}</td>
                <td className="px-2 py-2">
                  <ChevronRight className="text-muted-foreground size-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-muted-foreground py-10 text-center text-sm">
            No work mockups match those filters.
          </p>
        )}
      </div>
    </div>
  );
}
