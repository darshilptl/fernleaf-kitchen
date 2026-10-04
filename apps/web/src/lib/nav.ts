import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  Package,
  Truck,
  Receipt,
  Users,
} from 'lucide-react';
import type { PermissionKey } from '@repo/shared';

export interface NavItem {
  label: string;
  href: string;
  permission: PermissionKey;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

/**
 * Navigation config keyed by permission (UX only; the server
 * enforces). Never role names. One entry adds a dashboard page —
 * no structural change. Groups render as sidebar sections;
 * every role sees only its permission-passing items.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', permission: 'orders.read', icon: LayoutDashboard },
      { label: 'Kitchen', href: '/kitchen/dashboard', permission: 'kitchen.read', icon: ClipboardList },
      { label: 'Dispatch', href: '/dispatch/dashboard', permission: 'dispatch.read', icon: Truck },
      { label: 'My drops', href: '/driver', permission: 'deliveries.read_own', icon: Package },
    ],
  },
  {
    label: 'Manage',
    items: [
      { label: 'Catalogue', href: '/admin/catalogue', permission: 'catalogue.read', icon: BookOpen },
      { label: 'Orders', href: '/admin/orders', permission: 'orders.read', icon: ClipboardList },
      { label: 'Billing', href: '/admin/billing', permission: 'billing.read', icon: Receipt },
      { label: 'Staff', href: '/admin/staff', permission: 'staff.manage', icon: Users },
    ],
  },
];

/** Flat list preserved for non-sidebar consumers. */
export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function visibleNavItems(permissions: readonly string[]): NavItem[] {
  return NAV_ITEMS.filter((item) => permissions.includes(item.permission));
}

export function visibleNavGroups(permissions: readonly string[]): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => permissions.includes(item.permission)),
  })).filter((group) => group.items.length > 0);
}
