import { redirect } from 'next/navigation';
import { loadStaffSession } from '@/lib/staff-session';
import { InvoiceDetail } from '@/features/billing/invoice-detail';

const LANDING_PATH = '/admin/dashboard';

/** Invoice detail: frozen total with member orders. */
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session !== null && session.landingPath !== LANDING_PATH) {
    redirect(session.landingPath);
  }
  const { id } = await params;
  return <InvoiceDetail id={id} />;
}
