import { redirect } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { DishTable } from '@/features/catalogue/dish-table';
import { OptionTable } from '@/features/catalogue/option-table';
import { ReferenceTabs } from '@/features/catalogue/reference-tabs';
import { loadStaffSession } from '@/lib/staff-session';

/**
 * Catalogue admin page: dishes (with groups and options in the
 * Sheet), reusable options, and reference lists. Guarded by
 * `catalogue.read` (UX only; the API enforces).
 */
export default async function CataloguePage(): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session === null) {
    redirect('/login');
  }
  if (!session.permissions.includes('catalogue.read')) {
    redirect(session.landingPath);
  }
  return (
    <Tabs defaultValue="dishes">
      <TabsList>
        <TabsTrigger value="dishes">Dishes</TabsTrigger>
        <TabsTrigger value="options">Options</TabsTrigger>
        <TabsTrigger value="reference">Reference lists</TabsTrigger>
      </TabsList>
      <TabsContent value="dishes">
        <DishTable />
      </TabsContent>
      <TabsContent value="options">
        <OptionTable />
      </TabsContent>
      <TabsContent value="reference">
        <ReferenceTabs />
      </TabsContent>
    </Tabs>
  );
}
