import type { PermissionKey } from '@repo/shared';

export interface NavItem {
  label: string;
  href: string;
  permission: PermissionKey;
}

/**
 * Navigation config keyed by permission (UX only; the server
 * enforces). Never role names. The shell filters with
 * `session.permissions.includes(item.permission)`.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', permission: 'orders.read' },
  { label: 'Catalogue', href: '/admin/catalogue', permission: 'catalogue.read' },
  { label: 'Orders', href: '/admin/orders', permission: 'orders.read' },
  { label: 'Kitchen', href: '/kitchen/dashboard', permission: 'kitchen.read' },
  { label: 'Dispatch', href: '/dispatch/dashboard', permission: 'dispatch.read' },
  { label: 'My drops', href: '/driver', permission: 'deliveries.read_own' },
  { label: 'Billing', href: '/admin/billing', permission: 'billing.read' },
  { label: 'Staff', href: '/admin/staff', permission: 'staff.manage' },
];

export function visibleNavItems(permissions: readonly string[]): NavItem[] {
  return NAV_ITEMS.filter((item) => permissions.includes(item.permission));
}
