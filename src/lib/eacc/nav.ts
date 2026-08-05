/**
 * The eACC Cloud app's menu, in one place.
 *
 * The app shell renders it as navigation; the WE-ADK screen preview renders the
 * same structure as static chrome, so a design file previews inside the product
 * it belongs to rather than on a blank page.
 */
import {
  CalendarCheck2,
  CreditCard,
  FileText,
  Gauge,
  LayoutDashboard,
  Receipt,
  Settings,
  TriangleAlert,
  Wallet,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const EACC_NAV: NavGroup[] = [
  {
    title: 'Accountant',
    items: [
      { label: 'Dashboard', href: '/eacc/dashboard', icon: Gauge },
      { label: 'Close Status', href: '/eacc/close', icon: LayoutDashboard },
      { label: 'Close Blockers', href: '/eacc/close/blockers', icon: TriangleAlert, badge: '8' },
      { label: 'Approval Queue', href: '/eacc/approvals', icon: CalendarCheck2, badge: '12' },
    ],
  },
  {
    title: 'Expense Management',
    items: [
      { label: 'Corporate Card', href: '/eacc/corp-card', icon: CreditCard },
      { label: 'Personal Expense', href: '/eacc/personal-expense', icon: Wallet },
    ],
  },
  {
    title: 'Tax & Receipts',
    items: [
      { label: 'Tax Invoice', href: '/eacc/tax-invoice', icon: FileText },
      { label: 'Cash Receipt', href: '/eacc/cash-receipt', icon: Receipt },
    ],
  },
  {
    title: 'Administration',
    items: [{ label: 'Settings', href: '/eacc/settings', icon: Settings }],
  },
];

export const EACC_NAV_ITEMS: NavItem[] = EACC_NAV.flatMap((group) => group.items);

/** The menu entry a route belongs to — exact match first, then the parent menu. */
export function findNavItem(route: string): { group: NavGroup; item: NavItem } | null {
  for (const group of EACC_NAV) {
    const exact = group.items.find((item) => item.href === route);
    if (exact) return { group, item: exact };
  }
  for (const group of EACC_NAV) {
    const parent = group.items.find((item) => route.startsWith(`${item.href}/`));
    if (parent) return { group, item: parent };
  }
  return null;
}
