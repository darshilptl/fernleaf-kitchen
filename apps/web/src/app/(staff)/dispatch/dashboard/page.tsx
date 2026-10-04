import { redirect } from 'next/navigation';
import { loadStaffSession } from '@/lib/staff-session';
import { DispatchBoard } from '@/features/dispatch/dispatch-board';

const LANDING_PATH = '/dispatch/dashboard';

/** Dispatch board: drops with driver assignment and steps. */
export default async function DispatchDashboardPage(): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session !== null && session.landingPath !== LANDING_PATH) {
    redirect(session.landingPath);
  }
  return <DispatchBoard />;
}
