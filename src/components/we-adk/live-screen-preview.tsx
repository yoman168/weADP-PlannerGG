'use client';

/**
 * A design file rendered as the screen it actually is.
 *
 * The eACC prototype html files — and the older design files that stand for a
 * shipped screen — mount the real page component here, wrapped in a static copy
 * of the eACC shell: sidebar, breadcrumb, avatar. The chrome is deliberately
 * inert; it is there so the screen reads in context, not to be navigated. The
 * page itself stays interactive, so filters and search behave as they do live.
 *
 * With `editable`, the preview also carries the app's own layout editor: turn
 * on Edit UI, click a section, and the properties panel shows what can be
 * changed. Those edits are stored per file, so each html file keeps its own
 * variant of the screen.
 */
import { BookOpen, ChevronRight, PencilRuler, RotateCcw, Settings, User, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ComponentType, type MouseEvent, type ReactNode } from 'react';
import { Badge, Button, cn } from '@/components/ui';
import { EditProvider, useEdit, type SiteConfig } from '@/components/eacc/edit-context';
import { useLocale } from '@/lib/locale';
import { PropertiesPanel } from '@/components/eacc/editable-section';
import { EACC_NAV, findNavItem } from '@/lib/eacc/nav';
import { pushScreenToCanvas } from '@/lib/we-adk/design-sync';
import { liveScreenRoute } from '@/lib/we-adk/live-screens';
import { findPrototypeFile, prototypeConfigKeyForScreen } from '@/lib/we-adk/prototype';
import { prototypeDesignBlocks } from '@/lib/we-adk/prototype-design';
import { screenStorageKey } from '@/lib/we-adk-mock/sketcher';
import ApprovalsPage from '@/app/eacc/approvals/page';
import CashReceiptPage from '@/app/eacc/cash-receipt/page';
import CashReceiptDetailPage from '@/app/eacc/cash-receipt/detail/page';
import CloseBlockersPage from '@/app/eacc/close/blockers/page';
import CloseStatusPage from '@/app/eacc/close/page';
import CorpCardPage from '@/app/eacc/corp-card/page';
import CorpCardBulkPage from '@/app/eacc/corp-card/bulk/page';
import DashboardPage from '@/app/eacc/dashboard/page';
import LoginPage from '@/app/eacc/login/page';
import PersonalExpensePage from '@/app/eacc/personal-expense/page';
import PersonalExpenseDetailPage from '@/app/eacc/personal-expense/detail/page';
import SettingsPage from '@/app/eacc/settings/page';
import TaxInvoicePage from '@/app/eacc/tax-invoice/page';

/** The page component behind each live route. */
const SCREEN_COMPONENTS: Record<string, ComponentType> = {
  '/eacc/login': LoginPage,
  '/eacc/dashboard': DashboardPage,
  '/eacc/close': CloseStatusPage,
  '/eacc/close/blockers': CloseBlockersPage,
  '/eacc/corp-card': CorpCardPage,
  '/eacc/corp-card/bulk': CorpCardBulkPage,
  '/eacc/personal-expense': PersonalExpensePage,
  '/eacc/personal-expense/detail': PersonalExpenseDetailPage,
  '/eacc/tax-invoice': TaxInvoicePage,
  '/eacc/cash-receipt': CashReceiptPage,
  '/eacc/cash-receipt/detail': CashReceiptDetailPage,
  '/eacc/approvals': ApprovalsPage,
  '/eacc/settings': SettingsPage,
};

/** True when this canvas id can be previewed as a real screen. */
export function canPreviewLive(screenId: string): boolean {
  const route = liveScreenRoute(screenId);
  return route !== null && route in SCREEN_COMPONENTS;
}

/**
 * Whether the app's frame belongs around a route.
 *
 * A design drawn in a round has no page behind it, but if it names a route of
 * the product it is still a screen of that product, and should be looked at the
 * way the product's own screens are. The chrome is eACC's, so only eACC routes
 * get it — another project's designs stay bare.
 */
export function hasAppChrome(route: string | undefined | null): route is string {
  return typeof route === 'string' && route.startsWith('/eacc/');
}

/* ------------------------------------------------------------------ */
/* Static chrome                                                       */
/* ------------------------------------------------------------------ */

/**
 * The nav item a route belongs to — the longest matching href, so
 * `/eacc/close/blockers` lights up Close Blockers and not Close Status too.
 */
