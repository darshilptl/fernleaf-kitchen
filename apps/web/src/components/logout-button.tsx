'use client';

import { Button } from '@repo/ui/components/ui/button';
import { useSession } from '@/hooks/use-session';

/** Signs out and returns to /login. Rendered on placeholder pages. */
export function LogoutButton(): React.JSX.Element {
  const { logout } = useSession();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        void logout();
      }}
    >
      Logout
    </Button>
  );
}
