import { redirect } from 'next/navigation';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@repo/ui/components/ui/empty';
import { LogoutButton } from '@/components/logout-button';
import { loadStaffSession } from '@/lib/staff-session';

const LANDING_PATH = '/admin/dashboard';

/**
 * Admin placeholder. Real figures arrive with the dashboards
 * module. No numbers here by design (honest-figures rule).
 */
export default async function AdminDashboardPage(): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session !== null && session.landingPath !== LANDING_PATH) {
    redirect(session.landingPath);
  }
  return (
    <div className="bg-background p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="heading-sm">Operations overview</h1>
        <LogoutButton />
      </div>
      <div className="bg-background-panel rounded-lg shadow-card p-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Dashboard coming soon</EmptyTitle>
            <EmptyDescription>
              Orders by status, unbilled totals, unpaid invoices and pricing gaps will be defined
              in the dashboards module.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
}
