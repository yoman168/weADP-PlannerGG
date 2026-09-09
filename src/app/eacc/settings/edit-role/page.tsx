'use client';

import { ArrowLeft, Shield, UserCog } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, Label, Separator, cn } from '@/components/ui';
import { EditableSection, useSectionConfig } from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Mock data                                                            */
/* ------------------------------------------------------------------ */

const MEMBER = {
  name: 'Jung Minjae',
  email: 'j.minjae@company.com',
  department: 'Sales',
  currentRole: 'submitter',
  joinedAt: '2025-11-02',
};

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Edit Role',
  subtitle: 'eACC Cloud > Settings > Edit Role',
};

const FORM_DEFAULTS = {
  visible: true,
  sectionType: 'custom' as const,
  label: 'Role Form',
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

const ROLES = [
  { value: 'viewer', label: 'Viewer', desc: 'View reports and own expenses only' },
  { value: 'submitter', label: 'Submitter', desc: 'Create and submit expenses' },
  { value: 'approver', label: 'Approver', desc: 'Approve team expenses' },
  { value: 'accountant', label: 'Accountant', desc: 'Full accounting access' },
  { value: 'admin', label: 'Admin', desc: 'Full access including settings' },
];

export default function SettingsEditRolePage() {
  const [role, setRole] = useState(MEMBER.currentRole);
  const [saved, setSaved] = useState(false);

  const header = useSectionConfig('settings-editrole-header', HEADER_DEFAULTS);

  return (
    <div className="flex min-h-full items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-md">
        <EditableSection id="settings-editrole-header" defaults={HEADER_DEFAULTS}>
          <div className="mb-4 flex items-center gap-3">
            <Button variant="outline" size="sm" className="size-8 shrink-0 p-0" asChild>
              <Link href="/eacc/settings" aria-label="Back to settings">
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

        <EditableSection id="settings-editrole-form" defaults={FORM_DEFAULTS}>
          <Card className="flex flex-col gap-4 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <UserCog className="text-muted-foreground size-4" />
              <span className="text-sm font-semibold">Member details</span>
            </div>

            <div className="flex flex-col gap-1 rounded-md border px-3 py-2.5">
              <span className="text-sm font-medium">{MEMBER.name}</span>
              <span className="text-muted-foreground text-xs">{MEMBER.email}</span>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{MEMBER.department}</Badge>
                <span className="text-muted-foreground text-[11px]">Joined {MEMBER.joinedAt}</span>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1.5 text-xs">
                <Shield className="size-3" />
                Assign role
              </Label>
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors',
                    role === r.value
                      ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/20'
                      : 'hover:bg-muted/40',
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={() => { setRole(r.value); setSaved(false); }}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <span className="text-sm font-medium">{r.label}</span>
                    <p className="text-muted-foreground text-xs">{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {saved && (
              <p className="flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2.5 py-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                Role updated to {ROLES.find((r) => r.value === role)?.label} for {MEMBER.name}.
              </p>
            )}

            <Separator />

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href="/eacc/settings">Cancel</Link>
              </Button>
              <Button
                size="sm"
                className="flex-1"
                disabled={role === MEMBER.currentRole || saved}
                onClick={() => setSaved(true)}
              >
                Save changes
              </Button>
            </div>
          </Card>
        </EditableSection>
      </div>
    </div>
  );
}
