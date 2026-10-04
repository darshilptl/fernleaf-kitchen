'use client';

import { useState } from 'react';
import { formatMoney } from '@repo/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { Input } from '@repo/ui/components/ui/input';
import { useCompanies } from '@/hooks/use-companies';
import { useEmployees } from '@/hooks/use-employees';
import { useMenuPreview } from '@/hooks/use-menu';

/**
 * Menu preview as an employee: pick a company, then an
 * employee, and see exactly their menu (employee view only).
 * An inactive employee or company shows a banner instead of
 * refusing, so staff keep the debugging view.
 */
export function MenuPreview(): React.JSX.Element {
  const [companyId, setCompanyId] = useState('');
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const { data: companyPage } = useCompanies(1, '');
  const { data: employeePage } = useEmployees(companyId, 1);
  const { preview, isLoading } = useMenuPreview(employeeId, slug === '' ? undefined : slug);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="heading-sm">Menu preview</h2>
        <div className="flex items-center gap-2">
          <Select
            value={companyId}
            onValueChange={(value) => {
              setCompanyId(value ?? '');
              setEmployeeId(null);
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Pick a company" />
            </SelectTrigger>
            <SelectContent>
              {(companyPage?.items ?? []).map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={employeeId ?? ''}
            onValueChange={(value) => setEmployeeId(value === '' ? null : value)}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Pick an employee" />
            </SelectTrigger>
            <SelectContent>
              {(employeePage?.items ?? []).map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label="Secret category slug"
            placeholder="Secret slug (optional)"
            className="w-64"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
        </div>
      </div>
      {employeeId === null && (
        <p className="description-sm">Choose a company and an employee to preview their menu.</p>
      )}
      {isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}
      {preview?.banner !== undefined && preview?.banner !== null && (
        <p className="text-body-sm font-medium">{preview.banner}</p>
      )}
      {(preview?.categories ?? []).map((category) => (
        <div key={category.categoryId} className="flex flex-col gap-4">
          <h3 className="heading-sm">
            {category.name} {category.isSecret && '(secret)'}
          </h3>
          {category.items.map((item) => (
            <div
              key={item.itemId}
              className="flex items-start justify-between gap-4 rounded-lg bg-background-panel p-6 shadow-card"
            >
              <div className="flex flex-col gap-1">
                <p className="text-body-sm font-medium">{item.name}</p>
                {item.description !== null && (
                  <p className="description-sm">{item.description}</p>
                )}
                <div className="flex flex-col gap-1">
                  {item.groups.map((group) => (
                    <p key={group.id} className="text-caption text-foreground-muted">
                      {group.name}: {group.options.map((option) => option.name).join(', ')}
                    </p>
                  ))}
                </div>
              </div>
              <p className="text-body-sm font-medium tabular-nums">{formatMoney(item.priceCents)}</p>
            </div>
          ))}
        </div>
      ))}
      {preview !== undefined && preview.categories.length === 0 && !isLoading && (
        <p className="description-sm">Nothing on this employee&apos;s menu.</p>
      )}
    </div>
  );
}
