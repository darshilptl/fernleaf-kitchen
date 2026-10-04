import { redirect } from 'next/navigation';
import { AdminDashboard } from '@/features/dashboard/admin-dashboard';
import { loadStaffSession } from '@/lib/staff-session';

const LANDING_PATH = '/admin/dashboard';

/**
 * Admin operations overview. Figures A1-A4 (docs/dashboards.md).
 */
export default async function AdminDashboardPage(): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session !== null && session.landingPath !== LANDING_PATH) {
    redirect(session.landingPath);
  }
  return <AdminDashboard />;
}
