'use client';

/**
 * The preview surface shared by the standalone `/preview/[screenId]` page and
 * the preview pane inside the Business workspace, so both show a design file
 * the same way.
 *
 * A file that stands for a real screen previews as that screen; anything else
 * falls back to the wireframe blocks the canvas drew. Where both exist the
 * caller can offer the toggle.
 */
import { Maximize, Monitor, Smartphone, Tablet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { cn } from '@/components/ui';
import {
  DesignChromeFrame,
  LiveScreenPreview,
  canPreviewLive,
  hasAppChrome,
} from '@/components/we-adk/live-screen-preview';
import { BlockPreview } from '@/components/we-adk/sketcher/block-preview';
import { readPrototypeId } from '@/lib/we-adk/prototype';
import { prototypeDesignBlocks } from '@/lib/we-adk/prototype-design';
import {
  inertPreviewHtml,
  readPreviewNav,
  readPreviewPick,
  type PreviewLink,
} from '@/lib/we-adk/mockup-pages';
import {
  DEVICE_PRESETS,
  loadScreenBlocks,
  type CanvasBlock,
  type DevicePresetId,
} from '@/lib/we-adk-mock/sketcher';
import { workspaceStore } from '@/lib/api/workspace-store';

/** Look up design HTML, falling back to the base (non-member) screen ID. */
function loadDesignHtml(screenId: string): string | null {
  try {
    const html = workspaceStore.getItem(`we-adk:design-html:${screenId}`);
    if (html) return html;
    // Member-scoped screen — try the base ID from Main.
    const { member, baseId } = readPrototypeId(screenId);
    if (member && baseId !== screenId) {
      return workspaceStore.getItem(`we-adk:design-html:${baseId}`);
    }
    return null;
  } catch { return null; }
}

export type PreviewMode = 'live' | 'wireframe';

const DEVICE_ICONS: Record<DevicePresetId, typeof Monitor> = {
  full: Maximize,
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
};

/**
 * Frame height per device, so a live screen reads as a viewport and scrolls.
 * `full` takes whatever height it is given instead of a fixed frame.
 */
const DEVICE_HEIGHTS: Record<DevicePresetId, number | null> = {
  full: null,
  desktop: 720,
  tablet: 900,
  mobile: 780,
};

/** 0 means "no cap" — the screen takes the width it is given. */
export function deviceWidth(device: DevicePresetId): number {
  return DEVICE_PRESETS.find((entry) => entry.id === device)?.width ?? 1440;
}

/* ------------------------------------------------------------------ */
/* Toolbar controls                                                    */
/* ------------------------------------------------------------------ */

export function DeviceSwitcher({
  device,
  onChange,
}: {
  device: DevicePresetId;
  onChange: (next: DevicePresetId) => void;
}) {
  return (
    <div className="bg-muted flex rounded-md p-0.5">
      {DEVICE_PRESETS.map((entry) => {
        const Icon = DEVICE_ICONS[entry.id];
        const label = entry.width > 0 ? `${entry.label} · ${entry.width}px` : entry.label;
        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onChange(entry.id)}
            aria-pressed={device === entry.id}
            aria-label={label}
            title={label}
            className={cn(
              'rounded px-2 py-1',
              device === entry.id ? 'bg-background shadow-xs' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Preview or Edit — the two ways to work on one screen.
 *
 * Preview is the screen as built and is where a file opens; Edit is the same
 * screen on the canvas, block by block, with the palette to build from. Links
 * rather than state, so either view can be shared.
 */
/**
 * The Preview/Edit switch above a screen.
 *
 * A released round has no Edit side — the canvas behind it is frozen — so the
 * control is dropped entirely rather than shown with one dead half. There is
 * no label in its place: with only one thing to look at, naming it says
 * nothing the screen itself does not already say.
 */
export function PreviewEditTabs({
  active,
  previewHref,
  editHref,
  released = false,
}: {
  active: 'preview' | 'edit';
  previewHref: string;
  editHref: string;
  /** Released rounds are read-only, so the switch becomes a label. */
  released?: boolean;
}) {
  if (released) return null;

  const tabs: { id: 'preview' | 'edit'; label: string; href: string; hint: string }[] = [
    { id: 'preview', label: 'Preview', href: previewHref, hint: 'The screen as it is built' },
    {
      id: 'edit',
      label: 'Page',
      href: editHref,
      hint: 'The page itself — click anything on it to change it',
    },
  ];
  return (
    <div className="bg-muted flex rounded-md p-0.5">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          title={tab.hint}
          aria-current={active === tab.id ? 'page' : undefined}
          className={cn(
            'rounded px-2.5 py-1 text-[11px]',
            active === tab.id
              ? 'bg-background shadow-xs font-medium'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

/** Only worth rendering when `canPreviewLive(screenId)` — otherwise there is one mode. */
export function PreviewModeSwitcher({
  mode,
  onChange,
}: {
  mode: PreviewMode;
  onChange: (next: PreviewMode) => void;
}) {
  const options: { id: PreviewMode; label: string; hint: string }[] = [
    { id: 'live', label: 'Screen', hint: 'The real screen from the eACC Cloud app' },
    { id: 'wireframe', label: 'Wireframe', hint: 'The blocks drawn on the canvas' },
  ];
  return (
    <div className="bg-muted flex rounded-md p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={mode === option.id}
          title={option.hint}
          className={cn(
            'rounded px-2 py-1 text-[11px]',
            mode === option.id ? 'bg-background shadow-xs font-medium' : 'text-muted-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Surface                                                             */
/* ------------------------------------------------------------------ */

function WireframeFrame({ screenId, seedPattern, allowSeed = true }: { screenId: string; seedPattern: string; allowSeed?: boolean }) {
  // The canvas is workspace state, so it can only be read after mount.
  const [blocks, setBlocks] = useState<CanvasBlock[] | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setBlocks(loadScreenBlocks(screenId, allowSeed ? seedPattern : '', () => prototypeDesignBlocks(screenId)));
  }, [screenId, seedPattern, allowSeed, revision]);

  // Re-read blocks when the canvas editor saves.
  useEffect(() => {
    const handler = () => setRevision((v) => v + 1);
    window.addEventListener('we-adk:canvas-saved', handler);
    return () => window.removeEventListener('we-adk:canvas-saved', handler);
  }, []);

  if (blocks === null) {
    return <p className="text-muted-foreground py-16 text-center text-sm">Loading the design…</p>;
  }

  const visible = blocks.filter((block) => !block.hidden);
  if (visible.length === 0) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        Nothing drawn on this canvas yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      {visible.map((block) => (
        <BlockPreview key={block.id} block={block} />
      ))}
    </div>
  );
}

/**
 * If a screen has AI-generated HTML stored, render it in an iframe.
 * Otherwise render the children (wireframe fallback).
 */
function GeneratedHtmlPreview({
  screenId,
  links = [],
  onOpenScreen,
  pick = false,
  onPickControl,
  children,
}: {
  screenId: string;
  /**
   * The screens this one can reach. Without them a generated page's own
   * navigation is pinned and dead — which is right for a page shown alone, and
   * wrong everywhere the rest of the set is sitting in a list beside it.
   */
  links?: PreviewLink[];
  onOpenScreen?: (id: string) => void;
  /** Outline the controls and report the one clicked, instead of following it. */
  pick?: boolean;
  onPickControl?: (index: number) => void;
  children: React.ReactNode;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const reload = () => setHtml(loadDesignHtml(screenId));
  useEffect(reload, [screenId]);
  // Listen for updates from the chat
  useEffect(() => {
    const handler = () => reload();
    window.addEventListener('we-adk:html-updated', handler);
    return () => window.removeEventListener('we-adk:html-updated', handler);
  });

  /*
   * A click inside the page asking for another screen.
   *
   * Guarded on the id being one this preview was told about: the listener is
   * on the window, and two previews on one page would otherwise both answer a
   * message meant for whichever was clicked.
   */
  useEffect(() => {
    if (!onOpenScreen && !onPickControl) return;
    const onMessage = (event: MessageEvent) => {
      const chosen = readPreviewPick(event.data);
      if (chosen !== null) return onPickControl?.(chosen);
      const to = readPreviewNav(event.data);
      if (to && links.some((link) => link.id === to)) onOpenScreen?.(to);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onOpenScreen, onPickControl, links]);

  if (!html) return <>{children}</>;

  return (
    <iframe
      // Links to the rest of the set are followed by the host; everything else
      // is pinned, because following a real one would navigate this frame to
      // that path on this origin — the workspace itself, inside its own
      // preview.
      srcDoc={inertPreviewHtml(html, links, screenId, pick)}
      title="Generated design"
      className="min-h-[600px] w-full border-0"
      style={{ height: '100%' }}
      sandbox="allow-scripts"
    />
  );
}

export function ScreenPreviewSurface({
  screenId,
  seedPattern,
  route,
  device,
  mode,
  chrome = true,
  editable = false,
  startEditing = false,
  showEditToggle = true,
  hrefForRoute,
  onNavigate,
  links,
  onOpenScreen,
  pick,
  onPickControl,
  className,
}: {
  screenId: string;
  /** Used only by the wireframe fallback, to seed an empty canvas. */
  seedPattern: string;
  /**
   * The route the file says it is for. A design with no page behind it still
   * gets the app's frame when it names one of the app's routes — otherwise a
   * round's own screens would read as loose blocks next to version 1's pages.
   */
  route?: string;
  device: DevicePresetId;
  mode: PreviewMode;
  chrome?: boolean;
  /** Let the screen's sections be edited in place. */
  editable?: boolean;
  /** Open straight into edit mode. */
  startEditing?: boolean;
  /** Draw the Edit UI switch in the screen header. Off when tabs drive it. */
  showEditToggle?: boolean;
  /** Where the previewed screen's own links should go. */
  hrefForRoute?: (route: string) => string | null;
  /** Handle links in place instead — the preview navigates itself. */
  onNavigate?: (route: string) => void;
  /** The other screens of this set, and what to do when one is asked for. */
  links?: PreviewLink[];
  onOpenScreen?: (id: string) => void;
  /** Wiring mode: outline the controls and report the one clicked. */
  pick?: boolean;
  onPickControl?: (index: number) => void;
  className?: string;
}) {
  const live = mode === 'live' && canPreviewLive(screenId);
  // The app's sidebar and header wrap both the live screen and the wireframe,
  // so the two modes look the same — only the content area differs.
  const chromed = !live && chrome && hasAppChrome(route);
  // Check if this screen has generated HTML stored
  const [hasGeneratedHtml, setHasGeneratedHtml] = useState(false);
  useEffect(() => {
    const read = () => setHasGeneratedHtml(!!loadDesignHtml(screenId));
    read();
    // A page saved elsewhere — the Page tab, or the chat beside this preview —
    // has to switch this surface over, not wait for a navigation.
    window.addEventListener('we-adk:html-updated', read);
    return () => window.removeEventListener('we-adk:html-updated', read);
  }, [screenId]);
  // Both of those read as a viewport; loose blocks take only the height they
  // need.
  const framed = live || chromed || hasGeneratedHtml;
  const width = deviceWidth(device);
  const height = DEVICE_HEIGHTS[device];
  // Full width caps neither dimension: the surface fills whatever it is inside.
  const frame: CSSProperties = {
    ...(width > 0 ? { maxWidth: width } : {}),
    ...(framed && height !== null ? { height } : {}),
  };

  return (
    <div
      style={frame}
      className={cn(
        'bg-background w-full overflow-hidden rounded-xl border shadow-sm',
        framed ? 'flex min-h-0 flex-col' : 'h-fit',
        framed && height === null && 'h-full',
        className,
      )}
    >
      {live ? (
        <LiveScreenPreview
          screenId={screenId}
          chrome={chrome}
          editable={editable}
          startEditing={startEditing}
          showEditToggle={showEditToggle}
          hrefForRoute={hrefForRoute}
          onNavigate={onNavigate}
          className="flex-1"
        />
      ) : hasGeneratedHtml ? (
        /*
         * A stored page wins over the blocks, and over the app's chrome.
         *
         * It is the most recent statement of what this screen is — the Page
         * tab is where a design is edited now — and it is a whole document,
         * carrying its own frame. Wrapping it in `DesignChromeFrame` would put
         * the app's sidebar around a page that already has one.
         */
        <GeneratedHtmlPreview
          screenId={screenId}
          links={links}
          onOpenScreen={onOpenScreen}
          pick={pick}
          onPickControl={onPickControl}
        >
          <WireframeFrame screenId={screenId} seedPattern={seedPattern} />
        </GeneratedHtmlPreview>
      ) : chromed && route ? (
        <DesignChromeFrame route={route} hrefForRoute={hrefForRoute}>
          <WireframeFrame screenId={screenId} seedPattern={seedPattern} />
        </DesignChromeFrame>
      ) : (
        <WireframeFrame screenId={screenId} seedPattern={seedPattern} />
      )}
    </div>
  );
}
