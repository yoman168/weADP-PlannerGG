import { findPrototypeFile } from './prototype';

/**
 * Which design files have a real screen behind them.
 *
 * The eACC Cloud app that ships next to this mockup (`/eacc/...`) is the live
 * product the eACC project's design files describe. Where a file maps to one of
 * those pages, previewing it should show the page itself — the same UI the
 * customer uses — instead of the wireframe blocks the canvas draws.
 *
 * Keyed by canvas id, so both a concept design (`sk-…`) and a captured
 * production screen (`prod-…`) can point at the same page.
 */
export const LIVE_SCREEN_ROUTES: Record<string, string> = {
  /* eACC Cloud — version 1 concept designs -------------------------- */
  'sk-cloud-close-status': '/eacc/close',
  'sk-cloud-close-blockers': '/eacc/close/blockers',
  'sk-cloud-receipt-number': '/eacc/cash-receipt',
  'sk-cloud-card-bulk': '/eacc/corp-card',
  'sk-cloud-expense-returned': '/eacc/personal-expense',

  /* eACC Cloud — captured production screens ------------------------ */
  'prod-corp-card': '/eacc/corp-card',
  'prod-accountant-cards': '/eacc/corp-card',
  'prod-personal-expense': '/eacc/personal-expense',
  'prod-tax-invoice': '/eacc/tax-invoice',
  'prod-cash-receipt': '/eacc/cash-receipt',
};

/** The live route a canvas id stands for, if the product has that screen. */
export function liveScreenRoute(screenId: string): string | null {
  // Prototype html files are the screens, so they answer for themselves.
  return findPrototypeFile(screenId)?.route ?? LIVE_SCREEN_ROUTES[screenId] ?? null;
}

export function hasLiveScreen(screenId: string): boolean {
  return liveScreenRoute(screenId) !== null;
}
