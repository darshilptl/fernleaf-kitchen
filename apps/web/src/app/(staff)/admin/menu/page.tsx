import { redirect } from 'next/navigation';
import { CategoryList } from '@/features/menu/category-list';
import { MenuPreview } from '@/features/menu/menu-preview';
import { PlacementManager } from '@/features/menu/placement-manager';
import { loadStaffSession } from '@/lib/staff-session';

/**
 * Menu admin page: categories, dish placements, and the
 * employee preview. Guarded by `menu.read` (UX only).
 */
export default async function MenuPage(): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session === null) {
    redirect('/login');
  }
  if (!session.permissions.includes('menu.read')) {
    redirect(session.landingPath);
  }
  return (
    <div className="flex flex-col gap-8">
      <CategoryList />
      <PlacementManager />
      <MenuPreview />
    </div>
  );
}
