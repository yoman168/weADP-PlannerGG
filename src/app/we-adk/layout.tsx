import { type ReactNode } from 'react';
import { LocaleProvider } from '@/lib/locale';
import { WeAdkShell } from '@/components/we-adk/we-adk-shell';

export const metadata = { title: 'WE-ADK — Design system' };

export default function WeAdkLayout({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <WeAdkShell>{children}</WeAdkShell>
    </LocaleProvider>
  );
}
