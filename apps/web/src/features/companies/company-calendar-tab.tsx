'use client';

import { useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Field, FieldLabel, FieldLegend, FieldSet } from '@repo/ui/components/ui/field';
import { Input } from '@repo/ui/components/ui/input';
import { useAddHoliday, useCompany, useRemoveHoliday, useUpdateCompany } from '@/hooks/use-companies';
import { DatePicker } from '@/components/date-picker';

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
    <div className="flex min-w-0 flex-col gap-8">
      <FieldSet>
        <FieldLegend>Working days</FieldLegend>
        <div className="flex flex-row flex-wrap gap-4">
          {WEEKDAYS.map((day) => (
            <Field key={day.value} orientation="horizontal">
              <Checkbox
                id={`company-day-${day.value}`}
                checked={company.workingDays.includes(day.value)}
                onCheckedChange={(checked) => toggleDay(company.workingDays, day.value, checked === true)}
              />
              <FieldLabel htmlFor={`company-day-${day.value}`} className="font-normal">
                {day.label}
              </FieldLabel>
            </Field>
          ))}
        </div>
      </FieldSet>
      <div className="flex min-w-0 flex-col gap-6">
        <h2 className="heading-sm">Holidays</h2>
        {company.holidays.map((holiday) => (
          <div key={holiday.id} className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-body-sm">
              {holiday.date.slice(0, 10)} {holiday.name ?? ''}
            </p>
            <Button variant="outline" size="sm" onClick={() => remove(holiday.id)}>
              Remove
            </Button>
          </div>
        ))}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (date !== '') {
              add(date, holidayName === '' ? null : holidayName);
              setDate('');
              setHolidayName('');
            }
          }}
        >
          <div className="flex flex-wrap items-end gap-4">
            <Field>
              <FieldLabel>Date</FieldLabel>
              <DatePicker value={date} onChange={setDate} label="Holiday date" />
            </Field>
            <Field>
              <FieldLabel htmlFor="company-holiday-name">Name</FieldLabel>
              <Input
                id="company-holiday-name"
                placeholder="Optional"
                value={holidayName}
                onChange={(event) => setHolidayName(event.target.value)}
              />
            </Field>
            <Button type="submit" size="sm">
              Add
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
