'use client';

import { Building2, Coins, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, Input, Label, Separator, Switch, cn } from '@/components/ui';
import {
  EditableSection,
  columnLabel,
  columnOn,
  filterOn,
  useSectionConfig,
} from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Mock data                                                            */
/* ------------------------------------------------------------------ */

interface Member {
  id: string;
  name: string;
  email: string;
  role: 'Accountant' | 'Approver' | 'Member' | 'Admin';
  status: 'Active' | 'Invited';
}

const MEMBERS: Member[] = [
  {
    id: 'm-1',
    name: 'Taehyuk Park',
    email: 'taehyuk.park@kosign.com',
    role: 'Accountant',
    status: 'Active',
  },
  {
    id: 'm-2',
    name: 'Lee Jiyeon',
    email: 'jiyeon.lee@kosign.com',
    role: 'Approver',
    status: 'Active',
  },
  { id: 'm-3', name: 'Kim Minsu', email: 'minsu.kim@kosign.com', role: 'Member', status: 'Active' },
  {
    id: 'm-4',
    name: 'Namwon Moon',
    email: 'namwon.moon@kosign.com',
    role: 'Admin',
    status: 'Active',
  },
  {
    id: 'm-5',
    name: 'Choi Dongwook',
    email: 'dongwook.choi@kosign.com',
    role: 'Member',
    status: 'Invited',
  },
];

const ROLE_VARIANT: Record<Member['role'], 'info' | 'success' | 'secondary' | 'warning'> = {
  Accountant: 'success',
  Approver: 'info',
  Member: 'secondary',
  Admin: 'warning',
};

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const HEADER_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Page Header',
  title: 'Settings',
  subtitle: 'Administration > Workspace settings',
};

const COMPANY_DEFAULTS = {
  visible: true,
  sectionType: 'filters' as const,
  label: 'Company Fields',
  filters: [
    { key: 'name', label: 'Company name', visible: true },
    { key: 'bizNo', label: 'Business number', visible: true },
    { key: 'currency', label: 'Base currency', visible: true },
    { key: 'fiscal', label: 'Fiscal year start', visible: true },
  ],
};

const CLOSE_DEFAULTS = {
  visible: true,
  sectionType: 'custom' as const,
  label: 'Close Policy',
};

const MEMBERS_DEFAULTS = {
  visible: true,
  sectionType: 'table' as const,
  label: 'Members Table',
  columns: [
    { key: 'name', label: 'Name', visible: true },
    { key: 'email', label: 'Email', visible: true },
    { key: 'role', label: 'Role', visible: true },
    { key: 'status', label: 'Status', visible: true },
  ],
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

function Toggle({
  title,
  detail,
  checked,
  onChange,
}: {
  title: string;
  detail: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{detail}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function SettingsPage() {
  const [autoClose, setAutoClose] = useState(true);
  const [requireEvidence, setRequireEvidence] = useState(true);
  const [bulkPerMonth, setBulkPerMonth] = useState(true);
  const [notifyReturned, setNotifyReturned] = useState(false);

  const header = useSectionConfig('settings-header', HEADER_DEFAULTS);
  const company = useSectionConfig('settings-company', COMPANY_DEFAULTS);
  const table = useSectionConfig('settings-members', MEMBERS_DEFAULTS);
  const th = (key: string, fallback: string) => columnLabel(table, key, fallback);

  return (
    <div className="flex flex-col gap-6 p-6">
      <EditableSection id="settings-header" defaults={HEADER_DEFAULTS}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              {header.subtitle}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{header.title}</h1>
          </div>
          <Button size="sm">Save changes</Button>
        </div>
      </EditableSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <EditableSection id="settings-company" defaults={COMPANY_DEFAULTS}>
          <Card className="flex h-full flex-col gap-4 p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Building2 className="text-muted-foreground size-4" />
              <h2 className="text-sm font-semibold">Company</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {filterOn(company, 'name') && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Company name</Label>
                  <Input defaultValue="KOSIGN Cloud" className="h-9 text-sm" />
                </div>
              )}
              {filterOn(company, 'bizNo') && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Business number</Label>
                  <Input defaultValue="220-81-95788" className="h-9 font-mono text-xs" />
                </div>
              )}
              {filterOn(company, 'currency') && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Base currency</Label>
                  <Input defaultValue="KRW (₩)" className="h-9 text-sm" />
                </div>
              )}
              {filterOn(company, 'fiscal') && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Fiscal year start</Label>
                  <Input defaultValue="January" className="h-9 text-sm" />
                </div>
              )}
            </div>
            <Separator />
            <div className="flex items-center gap-2 text-xs">
              <Coins className="text-muted-foreground size-3.5" />
              <span className="text-muted-foreground">
                Multi-tenant workspace · 6 solutions on this cloud
              </span>
            </div>
          </Card>
        </EditableSection>

        <EditableSection id="settings-close" defaults={CLOSE_DEFAULTS}>
          <Card className="flex h-full flex-col gap-1 p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck className="text-muted-foreground size-4" />
              <h2 className="text-sm font-semibold">Close &amp; approval policy</h2>
            </div>
            <Toggle
              title="Close the month automatically"
              detail="Locks the period once every cost centre reports complete."
              checked={autoClose}
              onChange={setAutoClose}
            />
            <Toggle
              title="Require evidence before approval"
              detail="A charge with no receipt cannot be approved, in bulk or one by one."
              checked={requireEvidence}
              onChange={setRequireEvidence}
            />
            <Toggle
              title="Bulk approve by calendar month"
              detail="Approves the whole month rather than the current selection."
              checked={bulkPerMonth}
              onChange={setBulkPerMonth}
            />
            <Toggle
              title="Email the submitter on return"
              detail="Off by default — the returned tab already shows it."
              checked={notifyReturned}
              onChange={setNotifyReturned}
            />
          </Card>
        </EditableSection>
      </div>

      <EditableSection id="settings-members" defaults={MEMBERS_DEFAULTS}>
        <Card className="shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Users className="text-muted-foreground size-4" />
              <h2 className="text-sm font-semibold">Members</h2>
            </div>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
              Invite member
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground border-b text-xs font-medium">
                  {columnOn(table, 'name') && <th className="py-2.5 pl-4">{th('name', 'Name')}</th>}
                  {columnOn(table, 'email') && (
                    <th className="px-3 py-2.5">{th('email', 'Email')}</th>
                  )}
                  {columnOn(table, 'role') && <th className="px-3 py-2.5">{th('role', 'Role')}</th>}
                  {columnOn(table, 'status') && (
                    <th className="py-2.5 pr-4">{th('status', 'Status')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {MEMBERS.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/40 border-b last:border-0">
                    {columnOn(table, 'name') && (
                      <td className="py-3 pl-4 text-sm font-medium">{member.name}</td>
                    )}
                    {columnOn(table, 'email') && (
                      <td className="text-muted-foreground px-3 py-3 font-mono text-xs">
                        {member.email}
                      </td>
                    )}
                    {columnOn(table, 'role') && (
                      <td className="px-3 py-3">
                        <Badge variant={ROLE_VARIANT[member.role]} className="text-[11px]">
                          {member.role}
                        </Badge>
                      </td>
                    )}
                    {columnOn(table, 'status') && (
                      <td className="py-3 pr-4">
                        <span
                          className={cn(
                            'text-xs',
                            member.status === 'Active'
                              ? 'text-muted-foreground'
                              : 'text-amber-600 dark:text-amber-400',
                          )}
                        >
                          {member.status}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </EditableSection>
    </div>
  );
}
