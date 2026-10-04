import { redirect } from 'next/navigation';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@repo/ui/components/ui/empty';
import { LogoutButton } from '@/components/logout-button';
import { loadStaffSession } from '@/lib/staff-session';

const LANDING_PATH = '/dispatch/dashboard';

/** Dispatch placeholder. Drops and driver assignment arrive later. */
export default async function DispatchDashboardPage(): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session !== null && session.landingPath !== LANDING_PATH) {
    redirect(session.landingPath);
  }
  return (
    <div className="bg-background p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="heading-sm">Today&apos;s drops</h1>
        <LogoutButton />
      </div>
      <div className="bg-background-panel rounded-lg shadow-card p-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Dispatch board coming soon</EmptyTitle>
            <EmptyDescription>
              Today&apos;s drops by stage, unassigned drops and on-time figures will be defined in
              the dispatch module.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
}
