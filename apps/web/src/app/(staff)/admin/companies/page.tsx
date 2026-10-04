import { redirect } from 'next/navigation';
import { CompanyTable } from '@/features/companies/company-table';
import { loadStaffSession } from '@/lib/staff-session';

/**
 * Company list page. Guarded by `companies.read` (UX only; the
 * API enforces).
 */
export default async function CompaniesPage(): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session === null) {
    redirect('/login');
  }
  if (!session.permissions.includes('companies.read')) {
    redirect(session.landingPath);
  }
  return <CompanyTable />;
}
