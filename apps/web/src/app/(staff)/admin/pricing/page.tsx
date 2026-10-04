import { redirect } from 'next/navigation';
import { PricingWorkspace } from '@/features/pricing/pricing-workspace';
import { loadStaffSession } from '@/lib/staff-session';

/**
 * Pricing admin page. Guarded by `pricing.read` (UX only; the
 * API enforces). Content owns no H1 duplication: the tier list
 * carries the page title.
 */
export default async function PricingPage(): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session === null) {
    redirect('/login');
  }
  if (!session.permissions.includes('pricing.read')) {
    redirect(session.landingPath);
  }
  return <PricingWorkspace />;
}
