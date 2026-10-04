import { redirect } from 'next/navigation';
import { loadStaffSession } from '@/lib/staff-session';
import { BillableList } from '@/features/billing/billable-list';

const LANDING_PATH = '/admin/dashboard';

/** Billing workspace: billable orders and invoices. */
export default async function BillingPage(): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session !== null && session.landingPath !== LANDING_PATH) {
    redirect(session.landingPath);
  }
  return <BillableList />;
}
