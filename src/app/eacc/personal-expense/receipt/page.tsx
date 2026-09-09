'use client';

import { ArrowLeft, FileUp, ImageIcon, Trash2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, Label, Separator } from '@/components/ui';
import { EditableSection, useSectionConfig } from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Attach Receipt',
  subtitle: 'eACC Cloud > Expense Management > Personal Expense',
};

const UPLOAD_DEFAULTS = {
  visible: true,
  sectionType: 'custom' as const,
  label: 'Upload Area',
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

interface MockFile {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'image';
}

export default function PersonalExpenseReceiptPage() {
  const [files, setFiles] = useState<MockFile[]>([
    { id: 'f-1', name: 'taxi-receipt-0816.jpg', size: '284 KB', type: 'image' },
  ]);

  const header = useSectionConfig('pe-receipt-header', HEADER_DEFAULTS);

  const addMockFile = () => {
    const next: MockFile = {
      id: `f-${Date.now()}`,
      name: `receipt-scan-${files.length + 1}.pdf`,
      size: '412 KB',
      type: 'pdf',
    };
    setFiles((prev) => [...prev, next]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-md">
        <EditableSection id="pe-receipt-header" defaults={HEADER_DEFAULTS}>
          <div className="mb-4 flex items-center gap-3">
            <Button variant="outline" size="sm" className="size-8 shrink-0 p-0" asChild>
              <Link href="/eacc/personal-expense" aria-label="Back to personal expense list">
                <ArrowLeft className="size-3.5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                {header.subtitle}
              </p>
              <h1 className="mt-0.5 text-lg font-bold tracking-tight">{header.title}</h1>
            </div>
          </div>
        </EditableSection>

        <EditableSection id="pe-receipt-upload" defaults={UPLOAD_DEFAULTS}>
          <Card className="flex flex-col gap-4 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Upload className="text-muted-foreground size-4" />
              <span className="text-sm font-semibold">PE-2026-00312 · Park Seongmin</span>
            </div>

            <Separator />

            {/* Drop zone */}
            <button
              type="button"
              onClick={addMockFile}
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed py-8 transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
            >
              <FileUp className="text-muted-foreground size-8" />
              <span className="text-muted-foreground text-xs">
                Click or drag files here to upload
              </span>
              <span className="text-muted-foreground text-[11px]">
                PDF, JPG, PNG up to 10 MB
              </span>
            </button>

            {/* File list */}
            {files.length > 0 && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Attached files</Label>
                {files.map((file) => (
                  <div key={file.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                    {file.type === 'image' ? (
                      <ImageIcon className="text-muted-foreground size-3.5 shrink-0" />
                    ) : (
                      <FileUp className="text-muted-foreground size-3.5 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{file.size}</Badge>
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      className="text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href="/eacc/personal-expense">Cancel</Link>
              </Button>
              <Button size="sm" className="flex-1" asChild>
                <Link href="/eacc/personal-expense">Save</Link>
              </Button>
            </div>
          </Card>
        </EditableSection>
      </div>
    </div>
  );
}
