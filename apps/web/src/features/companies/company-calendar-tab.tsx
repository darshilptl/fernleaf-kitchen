'use client';

import { useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Input } from '@repo/ui/components/ui/input';
import { useAddHoliday, useCompany, useRemoveHoliday, useUpdateCompany } from '@/hooks/use-companies';

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
] as const;

/**
 * Company calendar: ISO working days plus dated holidays.
 * Edits are never blocked by existing orders. The company
 * calendar never moves the cut-off.
 */
export function CompanyCalendarTab({ companyId }: { companyId: string }): React.JSX.Element {
  const { company } = useCompany(companyId);
  const { update } = useUpdateCompany(companyId);
  const { add } = useAddHoliday(companyId);
  const { remove } = useRemoveHoliday(companyId);
  const [date, setDate] = useState('');
  const [holidayName, setHolidayName] = useState('');

  if (company === undefined) {
    return <p className="text-body-sm">Loading company…</p>;
  }

  function toggleDay(workingDays: number[], day: number, checked: boolean): void {
    const next = checked
      ? [...workingDays, day]
      : workingDays.filter((value) => value !== day);
    update({ workingDays: next });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h2 className="heading-sm">Working days</h2>
        <div className="flex flex-wrap gap-4">
          {WEEKDAYS.map((day) => (
            <label key={day.value} className="flex items-center gap-2 text-body-sm">
              <Checkbox
                checked={company.workingDays.includes(day.value)}
                onCheckedChange={(checked) => toggleDay(company.workingDays, day.value, checked === true)}
              />
              {day.label}
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="heading-sm">Holidays</h2>
        {company.holidays.map((holiday) => (
          <div key={holiday.id} className="flex items-center justify-between gap-4">
            <p className="text-body-sm">
              {holiday.date.slice(0, 10)} {holiday.name ?? ''}
            </p>
            <Button variant="outline" size="sm" onClick={() => remove(holiday.id)}>
              Remove
            </Button>
          </div>
        ))}
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (date !== '') {
              add(date, holidayName === '' ? null : holidayName);
              setDate('');
              setHolidayName('');
            }
          }}
        >
          <Input
            aria-label="Holiday date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <Input
            aria-label="Holiday name"
            placeholder="Name (optional)"
            value={holidayName}
            onChange={(event) => setHolidayName(event.target.value)}
          />
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
      </div>
    </div>
  );
}
