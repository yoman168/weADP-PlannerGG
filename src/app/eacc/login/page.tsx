'use client';

import { BookOpen, Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Card, Input, Label, Separator } from '@/components/ui';
import { EditableSection, filterOn, useSectionConfig } from '@/components/eacc/editable-section';

/* ------------------------------------------------------------------ */
/* Defaults                                                             */
/* ------------------------------------------------------------------ */

const BRAND_DEFAULTS = {
  visible: true,
  sectionType: 'header' as const,
  label: 'Brand',
  title: 'eACC Cloud',
  subtitle: 'Sign in to your workspace',
};

const FORM_DEFAULTS = {
  visible: true,
  sectionType: 'filters' as const,
  label: 'Sign-in Form',
  filters: [
    { key: 'email', label: 'Email', visible: true },
    { key: 'password', label: 'Password', visible: true },
    { key: 'remember', label: 'Remember me', visible: true },
    { key: 'sso', label: 'Company SSO', visible: true },
  ],
};

const FOOTER_DEFAULTS = {
  visible: true,
  sectionType: 'custom' as const,
  label: 'Footer Note',
};

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);

  const brand = useSectionConfig('login-brand', BRAND_DEFAULTS);
  const form = useSectionConfig('login-form', FORM_DEFAULTS);

  return (
    <div className="flex min-h-full items-center justify-center bg-gray-50 p-6 dark:bg-gray-950">
      <div className="flex w-full max-w-sm flex-col gap-5">
        <EditableSection id="login-brand" defaults={BRAND_DEFAULTS}>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-11 items-center justify-center rounded-xl bg-blue-600">
              <BookOpen className="size-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">{brand.title}</h1>
            <p className="text-muted-foreground text-sm">{brand.subtitle}</p>
          </div>
        </EditableSection>

        <EditableSection id="login-form" defaults={FORM_DEFAULTS}>
          <Card className="flex flex-col gap-4 p-5 shadow-sm">
            {filterOn(form, 'email') && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-email" className="text-xs">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="h-9 pl-8 text-sm"
                  />
                </div>
              </div>
            )}

            {filterOn(form, 'password') && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-password" className="text-xs">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-9 pl-8 text-sm"
                  />
                </div>
              </div>
            )}

            {filterOn(form, 'remember') && (
              <div className="flex items-center justify-between">
                <label className="text-muted-foreground flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="size-3.5 accent-blue-600"
                  />
                  Remember me
                </label>
                <button type="button" className="text-xs text-blue-600 dark:text-blue-400">
                  Forgot password?
                </button>
              </div>
            )}

            <Button asChild className="w-full">
              <Link href="/eacc/dashboard">Sign in</Link>
            </Button>

            {filterOn(form, 'sso') && (
              <>
                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-muted-foreground text-[10px] uppercase">or</span>
                  <Separator className="flex-1" />
                </div>

                <Button variant="outline" className="w-full">
                  Continue with company SSO
                </Button>
              </>
            )}
          </Card>
        </EditableSection>

        <EditableSection id="login-footer" defaults={FOOTER_DEFAULTS}>
          <p className="text-muted-foreground text-center font-mono text-[11px]">
            JWT · HS256 · 24h session · SSO deferred to phase 2
          </p>
        </EditableSection>
      </div>
    </div>
  );
}
