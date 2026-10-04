import { redirect } from 'next/navigation';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@repo/ui/components/ui/empty';
import { LogoutButton } from '@/components/logout-button';
import { loadStaffSession } from '@/lib/staff-session';

const LANDING_PATH = '/kitchen/dashboard';

/** Kitchen placeholder. The kitchen board arrives in its module. */
export default async function KitchenDashboardPage(): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session !== null && session.landingPath !== LANDING_PATH) {
    redirect(session.landingPath);
  }
  return (
    <div className="bg-background p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="heading-sm">Today&apos;s prep</h1>
        <LogoutButton />
      </div>
      <div className="bg-background-panel rounded-lg shadow-card p-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Kitchen board coming soon</EmptyTitle>
            <EmptyDescription>
              Today&apos;s prep units by station, with late and at-risk work, will be defined in
              the kitchen module.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
}
