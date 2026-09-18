'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
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
import type { DesignProject } from '@/lib/we-adk-mock/projects';
import { CustomerField } from './customer-field';

export function EditProjectDialog({
  project,
  customerOptions = [],
  onClose,
  onSave,
}: {
  project: DesignProject | null;
  /** Customers already on the books, so an edit does not respell one of them. */
  customerOptions?: string[];
  onClose: () => void;
  onSave: (fields: NewProjectFields) => void;
}) {
  const [fields, setFields] = useState<NewProjectFields>({
    name: '',
    customer: '',
    owner: '',
    summary: '',
  });

  /* Named after what is being edited, the way the create dialog is. One dialog serves
     both workspaces, so "project" was the only word that fit — and the only one that
     matched neither list. */
  const noun = project?.archived === true ? 'customer' : 'product';

  useEffect(() => {
    if (project) {
      setFields({
        name: project.name,
        customer: project.customer,
        companyType: project.companyType,
        owner: project.owner,
        summary: project.summary,
      });
    }
  }, [project]);

  const set = (key: keyof NewProjectFields, value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  const ready = fields.name.trim() !== '';

  const submit = () => {
    if (!ready) return;
    onSave(fields);
  };

  const onKeyDown = (event: { key: string }) => {
    if (event.key === 'Enter') submit();
  };

  return (
    <Dialog open={project !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {noun}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-project-name">{noun === 'customer' ? 'Customer' : 'Name'}</Label>
            <Input
              id="edit-project-name"
              value={fields.name}
              onChange={(event) => set('name', event.target.value)}
              onKeyDown={onKeyDown}
              maxLength={MAX_PROJECT_NAME}
              autoFocus
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              {noun === 'customer' ? (
                <>
                  <Label
                    htmlFor="edit-project-company-type"
                    className="text-muted-foreground font-normal"
                  >
                    Company type
                  </Label>
                  <Input
                    id="edit-project-company-type"
                    value={fields.companyType ?? ''}
                    onChange={(event) => set('companyType', event.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Bank"
                  />
                </>
              ) : (
                <>
                  <Label
                    htmlFor="edit-project-customer"
                    className="text-muted-foreground font-normal"
                  >
                    Customer
                  </Label>
                  <CustomerField
                    id="edit-project-customer"
                    value={fields.customer}
                    options={customerOptions}
                    onChange={(next) => set('customer', next)}
                    onKeyDown={onKeyDown}
                  />
                </>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-project-owner" className="text-muted-foreground font-normal">
                Owner
              </Label>
              <Input
                id="edit-project-owner"
                value={fields.owner}
                onChange={(event) => set('owner', event.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-project-summary" className="text-muted-foreground font-normal">
              What it is for
            </Label>
            <Input
              id="edit-project-summary"
              value={fields.summary}
              onChange={(event) => set('summary', event.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" disabled={!ready} onClick={submit}>
            <Save className="size-3.5" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
