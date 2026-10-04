import { redirect } from 'next/navigation';
import { StaffTable } from '@/features/staff/staff-table';
import { loadStaffSession } from '@/lib/staff-session';

/**
 * Staff admin page. Guarded by `staff.manage` (UX only; the
 * API enforces).
 */
export default async function StaffPage(): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session === null) {
    redirect('/login');
  }
  if (!session.permissions.includes('staff.manage')) {
    redirect(session.landingPath);
  }
  return <StaffTable />;
}
