'use client';

import { Hash } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, cn } from '@/components/ui';
import { findProject } from '@/lib/we-adk-mock/projects';
import {
  loadIdSuffixFormat,
  saveIdSuffixFormat,
  loadDepthConfigs,
  saveDepthConfigs,
  loadRandomDigits,
  saveRandomDigits,
  regenerateScreenIds,
  type IdSuffixFormat,
  type IADepthConfigs,
} from '@/lib/we-adk-mock/ia';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const SAMPLE_DEPTHS = [
  ['Accountant', 'Dashboard', '', '', ''],
  ['ExpenseManagement', 'CorporateCard', 'BulkApprove', '', ''],
  ['ExpenseManagement', 'CorporateCard', 'NewCharge', '', ''],
  ['Tax&Receipts', 'CashReceipt', 'NewReceipt', '', ''],
  ['Administration', 'Settings', 'InviteMember', '', ''],
];
const SAMPLE_TYPES = ['Screen', 'Screen', 'Popup', 'Popup', 'Popup'] as const;

function projectShortName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

function seededChars(seed: number, len: number, chars: string): string {
  let s = '';
  let n = seed * 9301 + 49297;
  for (let i = 0; i < len; i++) { s += chars[n % chars.length]; n = (n * 1103515245 + 12345) & 0x7fffffff; }
  return s;
}
function seededNumber(seed: number, len: number): string {
  const raw = seededChars(seed, len, '0123456789');
  // Ensure first digit is not 0
  if (raw[0] === '0') return String(Number(raw) || 10 ** (len - 1));
  return raw;
}
function seededAlpha(seed: number, len: number): string {
  return seededChars(seed, len, 'abcdefghijklmnopqrstuvwxyz');
}
function seededMixed(seed: number, len: number): string {
  return seededChars(seed, len, 'abcdefghijklmnopqrstuvwxyz0123456789');
}
function seededSuffix(fmt: IdSuffixFormat, seed: number, len: number): string {
  if (fmt === 'number') return seededNumber(seed, len);
  if (fmt === 'alpha') return seededAlpha(seed, len);
  return seededMixed(seed, len);
}

interface DepthConfigMap { [depth: number]: { digits: number | null; format: IdSuffixFormat | null } }

const SAMPLE_STATUSES = ['done', 'inprogress', 'review', 'todo', 'done'] as const;

function buildScreenId(
  projectShort: string,
  depths: string[],
  screenType: string,
  randomFmt: IdSuffixFormat,
  randomLen: number,
  seed: number,
  depthCfgs: DepthConfigMap,
  status: string,
): string {
  const strip = (s: string) => s.replace(/\s+/g, '').toLowerCase();
  const parts: string[] = [strip(projectShort)];

  depths.forEach((d, i) => {
    if (!d) return;
    const cfg = depthCfgs[i + 1];
    if (cfg?.digits && cfg?.format) {
      parts.push(seededSuffix(cfg.format, seed * 100 + i, cfg.digits));
    } else {
      parts.push(strip(d));
    }
  });

  parts.push(strip(screenType));
  parts.push(seededSuffix(randomFmt, seed, randomLen));
  parts.push(strip(status));
  return parts.join('-');
}

const DIGIT_OPTIONS = [3, 4, 5] as const;
type DigitCount = (typeof DIGIT_OPTIONS)[number];

interface DepthConfig {
  digits: DigitCount | null;
  format: IdSuffixFormat | null;
}
const EMPTY_DEPTH: DepthConfig = { digits: null, format: null };
const DEFAULT_DEPTH_CONFIGS: Record<number, DepthConfig> = { 1: { ...EMPTY_DEPTH }, 2: { ...EMPTY_DEPTH }, 3: { ...EMPTY_DEPTH }, 4: { ...EMPTY_DEPTH }, 5: { ...EMPTY_DEPTH } };

const DEPTH_COLOR = 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
const DEPTH_RING = 'ring-blue-400';
const DEPTH_SEGMENTS = [
  { depth: 1, label: 'Depth 1' },
  { depth: 2, label: 'Depth 2' },
  { depth: 3, label: 'Depth 3' },
  { depth: 4, label: 'Depth 4' },
  { depth: 5, label: 'Depth 5' },
] as const;

