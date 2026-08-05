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
import { prototypeDesignBlocks } from '@/lib/we-adk/prototype-design';
import {
  DEVICE_PRESETS,
  loadScreenBlocks,
  type CanvasBlock,
  type DevicePresetId,
} from '@/lib/we-adk-mock/sketcher';

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
export function PreviewEditTabs({
  active,
  previewHref,
  editHref,
}: {
  active: 'preview' | 'edit';
  previewHref: string;
  editHref: string;
}) {
  const tabs: { id: 'preview' | 'edit'; label: string; href: string; hint: string }[] = [
    { id: 'preview', label: 'Preview', href: previewHref, hint: 'The screen as it is built' },
    {
      id: 'edit',
      label: 'Edit',
      href: editHref,
      hint: 'The canvas it is built from, with every block',
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

function WireframeFrame({ screenId, seedPattern }: { screenId: string; seedPattern: string }) {
  // The canvas lives in localStorage, so it can only be read after mount.
  const [blocks, setBlocks] = useState<CanvasBlock[] | null>(null);

  useEffect(() => {
    setBlocks(loadScreenBlocks(screenId, seedPattern, () => prototypeDesignBlocks(screenId)));
  }, [screenId, seedPattern]);

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
  className?: string;
}) {
  const live = mode === 'live' && canPreviewLive(screenId);
  // No page behind it, but it belongs to one of the app's routes: the design
  // goes inside the app's frame, the way a version 1 file does.
  const chromed = !live && chrome && mode === 'live' && hasAppChrome(route);
  // Both of those read as a viewport; loose blocks take only the height they
  // need.
  const framed = live || chromed;
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
          className="flex-1"
        />
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
