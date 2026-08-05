/**
 * Screens that already exist in the live product — the repository you copy from
 * when a customer asks for a change, rather than starting from a blank canvas.
 *
 * Single source of truth: Sketcher's production shelf and Builder's solution
 * mockup list both read this.
 */
import { type Chip } from './types';
import { type SeedPattern } from './sketches';

export const SOLUTIONS = ['Cloud', 'HD Korea Shipbuilding', 'Harim'] as const;
export type SolutionName = (typeof SOLUTIONS)[number];

export interface ProductionScreen {
  id: string;
  solution: SolutionName;
  /** Menu path as users see it. */
  path: string;
  route: string;
  seedPattern: SeedPattern;
  status: Chip;
  capturedAt: string;
  /** Indented under its parent menu in the list. */
  nested?: boolean;
}

export const PRODUCTION_SCREENS: ProductionScreen[] = [
  {
    id: 'prod-login',
    solution: 'Cloud',
    path: 'Login',
    route: '/login',
    seedPattern: 'detailPage',
    status: { label: 'Captured', tone: 'green' },
    capturedAt: '2026-07-24',
  },
  {
    id: 'prod-corp-card',
    solution: 'Cloud',
    path: 'Corporate card > Corporate card',
    route: '/eacc-cloud-corp-card/list',
    seedPattern: 'listPage',
    status: { label: 'Captured', tone: 'green' },
    capturedAt: '2026-07-03',
    nested: true,
  },
  {
    id: 'prod-personal-expense',
    solution: 'Cloud',
    path: 'Personal expense > Personal expense',
    route: '/eacc-cloud-personal-expense/list',
    seedPattern: 'listPage',
    status: { label: 'Captured', tone: 'green' },
    capturedAt: '2026-07-03',
    nested: true,
  },
  {
    id: 'prod-tax-invoice',
    solution: 'Cloud',
    path: 'Purchase tax invoice > Purchase tax invoice',
    route: '/eacc-cloud-tax-invoice/list',
    seedPattern: 'listPage',
    status: { label: 'Captured', tone: 'green' },
    capturedAt: '2026-07-06',
  },
  {
    id: 'prod-cash-receipt',
    solution: 'Cloud',
    path: 'Cash receipt > Cash receipt',
    route: '/eacc-cloud-cash-receipt/list',
    seedPattern: 'listPage',
    status: { label: 'Captured', tone: 'green' },
    capturedAt: '2026-07-06',
    nested: true,
  },
  {
    id: 'prod-trip-plan-list',
    solution: 'Cloud',
    path: 'Business trip plan > Trip plan',
    route: '/eacc-cloud-business-plan/list',
    seedPattern: 'listPage',
    status: { label: 'Captured', tone: 'green' },
    capturedAt: '2026-07-03',
    nested: true,
  },
  {
    id: 'prod-trip-plan-proxy',
    solution: 'Cloud',
    path: 'Business trip plan > Trip plan (drafted by proxy)',
    route: '/eacc-cloud-business-plan/proxy',
    seedPattern: 'detailPage',
    status: { label: 'Captured', tone: 'green' },
    capturedAt: '2026-07-03',
    nested: true,
  },
  {
    id: 'prod-accountant-cards',
    solution: 'Cloud',
    path: 'Accountant > Corporate card (all)',
    route: '/eacc-cloud-accountant/corp-card',
    seedPattern: 'listPage',
    status: { label: 'Captured', tone: 'green' },
    capturedAt: '2026-07-06',
  },
  {
    id: 'prod-hd-trip-list',
    solution: 'HD Korea Shipbuilding',
    path: 'Business trip plan > Trip plan',
    route: '/hd-business-plan/list',
    seedPattern: 'listPage',
    status: { label: 'Captured', tone: 'green' },
    capturedAt: '2026-07-11',
  },
  {
    id: 'prod-hd-trip-create',
    solution: 'HD Korea Shipbuilding',
    path: 'Business trip plan > Trip plan editor',
    route: '/hd-business-plan/create',
    seedPattern: 'detailPage',
    status: { label: 'Captured', tone: 'green' },
    capturedAt: '2026-07-11',
    nested: true,
  },
  {
    id: 'prod-hd-approvals',
    solution: 'HD Korea Shipbuilding',
    path: 'Approvals > Pending approvals',
    route: '/hd-approval/pending',
    seedPattern: 'listPage',
    status: { label: 'Stale', tone: 'amber' },
    capturedAt: '2026-06-20',
  },
  {
    id: 'prod-harim-voucher-list',
    solution: 'Harim',
    path: 'Voucher > Redemption history',
    route: '/harim-voucher/history',
    seedPattern: 'listPage',
    status: { label: 'Captured', tone: 'green' },
    capturedAt: '2026-07-15',
  },
  {
    id: 'prod-harim-merchant',
    solution: 'Harim',
    path: 'Merchant > Merchant detail',
    route: '/harim-merchant/detail',
    seedPattern: 'detailPage',
    status: { label: 'Captured', tone: 'green' },
    capturedAt: '2026-07-15',
    nested: true,
  },
];

export function findProductionScreen(screenId: string): ProductionScreen | null {
  return PRODUCTION_SCREENS.find((entry) => entry.id === screenId) ?? null;
}

export function productionScreensFor(solution: SolutionName): ProductionScreen[] {
  return PRODUCTION_SCREENS.filter((entry) => entry.solution === solution);
}
