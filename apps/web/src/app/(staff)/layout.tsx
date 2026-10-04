import { redirect } from 'next/navigation';
import { DashboardFrame } from '@/components/layout/dashboard-frame';
import { loadStaffSession } from '@/lib/staff-session';
import { QueryProvider } from '@/providers/query-provider';

/**
 * Server guard for every (staff) page. Unauthenticated →
 * /login. Role landing mismatches are handled per page, which
 * redirects to the session landingPath.
 */
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session === null) {
    redirect('/login');
  }
  return (
    <QueryProvider>
      <DashboardFrame>{children}</DashboardFrame>
    </QueryProvider>
  );
}
