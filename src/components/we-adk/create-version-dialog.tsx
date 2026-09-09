'use client';

/**
 * Opening the next round, from wherever you happen to be.
 *
 * Business, Design and Developer all need this: Business because that is where
 * rounds are organised, Design because a round with no design system assigned is
 * the one you are looking at when you decide to start another, and Developer
 * because the rail is where you notice the current round has shipped. One dialog
 * for all three, so the wording, the naming rule and the copy-forward warning
 * cannot drift between them.
 *
 * The name is optional. The number is the round's identity — branches, build
 * seeds and task scopes are keyed on it — so this only ever adds a label on top,
 * and the placeholder shows exactly what the round is called without one.
 */

import { useEffect, useState } from 'react';
import { FolderPlus } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@/components/ui';
import { MAX_VERSION_NAME } from '@/lib/we-adk-mock/versions';

export function CreateVersionDialog({
  open,
  /** The number the round will get, so the dialog can name it before it exists. */
  nextVersion,
  /** The completed round it will be copied from, or null when none has shipped. */
  copyFrom,
  onClose,
  onCreate,
}: {
  open: boolean;
  nextVersion: number;
  copyFrom?: number | null;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');

  // Cleared on open rather than on close, so the field is empty every time it is
  // reached and a half-typed name cannot leak into the next round.
  useEffect(() => {
    if (open) setName('');
  }, [open]);

  /**
   * A name is required, so an empty field cannot get through.
   *
   * The number arrives on its own — it is the round's identity and nobody has to
   * type it. The name is the part only a person can supply, and a round that
   * shipped as "version 8" tells whoever reads the list later nothing about what
   * it was for.
   */
  const ready = name.trim() !== '';

  const submit = () => {
    if (!ready) return;
    onCreate(name);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New version</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="version-name">Name</Label>
            <Input
              id="version-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit();
              }}
              maxLength={MAX_VERSION_NAME}
              // An example, not the default. The old placeholder was
              // `version 8`, which read as "leave this and you get that" — and
              // that is exactly what is no longer on offer.
              placeholder="Approval rework"
              autoFocus
            />
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              What this round is for. It will still be version {nextVersion} underneath, so branches
              and builds keep the number.
            </p>
          </div>

          <p className="bg-muted/40 text-muted-foreground rounded-lg px-3 py-2 text-[11px] leading-relaxed">
            {copyFrom == null ? (
              <>
                It opens empty — no round has been completed yet, so there is nothing to copy from.
                A round still in progress is never copied.
              </>
            ) : (
              <>
                It opens as a copy of version {copyFrom}, the last completed round — its designs and
                the folders they are organised into — so you start from where the product is.
              </>
            )}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            disabled={!ready}
            onClick={submit}
            title={ready ? undefined : 'Give the round a name first'}
          >
            <FolderPlus className="size-3.5" />
            Create new version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
