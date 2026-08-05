'use client';

import { Copy, ExternalLink, FileEdit } from 'lucide-react';
import { useState } from 'react';
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
import { StatusChip } from '@/components/we-adk/status-chip';
import { useLocale } from '@/lib/locale';
import { PRODUCTION_SCREENS, SOLUTIONS } from '@/lib/we-adk-mock/production-screens';

export default function SolutionMockupsPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState<string>(SOLUTIONS[0]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Solution mockups</h1>

      <div className="flex flex-wrap items-center gap-2">
        {SOLUTIONS.map((name) => (
          <Button
            key={name}
            size="sm"
            variant={name === tab ? 'default' : 'outline'}
            onClick={() => setTab(name)}
          >
            {name}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder={t('builder.searchSolutions')} className="h-8 w-64" />
        <Select defaultValue="generated">
          <SelectTrigger size="sm" className="ml-auto w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="generated">Generated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kind</TableHead>
            <TableHead>Screen path</TableHead>
            <TableHead>Link</TableHead>
            <TableHead>Mockup</TableHead>
            <TableHead>Generated at</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PRODUCTION_SCREENS.filter((entry) => entry.solution === tab).map((row, index) => (
            <TableRow key={index}>
              <TableCell>
                <span className="border-input rounded border px-1.5 py-0.5 text-xs">User</span>
              </TableCell>
              <TableCell className="text-primary underline-offset-2 hover:underline">
                {row.nested && <span className="text-muted-foreground mr-1">›</span>}
                {row.path}
              </TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs">{row.route}</TableCell>
              <TableCell>
                <StatusChip {...row.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">{row.capturedAt}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled
                    title={t('misc.notMockup')}
                  >
                    <ExternalLink className="size-3" />
                    Open site
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled
                    title={t('misc.notMockup')}
                  >
                    <Copy className="size-3" />
                    Copy to work mockups
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled
                    aria-label={t('builder.editSolution')}
                    title={t('misc.notMockup')}
                  >
                    <FileEdit className="size-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
