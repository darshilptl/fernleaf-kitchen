import { redirect } from 'next/navigation';
import { OrderDetail } from '@/features/orders/order-detail';
import { loadStaffSession } from '@/lib/staff-session';

/**
 * Order detail page with lines, money, delivery and timeline.
 * Guarded by `orders.read` (UX only).
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session === null) {
    redirect('/login');
  }
  if (!session.permissions.includes('orders.read')) {
    redirect(session.landingPath);
  }
  const { id } = await params;
  return <OrderDetail id={id} />;
}
