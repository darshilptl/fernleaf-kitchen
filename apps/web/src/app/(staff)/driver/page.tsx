import { redirect } from 'next/navigation';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@repo/ui/components/ui/empty';
import { LogoutButton } from '@/components/logout-button';
import { loadStaffSession } from '@/lib/staff-session';

const LANDING_PATH = '/driver';

/** Driver placeholder. Mobile-first drops view arrives later. */
export default async function DriverPage(): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session !== null && session.landingPath !== LANDING_PATH) {
    redirect(session.landingPath);
  }
  return (
    <div className="bg-background p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="heading-sm">My drops for today</h1>
        <LogoutButton />
      </div>
      <div className="bg-background-panel rounded-lg shadow-card p-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No drops yet</EmptyTitle>
            <EmptyDescription>
              Your drops for today in time order will appear here once dispatch assigns them.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
}
