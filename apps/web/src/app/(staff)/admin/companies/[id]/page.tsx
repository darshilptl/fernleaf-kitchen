import { redirect } from 'next/navigation';
import { CompanyDetailTabs } from '@/features/companies/company-detail-tabs';
import { loadStaffSession } from '@/lib/staff-session';

/**
 * Company detail page with profile, addresses, calendar,
 * employees, and menu visibility tabs.
 */
export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session === null) {
    redirect('/login');
  }
  if (!session.permissions.includes('companies.read')) {
    redirect(session.landingPath);
  }
  const { id } = await params;
  return <CompanyDetailTabs companyId={id} />;
}
