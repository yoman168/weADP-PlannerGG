import { type ButtonColor, type ButtonVariant } from '@/lib/we-adk-mock/sketcher';

/**
 * Colour overrides layered on top of the shared Button variants.
 *
 * Solid shades are picked so label text clears WCAG AA (4.5:1): blue-600,
 * emerald-700, red-600, violet-600 and slate-700 carry white text, while
 * amber-500 takes near-black text instead (white on amber fails badly).
 * Outline/ghost/link use the 700 step on light surfaces and the 400 step in
 * dark mode, where the same hue would otherwise be unreadable.
 */
type StyleFamily = 'solid' | 'soft' | 'outline' | 'ghost' | 'link';

type ColorMatrix = Record<Exclude<ButtonColor, 'default'>, Record<StyleFamily, string>>;

const MATRIX: ColorMatrix = {
  blue: {
    solid: 'bg-blue-600 text-white hover:bg-blue-700',
    soft: 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30',
    outline:
      'border-blue-600 text-blue-700 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-950',
    ghost: 'text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950',
    link: 'text-blue-700 dark:text-blue-400',
  },
  green: {
    solid: 'bg-emerald-700 text-white hover:bg-emerald-800',
    soft: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/30',
    outline:
      'border-emerald-700 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950',
    ghost: 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950',
    link: 'text-emerald-700 dark:text-emerald-400',
  },
  amber: {
    solid: 'bg-amber-500 text-zinc-950 hover:bg-amber-600',
    soft: 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30',
    outline:
      'border-amber-600 text-amber-700 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-400 dark:hover:bg-amber-950',
    ghost: 'text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950',
    link: 'text-amber-700 dark:text-amber-400',
  },
  red: {
    solid: 'bg-red-600 text-white hover:bg-red-700',
    soft: 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/30',
    outline:
      'border-red-600 text-red-700 hover:bg-red-50 dark:border-red-500 dark:text-red-400 dark:hover:bg-red-950',
    ghost: 'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950',
    link: 'text-red-700 dark:text-red-400',
  },
  violet: {
    solid: 'bg-violet-600 text-white hover:bg-violet-700',
    soft: 'bg-violet-100 text-violet-800 hover:bg-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:hover:bg-violet-500/30',
    outline:
      'border-violet-600 text-violet-700 hover:bg-violet-50 dark:border-violet-500 dark:text-violet-400 dark:hover:bg-violet-950',
    ghost: 'text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950',
    link: 'text-violet-700 dark:text-violet-400',
  },
  slate: {
    solid: 'bg-slate-700 text-white hover:bg-slate-800',
    soft: 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-500/20 dark:text-slate-200 dark:hover:bg-slate-500/30',
    outline:
      'border-slate-600 text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-900',
    ghost: 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
    link: 'text-slate-700 dark:text-slate-300',
  },
};

function familyFor(variant: ButtonVariant): StyleFamily {
  switch (variant) {
    case 'secondary':
      return 'soft';
    case 'outline':
      return 'outline';
    case 'ghost':
      return 'ghost';
    case 'link':
      return 'link';
    default:
      // 'default' and 'destructive' are both solid fills.
      return 'solid';
  }
}

/** Empty string when the colour is 'default', so the theme variant renders untouched. */
export function buttonColorClass(color: ButtonColor | undefined, variant: ButtonVariant): string {
  if (!color || color === 'default') return '';
  return MATRIX[color][familyFor(variant)];
}

/** Swatch fills for the inspector's colour picker. */
export const BUTTON_COLOR_SWATCH: Record<ButtonColor, string> = {
  default: 'bg-foreground',
  blue: 'bg-blue-600',
  green: 'bg-emerald-700',
  amber: 'bg-amber-500',
  red: 'bg-red-600',
  violet: 'bg-violet-600',
  slate: 'bg-slate-700',
};
