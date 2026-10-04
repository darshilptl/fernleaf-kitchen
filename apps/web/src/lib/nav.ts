import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  Package,
  Truck,
  Users,
  Coins,
  Building2,
  UtensilsCrossed,
  ReceiptText,
  Receipt,
  Settings2,
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
      { label: 'Staff', href: '/admin/staff', permission: 'staff.manage', icon: Users },
      { label: 'Pricing', href: '/admin/pricing', permission: 'pricing.read', icon: Coins },
      { label: 'Companies', href: '/admin/companies', permission: 'companies.read', icon: Building2 },
      { label: 'Menu', href: '/admin/menu', permission: 'menu.read', icon: UtensilsCrossed },
      { label: 'Orders', href: '/admin/orders', permission: 'orders.read', icon: ReceiptText },
      { label: 'Billing', href: '/admin/billing', permission: 'billing.read', icon: Receipt },
      { label: 'Settings', href: '/admin/settings', permission: 'settings.read', icon: Settings2 },
    ],
  },
];

export function visibleNavGroups(permissions: readonly string[]): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => permissions.includes(item.permission)),
  })).filter((group) => group.items.length > 0);
}