const FORMAT_OPTIONS: { value: IdSuffixFormat; label: string; example: string }[] = [
  { value: 'number', label: 'Numbers', example: '48271' },
  { value: 'alpha', label: 'Letters', example: 'kxmqt' },
  { value: 'mixed', label: 'Mixed', example: 'a7k2r' },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SettingPage() {
  const params = useParams<{ projectId: string }>();
  const project = findProject(params.projectId);
  const pShort = projectShortName(project?.name ?? '');

  const toast = useToast();
  const [fmt, setFmt] = useState<IdSuffixFormat>('mixed');
  const [depthConfigs, setDepthConfigs] = useState<Record<number, DepthConfig>>({ ...DEFAULT_DEPTH_CONFIGS });
  const [randomDigits, setRandomDigits] = useState<DigitCount>(5);
  const [openDepth, setOpenDepth] = useState<number | 'random' | null>(null);

  const setDepthField = useCallback((depth: number, field: keyof DepthConfig, value: DigitCount | IdSuffixFormat) => {
    setDepthConfigs((prev) => {
      const updated: Record<number, DepthConfig> = { ...prev };
      updated[depth] = { ...updated[depth], [field]: value } as DepthConfig;
      return updated;
    });
  }, []);

  useEffect(() => {
    if (project) {
      setFmt(loadIdSuffixFormat(project.id));
      setRandomDigits(loadRandomDigits(project.id) as DigitCount);
      setDepthConfigs(loadDepthConfigs(project.id) as Record<number, DepthConfig>);
    }
  }, [project]);

  const previews = useMemo(
    () =>
      SAMPLE_DEPTHS.map((depths, i) => ({
        id: buildScreenId(pShort, depths, SAMPLE_TYPES[i] ?? 'Screen', fmt, randomDigits, i + 1, depthConfigs, SAMPLE_STATUSES[i] ?? 'todo'),
        type: SAMPLE_TYPES[i] ?? 'Screen',
      })),
    [pShort, fmt, randomDigits, depthConfigs],
  );

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-6 pt-4 pb-6">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight">Setting</h1>
          <p className="text-muted-foreground text-sm">Screen ID format used in the IA sheet</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => {
            if (project) {
              setFmt('mixed');
              setRandomDigits(5 as DigitCount);
              setDepthConfigs({ ...DEFAULT_DEPTH_CONFIGS });
              saveIdSuffixFormat(project.id, 'mixed');
              saveRandomDigits(project.id, 5);
              saveDepthConfigs(project.id, DEFAULT_DEPTH_CONFIGS as IADepthConfigs);
              regenerateScreenIds(project.id, project.name, 'mixed', 5, DEFAULT_DEPTH_CONFIGS as IADepthConfigs);
              toast('Reset to default');
            }
          }}
        >
          Reset to default
        </Button>
        <Button
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => {
            if (project) {
              saveIdSuffixFormat(project.id, fmt);
              saveRandomDigits(project.id, randomDigits);
              saveDepthConfigs(project.id, depthConfigs as IADepthConfigs);
              regenerateScreenIds(project.id, project.name, fmt, randomDigits, depthConfigs as IADepthConfigs);
              toast('Settings saved');
            }
          }}
        >
          Save
        </Button>
      </div>

      <Card className="gap-0 py-0 shadow-sm">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Hash className="text-muted-foreground size-4" />
          <h2 className="text-sm font-semibold">IA Screen ID Format</h2>
        </div>
        <div className="flex flex-col gap-5 p-5">
          <p className="text-muted-foreground text-xs leading-relaxed">
            Screen IDs are generated from the project name, depth hierarchy, screen type, and a random suffix. Click a depth or the random segment to configure its length and format.
          </p>

          {/* Live preview with highlighted segments */}
          {previews.length > 0 && (() => {
            const depths = SAMPLE_DEPTHS[0]!;
            const segments: { value: string; label: string; color: string }[] = [];

            // Project
            segments.push({
              value: (project?.name ?? '').split(/\s+/)[0]?.replace(/\s+/g, '').toLowerCase() ?? '',
              label: 'Project name',
              color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
            });

            // Depths
            depths.forEach((d, i) => {
              if (!d) return;
              const cfg = depthConfigs[i + 1];
              if (cfg?.digits && cfg?.format) {
                const fmtLabel = cfg.format === 'number' ? 'numbers' : cfg.format === 'alpha' ? 'letters' : 'mixed';
                segments.push({
                  value: seededSuffix(cfg.format, 1 * 100 + i, cfg.digits),
                  label: `Depth ${i + 1}: ${cfg.digits} digit ${fmtLabel}`,
                  color: DEPTH_COLOR,
                });
              } else {
                segments.push({
                  value: d.replace(/\s+/g, '').toLowerCase(),
                  label: `Depth ${i + 1}: name`,
                  color: DEPTH_COLOR,
                });
              }
            });

            // Screen type
            segments.push({
              value: 'screen',
              label: 'Screen type',
              color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
            });

            // Random ID
            const rFmtLabel = fmt === 'number' ? 'numbers' : fmt === 'alpha' ? 'letters' : 'mixed';
            segments.push({
              value: seededSuffix(fmt, 1, randomDigits),
              label: `Random: ${randomDigits} digit ${rFmtLabel}`,
              color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
            });

            // Status
            segments.push({
              value: 'done',
              label: 'Status',
              color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
            });

            return (
              <div className="rounded-lg border bg-gray-50 px-4 py-3 dark:bg-gray-950">
                <p className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-wider uppercase">
                  Preview
                </p>
                <div className="flex flex-wrap items-center gap-0.5 font-mono text-sm">
                  {segments.map((seg, i) => (
                    <span key={i} className="flex items-center gap-0.5">
                      {i > 0 && <span className="text-muted-foreground/40">-</span>}
                      <span
                        className={cn('rounded px-1.5 py-0.5 font-medium', seg.color)}
                        title={seg.label}
                      >
                        {seg.value}
                      </span>
                    </span>
                  ))}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                  {segments.map((seg, i) => (
                    <span key={i} className="flex items-center gap-1.5 text-[10px]">
                      <span className={cn('size-2 shrink-0 rounded-full', seg.color.split(' ')[0])} />
                      <span className="text-muted-foreground">{seg.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
          {/* Format breakdown + preview inline */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-md bg-violet-100 px-2.5 py-1 font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              Project
            </span>
            {DEPTH_SEGMENTS.map((seg) => {
              const cfg = depthConfigs[seg.depth];
              const hasConfig = cfg?.digits !== null && cfg?.format !== null;
              return (
                <span key={seg.depth} className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/50 font-mono text-[10px]">-</span>
                  <button
                    type="button"
                    onClick={() => setOpenDepth(openDepth === seg.depth ? null : seg.depth)}
                    className={cn(
                      'cursor-pointer rounded-md px-2.5 py-1 font-medium transition-shadow',
                      DEPTH_COLOR,
                      openDepth === seg.depth && `ring-2 ${DEPTH_RING}`,
                    )}
                  >
                    {seg.label}
                  </button>
                </span>
              );
            })}
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground/50 font-mono text-[10px]">-</span>
              <span className="rounded-md bg-amber-100 px-2.5 py-1 font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                Screen Type
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground/50 font-mono text-[10px]">-</span>
              <button
                type="button"
                onClick={() => setOpenDepth(openDepth === 'random' ? null : 'random')}
                className={cn(
                  'cursor-pointer rounded-md px-2.5 py-1 font-medium transition-shadow',
                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
                  openDepth === 'random' && 'ring-2 ring-emerald-400',
                )}
              >
                Random ID
              </button>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground/50 font-mono text-[10px]">-</span>
              <span className="rounded-md bg-rose-100 px-2.5 py-1 font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                Status
              </span>
            </span>
          </div>

          {/* Segment options */}
          {openDepth !== null && (
            <div className="rounded-lg border bg-gray-50/50 p-4 dark:bg-gray-950/50">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-2 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
                    {openDepth === 'random' ? 'Random ID' : `Depth ${openDepth}`} — Length
                  </p>
                  <div className="flex gap-1.5">
                    {DIGIT_OPTIONS.map((d) => {
                      const selected = openDepth === 'random'
                        ? randomDigits === d
                        : depthConfigs[openDepth]?.digits === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            if (openDepth === 'random') { setRandomDigits(d); }
                            else { setDepthField(openDepth, 'digits', d); }
                          }}
                          className={cn(
                            'rounded-md border px-3.5 py-2 font-mono text-xs font-semibold transition-colors',
                            selected
                              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
                    {openDepth === 'random' ? 'Random ID' : `Depth ${openDepth}`} — Format
                  </p>
                  <div className="flex gap-1.5">
                    {FORMAT_OPTIONS.map((opt) => {
                      const selected = openDepth === 'random'
                        ? fmt === opt.value
                        : depthConfigs[openDepth]?.format === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            if (openDepth === 'random') { setFmt(opt.value); }
                            else { setDepthField(openDepth, 'format', opt.value); }
                          }}
                          className={cn(
                            'flex items-center gap-2 rounded-md border px-3.5 py-2 text-xs transition-colors',
                            selected
                              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          <span className="font-mono font-semibold">{opt.example}</span>
                          <span className="text-[10px] opacity-70">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
