'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { useCompany } from '@/hooks/use-companies';
import { CompanyProfileTab } from './company-profile-tab';
import { CompanyAddressesTab } from './company-addresses-tab';
import { CompanyCalendarTab } from './company-calendar-tab';
import { EmployeeTable } from '../employees/employee-table';
import { MenuVisibilityTab } from './menu-visibility-tab';

/**
 * Company detail: profile, addresses, calendar, employees, and
 * menu visibility tabs. Each tab owns its data and saves.
 */
export function CompanyDetailTabs({ companyId }: { companyId: string }): React.JSX.Element {
  const { company, isLoading, isError } = useCompany(companyId);

  if (isLoading || company === undefined) {
    return <p className="text-body-sm">Loading company…</p>;
  }
  if (isError) {
    return <p className="text-body-sm text-destructive">Could not load the company.</p>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="heading-sm">{company.name}</h1>
          <p className="description-sm">
            {company.isActive ? 'Active company' : 'Deactivated company'} ·{' '}
            {company._count.employees} employees
          </p>
        </div>
      </div>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="menu">Menu &amp; price</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <CompanyProfileTab companyId={companyId} />
        </TabsContent>
        <TabsContent value="addresses">
          <CompanyAddressesTab companyId={companyId} />
        </TabsContent>
        <TabsContent value="calendar">
          <CompanyCalendarTab companyId={companyId} />
        </TabsContent>
        <TabsContent value="employees">
          <EmployeeTable companyId={companyId} />
        </TabsContent>
        <TabsContent value="menu">
          <MenuVisibilityTab companyId={companyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
