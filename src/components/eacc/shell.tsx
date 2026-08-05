'use client';

import { BookOpen, ChevronRight, PencilRuler, Settings, User, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge, Button, Separator, cn } from '@/components/ui';
import { EACC_NAV as NAV, type NavItem } from '@/lib/eacc/nav';
import { useEdit } from './edit-context';

/* ------------------------------------------------------------------ */
/* Sidebar                                                              */
/* ------------------------------------------------------------------ */

function SidebarItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
        active
          ? 'bg-primary text-primary-foreground font-medium'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && !active && (
        <Badge variant="danger" className="px-1.5 py-0 text-[10px]">
          {item.badge}
        </Badge>
      )}
    </Link>
  );
}

export function EaccSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-background">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-blue-600">
          <BookOpen className="size-4 text-white" />
        </div>
        <span className="font-semibold tracking-tight">eACC Cloud</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
        {NAV.map((group) => (
          <div key={group.title} className="flex flex-col gap-0.5">
            <p className="text-muted-foreground mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider">
              {group.title}
            </p>
            {group.items.map((item) => (
              <SidebarItem
                key={item.href}
                item={item}
                active={
                  pathname === item.href ||
                  (item.href !== '/eacc' && pathname.startsWith(item.href))
                }
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t px-3 py-3">
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <div className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full">
            <User className="size-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">Taehyuk Park</p>
            <p className="text-muted-foreground truncate text-[10px]">Accountant</p>
          </div>
          <Settings className="text-muted-foreground size-3.5 shrink-0" />
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                               */
/* ------------------------------------------------------------------ */

function Breadcrumb() {
  const pathname = usePathname();
  const all: NavItem[] = NAV.flatMap((g) => g.items);
  const segments = pathname.split('/').filter(Boolean);

  // Build breadcrumb: eACC > Group > Current page
  const current = all.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/'),
  );

  if (!current) return <span className="text-sm text-muted-foreground">eACC Cloud</span>;

  const group = NAV.find((g) => g.items.includes(current));

  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="text-muted-foreground">eACC Cloud</span>
      {group && (
        <>
          <ChevronRight className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{group.title}</span>
        </>
      )}
      <ChevronRight className="size-3.5 text-muted-foreground" />
      <span className="font-medium">{current.label}</span>
    </div>
  );
}

export function EaccHeader() {
  const { editMode, toggleEditMode } = useEdit();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background px-6">
      <Breadcrumb />

      <div className="flex items-center gap-2">
        {/* Edit mode badge */}
        {editMode && (
          <Badge variant="warning" className="gap-1 text-xs">
            <PencilRuler className="size-3" />
            Edit mode
          </Badge>
        )}

        <Button
          variant={editMode ? 'default' : 'outline'}
          size="sm"
          onClick={toggleEditMode}
          className="gap-1.5"
        >
          {editMode ? (
            <>
              <X className="size-3.5" />
              Exit Edit
            </>
          ) : (
            <>
              <PencilRuler className="size-3.5" />
              Edit UI
            </>
          )}
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          TP
        </div>
      </div>
    </header>
  );
}
