import type { PermissionKey } from '@repo/shared';

export interface Session {
  id: string;
  name: string;
  email: string;
  /** Display only. Never used for logic; nav and guards use permissions. */
  roleName: string;
  permissions: string[];
  landingPath: string;
}

export function hasPermission(session: Session | null, key: PermissionKey): boolean {
  return session?.permissions.includes(key) ?? false;
}
