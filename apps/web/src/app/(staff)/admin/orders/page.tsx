import { redirect } from 'next/navigation';
import { OrderList } from '@/features/orders/order-list';
import { loadStaffSession } from '@/lib/staff-session';

/**
 * Order list page. Guarded by `orders.read` (UX only).
 */
export default async function OrdersPage(): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session === null) {
    redirect('/login');
  }
  if (!session.permissions.includes('orders.read')) {
    redirect(session.landingPath);
  }
  return <OrderList />;
}
