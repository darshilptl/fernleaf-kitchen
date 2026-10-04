/**
 * Permission keys. PDF §3 / D-01.
 *
 * Single list of every permission key in the system. Code asks
 * "has permission X" and never compares role names or role keys.
 * Role key/value specs live here too so seeding (api base-data)
 * and the web nav filter read the same source.
 */

export const PERMISSIONS = [
  'catalogue.read',
  'catalogue.manage',
  'menu.read',
  'menu.manage',
  'pricing.read',
  'pricing.manage',
  'companies.read',
  'companies.manage',
  'employees.read',
  'employees.manage',
  'orders.read',
  'orders.create',
  'orders.override',
  'orders.cutoff_run',
  'kitchen.read',
  'kitchen.work',
  'kitchen.force_complete',
  'dispatch.read',
  'dispatch.manage',
  'deliveries.read_own',
  'deliveries.complete_own',
  'deliveries.assignable',
  'billing.read',
  'billing.manage',
  'settings.read',
  'settings.manage',
  'staff.read',
  'staff.manage',
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSIONS as readonly string[]).includes(value);
}

interface RoleSpec {
  key: string;
  name: string;
  landingPath: string;
  permissions: readonly PermissionKey[];
}

const ALL_EXCEPT_ASSIGNABLE: PermissionKey[] = PERMISSIONS.filter(
  (key): key is PermissionKey => key !== 'deliveries.assignable',
);

/**
 * Seeded roles. D-75: Admin holds every key except `deliveries.assignable`
 * so admins never appear in driver pickers.
 */
export const ROLE_SPECS: readonly RoleSpec[] = [
  {
    key: 'admin',
    name: 'Admin',
    landingPath: '/admin/dashboard',
    permissions: ALL_EXCEPT_ASSIGNABLE,
  },
  {
    key: 'kitchen',
    name: 'Kitchen',
    landingPath: '/kitchen/dashboard',
    permissions: ['orders.read', 'catalogue.read', 'kitchen.read', 'kitchen.work'],
  },
  {
    key: 'dispatch',
    name: 'Dispatch',
    landingPath: '/dispatch/dashboard',
    permissions: [
      'orders.read',
      'companies.read',
      'kitchen.read',
      'dispatch.read',
      'dispatch.manage',
    ],
  },
  {
    key: 'driver',
    name: 'Driver',
    landingPath: '/driver',
    permissions: [
      'deliveries.read_own',
      'deliveries.complete_own',
      'deliveries.assignable',
    ],
  },
];
