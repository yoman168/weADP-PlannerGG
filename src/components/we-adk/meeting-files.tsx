'use client';

import {
  Eye,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Link2,
  Mic,
  Paperclip,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { Button, cn } from '@/components/ui';
import { useLocale } from '@/lib/locale';
import {
  addUploadedFiles,
  formatFileSize,
  isReadableFileName,
  removeUploadedFile,
  type MeetingFile,
  type MeetingFileKind,
} from '@/lib/we-adk-mock/meeting-files';

/** Cap per file, so one long log cannot fill the localStorage budget. */
const MAX_TEXT_CHARS = 8000;
/** Only store dataUrl for images up to this size to avoid filling localStorage. */
const MAX_IMAGE_BYTES = 500_000;

const KIND_ICON: Record<MeetingFileKind, typeof FileText> = {
  pdf: FileText,
  doc: FileText,
  sheet: FileSpreadsheet,
  image: ImageIcon,
  audio: Mic,
  video: Video,
  link: Link2,
  zip: FileArchive,
};

const KIND_TONE: Record<MeetingFileKind, string> = {
  pdf: 'text-red-600 dark:text-red-400',
  doc: 'text-blue-600 dark:text-blue-400',
  sheet: 'text-emerald-600 dark:text-emerald-400',
  image: 'text-violet-600 dark:text-violet-400',
  audio: 'text-amber-600 dark:text-amber-400',
  video: 'text-amber-600 dark:text-amber-400',
  link: 'text-sky-600 dark:text-sky-400',
  zip: 'text-slate-600 dark:text-slate-400',
};

export function MeetingFileIcon({
  kind,
  className,
}: {
  kind: MeetingFileKind;
  className?: string;
}) {
  const Icon = KIND_ICON[kind];
  return <Icon className={cn('size-3.5 shrink-0', KIND_TONE[kind], className)} />;
}

/** Preview overlay — image or text, with a close button. */
function FilePreview({ file, onClose }: { file: MeetingFile; onClose: () => void }) {
  const { t } = useLocale();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-background relative flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <MeetingFileIcon kind={file.kind} className="size-4" />
          <span className="min-w-0 flex-1 truncate font-mono text-sm font-medium">{file.name}</span>
          <button
            type="button"
            aria-label={t('files.closePreview')}
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4">
          {file.dataUrl ? (
            <img
              src={file.dataUrl}
              alt={file.name}
              className="mx-auto max-h-[70dvh] max-w-full rounded object-contain"
            />
          ) : file.text ? (
            <pre className="text-foreground/80 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
              {file.text}
            </pre>
          ) : (
            <div className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-sm">
              <MeetingFileIcon kind={file.kind} className="size-10 opacity-30" />
              <p>{t('files.noPreview')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-muted-foreground border-t px-4 py-2 text-[10px]">
          {formatFileSize(file.sizeKb)} · {file.uploadedBy} · {file.uploadedAt}
        </div>
      </div>
    </div>
  );
}

/** One reference file: what it is, how big, who put it there and why. */
function FileRow({
  file,
  onRemove,
  onPreview,
}: {
  file: MeetingFile;
  onRemove?: (file: MeetingFile) => void;
  onPreview?: (file: MeetingFile) => void;
}) {
  const { t } = useLocale();
  const canPreview = Boolean(file.dataUrl ?? file.text);
  return (
    <div className="group flex items-start gap-2 py-1.5 text-xs">
      <MeetingFileIcon kind={file.kind} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-mono">{file.name}</span>
          {file.uploaded === true && (
            <span className="text-muted-foreground shrink-0 text-[10px]">{t('files.new')}</span>
          )}
        </div>
        {file.note && <p className="text-muted-foreground leading-relaxed">{file.note}</p>}
        <p className="text-muted-foreground text-[10px]">
          {formatFileSize(file.sizeKb)} · {file.uploadedBy} · {file.uploadedAt}
          {(file.text ?? '').length > 0 ? ' · text read' : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {canPreview && onPreview && (
          <button
            type="button"
            aria-label={`Preview ${file.name}`}
            title={t('files.preview')}
            onClick={() => onPreview(file)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Eye className="size-3" />
          </button>
        )}
        {onRemove && file.uploaded === true && (
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            title={t('files.removeFile')}
            onClick={() => onRemove(file)}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Read-only summary for the project overview: count plus the first few names. */
export function MeetingFileSummary({ files }: { files: MeetingFile[] }) {
  const { t } = useLocale();
  if (files.length === 0) {
    return <p className="text-muted-foreground text-xs">{t('files.noAttached')}</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="text-muted-foreground flex items-center gap-1.5">
        <Paperclip className="size-3.5" />
        {files.length} file{files.length === 1 ? '' : 's'}
      </span>
      {files.slice(0, 3).map((file) => (
        <span key={file.id} className="text-muted-foreground flex items-center gap-1">
          <MeetingFileIcon kind={file.kind} />
          <span className="max-w-[16rem] truncate font-mono">{file.name}</span>
        </span>
      ))}
      {files.length > 3 && <span className="text-muted-foreground">+{files.length - 3} more</span>}
    </div>
  );
}

/**
 * Reference files for one meeting, with attach and preview. Uploaded images
 * are stored as data URLs; text-ish files have their content read; everything
 * else is recorded by name and size only.
 */
export function MeetingFilePanel({
  sessionId,
  files,
  uploadedBy,
  onChange,
  className,
}: {
  sessionId: string;
  files: MeetingFile[];
  uploadedBy: string;
  onChange: (uploaded: MeetingFile[]) => void;
  className?: string;
}) {
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<MeetingFile | null>(null);

  const readAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const attach = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    if (picked.length === 0) return;

    const entries = await Promise.all(
      picked.map(async (file) => ({
        name: file.name,
        sizeKb: Math.round(file.size / 1024),
        text: isReadableFileName(file.name)
          ? (await file.text().catch(() => '')).slice(0, MAX_TEXT_CHARS)
          : undefined,
        dataUrl:
          file.type.startsWith('image/') && file.size <= MAX_IMAGE_BYTES
            ? await readAsDataUrl(file).catch(() => undefined)
            : undefined,
      })),
    );

    const created = addUploadedFiles(
      sessionId,
      entries,
      uploadedBy,
      new Date().toISOString().slice(0, 10),
    );
    onChange(created);
    const read = created.filter((f) => (f.text ?? '').length > 0).length;
    const previewed = created.filter((f) => f.dataUrl).length;
    const parts: string[] = [
      `Attached ${created.length} reference${created.length === 1 ? '' : 's'}`,
    ];
    if (read > 0) parts.push(`text read from ${read}`);
    if (previewed > 0)
      parts.push(`${previewed} image${previewed === 1 ? '' : 's'} ready to preview`);
    setNote(parts.join(' · ') + '.');
    event.target.value = '';
    window.setTimeout(() => setNote(null), 5000);
  };

  const remove = (file: MeetingFile) => {
    removeUploadedFile(sessionId, file.id);
    onChange([]);
  };

  return (
    <>
      <div className={cn('flex flex-col gap-2', className)}>
        <div className="flex flex-wrap items-center gap-2">
          <Paperclip className="size-4" />
          <p className="text-sm font-semibold">{t('files.referenceFiles')}</p>
          <span className="text-muted-foreground text-xs">{files.length}</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-7 gap-1 px-2 text-xs"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-3" />
            {t('files.attach')}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            aria-label={t('files.attachRef')}
            onChange={(event) => void attach(event)}
          />
        </div>

        {files.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            {t('files.noAttached')}
          </p>
        ) : (
          <div className="flex flex-col divide-y">
            {files.map((file) => (
              <FileRow key={file.id} file={file} onRemove={remove} onPreview={setPreviewFile} />
            ))}
          </div>
        )}

        {note && <p className="text-muted-foreground text-[10px]">{note}</p>}
      </div>

      {previewFile && <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />}
    </>
  );
}
