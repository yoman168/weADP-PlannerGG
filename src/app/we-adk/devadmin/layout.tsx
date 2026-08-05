'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { cn } from '@/components/ui';

const NAV = [
  { href: '/we-adk/devadmin', label: 'Dashboard' },
  { href: '/we-adk/devadmin/analysis', label: 'Analysis' },
  { href: '/we-adk/devadmin/coaching', label: 'User coaching' },
  { href: '/we-adk/devadmin/security', label: 'Security' },
];

export default function DevAdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex items-center gap-1 border-b">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
