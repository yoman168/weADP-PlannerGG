'use client';

/**
 * What the board produced, as cards under it.
 *
 * A card is the picture first: a board is recognised by looking at it, not by
 * reading `whiteboard-2.png` in a list. The caption sits underneath because it is
 * the part a reader needs and the part the brief quotes.
 */
import { Download, ImageOff, Pencil, Presentation, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, cn } from '@/components/ui';
import {
  KIND_LABEL,
  artifactFileName,
  loadArtifacts,
  removeArtifact,
  type BoardArtifact,
} from '@/lib/we-adk/board-artifacts';

function Preview({ artifact, onClose }: { artifact: BoardArtifact; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-background relative flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-xl shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Presentation className="size-4" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{artifact.title}</span>
          <button
            type="button"
            aria-label="Close preview"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded p-0.5"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {artifact.dataUrl ? (
            <img
              src={artifact.dataUrl}
              alt={artifact.caption ?? artifact.title}
              className="mx-auto max-h-[70dvh] max-w-full rounded object-contain"
            />
          ) : (
            <p className="text-muted-foreground py-12 text-center text-sm">
              The picture was too large to keep — only the card survived.
            </p>
          )}
        </div>
        {artifact.caption && (
          <p className="text-muted-foreground border-t px-4 py-2 text-xs">{artifact.caption}</p>
        )}
      </div>
    </div>
  );
}

export function BoardCards({
  sessionId,
  /** Bumped by the board when it saves, so the cards reload. */
  refreshKey,
  onEdit,
  className,
}: {
  sessionId: string;
  refreshKey: unknown;
  /** Reopen this card on the board it came from. */
  onEdit: (artifact: BoardArtifact) => void;
  className?: string;
}) {
  const [artifacts, setArtifacts] = useState<BoardArtifact[]>([]);
  const [preview, setPreview] = useState<BoardArtifact | null>(null);

  // localStorage, so after mount rather than during render.
  useEffect(() => {
    setArtifacts(loadArtifacts(sessionId));
  }, [sessionId, refreshKey]);

  if (artifacts.length === 0) return null;

  return (
    <>
      <div className={cn('flex flex-col gap-2', className)}>
        <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium">
          <Presentation className="size-3" />
          From the board
          <span className="text-muted-foreground/70">{artifacts.length}</span>
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {artifacts.map((artifact) => (
            <div
              key={artifact.id}
              className="group bg-background flex min-w-0 flex-col overflow-hidden rounded-md border"
            >
              <button
                type="button"
                onClick={() => setPreview(artifact)}
                title={`Open ${artifact.title}`}
                className="bg-muted/30 hover:bg-muted/50 flex h-28 items-center justify-center transition-colors"
              >
                {artifact.dataUrl ? (
                  <img
                    src={artifact.dataUrl}
                    alt={artifact.caption ?? artifact.title}
                    className="max-h-28 max-w-full object-contain"
                  />
                ) : (
                  <ImageOff className="text-muted-foreground/50 size-5" />
                )}
              </button>

              <div className="flex min-w-0 items-start gap-1.5 px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-xs font-medium">{artifact.title}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {KIND_LABEL[artifact.kind].toLowerCase()}
                    </Badge>
                  </div>
                  {artifact.caption && (
                    <p className="text-muted-foreground truncate text-[11px]">{artifact.caption}</p>
                  )}
                  <p className="text-muted-foreground/80 text-[10px]">
                    {artifact.sizeKb} KB · {artifact.createdBy} ·{' '}
                    {artifact.updatedAt ? `edited ${artifact.updatedAt}` : artifact.createdAt}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  {/* Only offered when the card carries what the editor needs. A
                      card saved before boards kept their model has nothing to
                      reopen, and a disabled pencil explains that better than a
                      button that opens an empty board. */}
                  {artifact.source !== undefined || artifact.scene !== undefined ? (
                    <button
                      type="button"
                      aria-label={`Edit ${artifact.title}`}
                      title={`Edit ${artifact.title}`}
                      onClick={() => onEdit(artifact)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="size-3" />
                    </button>
                  ) : (
                    <span
                      title="Saved before boards kept their model, so this one cannot be reopened"
                      className="text-muted-foreground/40"
                    >
                      <Pencil className="size-3" />
                    </span>
                  )}
                  {artifact.dataUrl && (
                    <a
                      href={artifact.dataUrl}
                      download={artifactFileName(artifact)}
                      title={`Download ${artifactFileName(artifact)}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Download className="size-3" />
                    </a>
                  )}
                  <button
                    type="button"
                    aria-label={`Delete ${artifact.title}`}
                    title="Delete"
                    onClick={() => setArtifacts(removeArtifact(sessionId, artifact.id))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {preview && <Preview artifact={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
