import { redirect } from 'next/navigation';
import { loadStaffSession } from '@/lib/staff-session';
import { DriverDrops } from '@/features/driver/driver-drops';

const LANDING_PATH = '/driver';

/** Driver view: own drops for today, mobile-first. */
export default async function DriverPage(): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session !== null && session.landingPath !== LANDING_PATH) {
    redirect(session.landingPath);
  }
  return <DriverDrops />;
}