function activeHref(route: string): string | null {
  const matches = EACC_NAV.flatMap((group) => group.items)
    .map((item) => item.href)
    .filter((href) => href === route || route.startsWith(`${href}/`));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

function PreviewSidebar({
  route,
  hrefForRoute,
}: {
  route: string;
  /** Where a nav item goes, or null to leave the sidebar as a picture. */
  hrefForRoute?: (route: string) => string | null;
}) {
  const current = activeHref(route);

  return (
    // Hidden on narrow frames — a phone-width preview has no sidebar to show.
    <div className="bg-background hidden w-48 shrink-0 flex-col border-r @[640px]:flex">
      <div className="flex h-12 items-center gap-2 border-b px-3">
        <div className="flex size-6 items-center justify-center rounded-md bg-blue-600">
          <BookOpen className="size-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold tracking-tight">eACC Cloud</span>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-hidden px-2.5 py-3">
        {EACC_NAV.map((group) => (
          <div key={group.title} className="flex flex-col gap-0.5">
            <p className="text-muted-foreground mb-1 px-2 text-[9px] font-semibold tracking-wider uppercase">
              {group.title}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.href === current;
              const target = hrefForRoute?.(item.href) ?? null;
              const className = cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]',
                active ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground',
                target && !active && 'hover:bg-muted hover:text-foreground',
              );
              const body = (
                <>
                  <Icon className="size-3.5 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && !active && (
                    <Badge variant="danger" className="px-1.5 py-0 text-[9px]">
                      {item.badge}
                    </Badge>
                  )}
                </>
              );

              // With a target the sidebar walks the prototype, file by file;
              // without one it stays a picture of the app.
              return target ? (
                <Link
                  key={item.href}
                  href={target}
                  aria-current={active ? 'page' : undefined}
                  className={className}
                >
                  {body}
                </Link>
              ) : (
                <div key={item.href} className={className}>
                  {body}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t px-3 py-2.5">
        <div className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full">
          <User className="text-muted-foreground size-3" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium">Taehyuk Park</p>
          <p className="text-muted-foreground truncate text-[9px]">Accountant</p>
        </div>
        <Settings className="text-muted-foreground size-3 shrink-0" />
      </div>
    </div>
  );
}

/**
 * The app header, plus the Edit UI switch when the file can be edited. It has
 * to live inside the provider — that is where the edit state is.
 */
function PreviewHeader({
  route,
  editable,
  showEditToggle,
  hrefForRoute,
}: {
  route: string;
  editable: boolean;
  /** Off when something outside the screen already drives edit mode. */
  showEditToggle: boolean;
  hrefForRoute?: (route: string) => string | null;
}) {
  const { t } = useLocale();
  const { editMode, toggleEditMode, resetConfig } = useEdit();
  const hit = findNavItem(route);
  // On a sub-screen the parent menu is a way back to its own file.
  const parentHref =
    hit && hit.item.href !== route ? (hrefForRoute?.(hit.item.href) ?? null) : null;

  return (
    <div className="bg-background flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4">
      <div className="flex min-w-0 items-center gap-1 text-[13px]">
        <span className="text-muted-foreground shrink-0">eACC Cloud</span>
        {hit && (
          <>
            <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />
            <span className="text-muted-foreground truncate">{hit.group.title}</span>
            <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />
            {parentHref ? (
              <Link
                href={parentHref}
                className="text-muted-foreground hover:text-foreground truncate underline-offset-2 hover:underline"
              >
                {hit.item.label}
              </Link>
            ) : (
              <span className="truncate font-medium">{hit.item.label}</span>
            )}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {false && editable && editMode && (
          <>
            <Badge variant="warning" className="gap-1 text-[10px]">
              <PencilRuler className="size-2.5" />
              {t('live.editMode')}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-7 gap-1 px-2 text-xs"
              onClick={resetConfig}
              title={t('live.resetEdits')}
            >
              <RotateCcw className="size-3" />
              Reset
            </Button>
          </>
        )}
        {false && editable && showEditToggle && (
          <Button
            variant={editMode ? 'default' : 'outline'}
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={toggleEditMode}
          >
            {editMode ? (
              <>
                <X className="size-3" />
                {t('live.done')}
              </>
            ) : (
              <>
                <PencilRuler className="size-3" />
                {t('live.editUi')}
              </>
            )}
          </Button>
        )}
        <div className="flex size-7 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          TP
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The preview                                                         */
/* ------------------------------------------------------------------ */

function PreviewBody({
  route,
  Screen,
  chrome,
  editable,
  showEditToggle,
  hrefForRoute,
}: {
  route: string;
  Screen: ComponentType;
  chrome: boolean;
  editable: boolean;
  showEditToggle: boolean;
  hrefForRoute?: (route: string) => string | null;
}) {
  const { editMode, setSelectedId } = useEdit();
  const router = useRouter();

  /**
   * The screens link to each other with real app routes ("View Blockers" goes
   * to `/eacc/close/blockers`). Inside a preview that would walk out of the
   * workspace, so send the click to that route's html file instead.
   *
   * Capture phase: the screens use `next/link`, whose own handler would
   * navigate first, so this has to run before the anchor sees the click.
   */
  const followLink = (event: MouseEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    const anchor = (event.target as HTMLElement).closest('a');
    const href = anchor?.getAttribute('href');
    if (!anchor || !href?.startsWith('/eacc/') || anchor.target === '_blank') return;

    // Inside the editor a link is part of the design, not a way out of it.
    event.preventDefault();
    event.stopPropagation();
    if (editMode) return;

    const target = hrefForRoute?.(href);
    if (target) router.push(target);
  };

  return (
    <div className="@container flex min-h-0 flex-1 flex-col overflow-hidden">
      {chrome && (
        <PreviewHeader
          route={route}
          editable={editable}
          showEditToggle={showEditToggle}
          hrefForRoute={hrefForRoute}
        />
      )}
      <div className="flex min-h-0 flex-1">
        {chrome && <PreviewSidebar route={route} hrefForRoute={hrefForRoute} />}
        <div
          className="min-w-0 flex-1 overflow-auto bg-gray-50 dark:bg-gray-950"
          onClickCapture={followLink}
          onClick={() => editMode && setSelectedId(null)}
        >
          <Screen />
        </div>
        {/* Slides in beside the screen while a section is selected. */}
        <PropertiesPanel />
      </div>
    </div>
  );
}

export function LiveScreenPreview({
  screenId,
  chrome = true,
  editable = false,
  startEditing = false,
  showEditToggle = true,
  hrefForRoute,
  className,
}: {
  screenId: string;
  /** Draw the eACC shell around the page. Off gives the bare screen. */
  chrome?: boolean;
  /** Offer the Edit UI switch, storing this file's edits under its own key. */
  editable?: boolean;
  /** Open straight into edit mode. */
  startEditing?: boolean;
  /** Draw the Edit UI switch in the screen header. Off when tabs drive it. */
  showEditToggle?: boolean;
  /**
   * Where a link to an app route should go instead — the nav and the links
   * inside the screen both use it. Without it the chrome is just a picture.
   */
  hrefForRoute?: (route: string) => string | null;
  className?: string;
}) {
  const { t } = useLocale();
  const route = liveScreenRoute(screenId);
  const Screen = route ? SCREEN_COMPONENTS[route] : undefined;
  const prototype = findPrototypeFile(screenId);

  if (!route || !Screen) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        {t('live.noLiveScreen')}
      </p>
    );
  }

  // A prototype file edits into its own config; anything else shares the one the
  // eACC app itself uses, so what you see is what the product looks like today.
  // A round's copy of an html file edits its own layout, not the baseline's.
  const storageKey = prototypeConfigKeyForScreen(screenId);

  /**
   * Editing the screen also brings its canvas in line, so the Design tab shows
   * the same thing. Only for prototype files — the app's own screens have no
   * canvas behind them.
   */
  // Keyed by the screen being edited, not the prototype it came from — a
  // round's copy has its own canvas, and writing the baseline's would rewrite
  // the file everyone else is looking at.
  const mirrorToCanvas = prototype
    ? (config: SiteConfig) =>
        pushScreenToCanvas(
          screenStorageKey(screenId),
          config,
          prototypeDesignBlocks(screenId) ?? [],
        )
    : undefined;
  // Login and the like ship without the app shell, whatever the caller asks for.
  const withChrome = chrome && (prototype?.chrome ?? true);

  return (
    // Keyed by the file: opening another html file mounts a fresh editor rather
    // than carrying this one's sections across.
    <EditProvider
      key={storageKey ?? screenId}
      storageKey={storageKey}
      initialEditMode={editable && withChrome && startEditing}
      onConfigChange={mirrorToCanvas}
    >
      <div className={cn('flex min-h-0 flex-col overflow-hidden', className)}>
        <PreviewBody
          route={route}
          Screen={Screen}
          chrome={withChrome}
          editable={editable && withChrome}
          showEditToggle={showEditToggle}
          hrefForRoute={hrefForRoute}
        />
      </div>
    </EditProvider>
  );
}

/**
 * The app's frame with something other than a live page inside it.
 *
 * A design drawn in a round is blocks, not a page — but it is a proposal for a
 * screen of this product, so it is read in the product's frame rather than as a
 * bare stack on grey. Same header and nav a version 1 file gets; the body is
 * the design. The nav lights up from the route the file declares, and a route
 * the app does not have simply lights nothing up.
 *
 * Nothing here is editable: the sections are canvas blocks, and the canvas is
 * where they are changed. The provider is only present because the header reads
 * edit state from it.
 */
export function DesignChromeFrame({
  route,
  hrefForRoute,
  children,
}: {
  route: string;
  hrefForRoute?: (route: string) => string | null;
  children: ReactNode;
}) {
  return (
    <EditProvider initialEditMode={false}>
      <div className="@container flex min-h-0 flex-1 flex-col overflow-hidden">
        <PreviewHeader
          route={route}
          editable={false}
          showEditToggle={false}
          hrefForRoute={hrefForRoute}
        />
        <div className="flex min-h-0 flex-1">
          <PreviewSidebar route={route} hrefForRoute={hrefForRoute} />
          <div className="min-w-0 flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">{children}</div>
        </div>
      </div>
    </EditProvider>
  );
}
