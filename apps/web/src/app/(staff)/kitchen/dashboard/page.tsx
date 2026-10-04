import { redirect } from 'next/navigation';
import { loadStaffSession } from '@/lib/staff-session';
import { KitchenBoard } from '@/features/kitchen/kitchen-board';

const LANDING_PATH = '/kitchen/dashboard';

/** Kitchen board: prep units for a delivery date by station. */
export default async function KitchenDashboardPage(): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session !== null && session.landingPath !== LANDING_PATH) {
    redirect(session.landingPath);
  }
  return <KitchenBoard />;
}
