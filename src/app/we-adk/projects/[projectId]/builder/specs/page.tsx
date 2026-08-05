'use client';

import { FileText } from 'lucide-react';
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
import { FEATURE_SPECS } from '@/lib/we-adk-mock/builder';

export default function FeatureSpecsPage() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Feature specs</h1>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder={t('builder.searchSpecs')} className="h-8 w-64" />
        <Select defaultValue="all">
          <SelectTrigger size="sm" className="ml-auto w-32">
            <SelectValue placeholder={t('builder.specStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kind</TableHead>
            <TableHead>Screen path</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Spec</TableHead>
            <TableHead>Generated</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {FEATURE_SPECS.map((row, index) => (
            <TableRow key={index}>
              <TableCell>
                <span className="border-input rounded border px-1.5 py-0.5 text-xs">
                  {row.kind}
                </span>
              </TableCell>
              <TableCell className="font-medium">{row.path}</TableCell>
              <TableCell className="text-muted-foreground max-w-md truncate">
                {row.description}
              </TableCell>
              <TableCell>
                <StatusChip {...row.specStatus} />
              </TableCell>
              <TableCell className="text-muted-foreground">{row.generatedAt}</TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  disabled={row.specStatus.label === 'None'}
                  title={
                    row.specStatus.label === 'None'
                      ? 'No spec generated yet'
                      : 'Not part of this mockup'
                  }
                >
                  <FileText className="size-3" />
                  View spec
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
