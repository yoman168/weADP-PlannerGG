'use client';

import { ArrowLeft, Mail, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Card, Input, Label, Separator } from '@/components/ui';
import { EditableSection, useSectionConfig } from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Invite Team Member',
  subtitle: 'eACC Cloud > Settings > Invite',
};

const FORM_DEFAULTS = {
  visible: true,
  sectionType: 'custom' as const,
  label: 'Invite Form',
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

const ROLES = [
  { value: 'viewer', label: 'Viewer', desc: 'Can view reports and own expenses' },
  { value: 'submitter', label: 'Submitter', desc: 'Can create and submit expenses' },
  { value: 'approver', label: 'Approver', desc: 'Can approve team expenses' },
  { value: 'accountant', label: 'Accountant', desc: 'Full access to accounting features' },
  { value: 'admin', label: 'Admin', desc: 'Full access including settings' },
];

export default function SettingsInvitePage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('submitter');
  const [department, setDepartment] = useState('');
  const [sent, setSent] = useState(false);

  const header = useSectionConfig('settings-invite-header', HEADER_DEFAULTS);
  const selectedRole = ROLES.find((r) => r.value === role);

  return (
    <div className="flex min-h-full items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-md">
        <EditableSection id="settings-invite-header" defaults={HEADER_DEFAULTS}>
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

        <EditableSection id="settings-invite-form" defaults={FORM_DEFAULTS}>
          <Card className="flex flex-col gap-4 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <UserPlus className="text-muted-foreground size-4" />
              <span className="text-sm font-semibold">New invitation</span>
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-email" className="text-xs">Email address</Label>
              <div className="relative">
                <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                <Input
                  id="inv-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="h-9 pl-8 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-name" className="text-xs">Full name</Label>
              <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Choi Dongwook" className="h-9 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Role</Label>
                <select value={role} onChange={(e) => setRole(e.target.value)} className="bg-background h-9 rounded-md border px-3 text-sm outline-none">
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inv-dept" className="text-xs">Department</Label>
                <Input id="inv-dept" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Finance" className="h-9 text-sm" />
              </div>
            </div>

            {selectedRole && (
              <p className="text-muted-foreground rounded-md bg-blue-50 px-2.5 py-1.5 text-xs dark:bg-blue-950/20">
                <strong>{selectedRole.label}:</strong> {selectedRole.desc}
              </p>
            )}

            {sent && (
              <p className="flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2.5 py-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                <Mail className="size-3" />
                Invitation sent to {email || 'the provided address'}.
              </p>
            )}

            <Separator />

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href="/eacc/settings">Cancel</Link>
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-1.5"
                disabled={!email || sent}
                onClick={() => setSent(true)}
              >
                <Mail className="size-3.5" />
                Send invite
              </Button>
            </div>
          </Card>
        </EditableSection>
      </div>
    </div>
  );
}
