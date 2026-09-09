'use client';

/**
 * Starting a project.
 *
 * Only the name is required. The other three are the questions someone would ask
 * you about a project a week later — who it is for, who is running it, what it is
 * — and they are worth a field each while you still have the answer in your head,
 * but a project you cannot create until you know its customer is a project you
 * write on paper instead.
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
import { MAX_PROJECT_NAME, type NewProjectFields } from '@/lib/we-adk-mock/created-projects';

const EMPTY: NewProjectFields = { name: '', customer: '', owner: '', summary: '' };

/** "Untitled customer", then "Untitled customer 2", and so on. */
function untitledName(noun: string, taken: string[]): string {
  const base = `Untitled ${noun}`;
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export function CreateProjectDialog({
  open,
  onClose,
  onCreate,
  noun = 'project',
  initial,
  existingNames = [],
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (fields: NewProjectFields) => void;
  /** What the tab in view calls the thing being made — "customer", "product". */
  noun?: string;
  /** Values to start from — set when copying an existing project. */
  initial?: NewProjectFields;
  /** Names already taken, so a defaulted one does not collide. */
  existingNames?: string[];
}) {
  const [fields, setFields] = useState<NewProjectFields>(initial ?? EMPTY);

  // Reset on open rather than on close, so the form starts from the same place
  // every time it is reached and an abandoned draft cannot leak into the next
  // project.
  useEffect(() => {
    if (open) setFields(initial ?? EMPTY);
  }, [open, initial]);

  const set = (key: keyof NewProjectFields, value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  /**
   * A project with no name is still a project — the rest of the form can be
   * filled in later, and blocking on a name only stops someone getting to the
   * thing they came to make. The name is defaulted instead, numbered so a
   * second unnamed one is still tellable from the first.
   */
  const submit = () => {
    const name = fields.name.trim() || untitledName(noun, existingNames);
    onCreate({ ...fields, name });
    onClose();
  };

  // Enter submits from any single-line field — the form is short enough that
  // reaching for the button is the slower path.
  const onKeyDown = (event: { key: string }) => {
    if (event.key === 'Enter') submit();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New {noun}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={fields.name}
              onChange={(event) => set('name', event.target.value)}
              onKeyDown={onKeyDown}
              maxLength={MAX_PROJECT_NAME}
              placeholder="Fleet portal"
              autoFocus
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-customer" className="text-muted-foreground font-normal">
                Customer
              </Label>
              <Input
                id="project-customer"
                value={fields.customer}
                onChange={(event) => set('customer', event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="KOSIGN Logistics"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-owner" className="text-muted-foreground font-normal">
                Owner
              </Label>
              <Input
                id="project-owner"
                value={fields.owner}
                onChange={(event) => set('owner', event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Taehyuk Park (PL)"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-summary" className="text-muted-foreground font-normal">
              What it is for
            </Label>
            <Input
              id="project-summary"
              value={fields.summary}
              onChange={(event) => set('summary', event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Replaces the spreadsheet the dispatchers keep."
            />
          </div>

          <p className="bg-muted/40 text-muted-foreground rounded-lg px-3 py-2 text-[11px] leading-relaxed">
            It opens empty at version 1 — no meetings, no designs, nothing captured from a live
            product. Open a version to start drawing.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            onClick={submit}
            title={fields.name.trim() ? undefined : `Creates it as "Untitled ${noun}"`}
          >
            <FolderPlus className="size-3.5" />
            Create {noun}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
