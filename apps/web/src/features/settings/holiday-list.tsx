'use client';

import { useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Field, FieldLabel, FieldLegend, FieldSet } from '@repo/ui/components/ui/field';
import { Input } from '@repo/ui/components/ui/input';
import { useAddHoliday, useHolidays, useRemoveHoliday } from '@/hooks/use-settings';
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

function toggleDay(workingDays: number[], day: number, checked: boolean): number[] {
  const next = checked ? [...workingDays, day] : workingDays.filter((value) => value !== day);
  return [...new Set(next)].sort((a, b) => a - b);
}

/**
 * Kitchen calendar: working days plus dated holidays. Only the
 * kitchen calendar moves the cut-off (PDF §4.10).
 */
export function HolidayList(props: {
  workingDays: number[];
  onToggleDay: (days: number[]) => void;
}): React.JSX.Element {
  const { holidays, isLoading } = useHolidays();
  const { add, isPending: adding } = useAddHoliday(() => undefined);
  const { remove } = useRemoveHoliday();
  const [date, setDate] = useState('');
  const [holidayName, setHolidayName] = useState('');

  return (
    <div className="flex flex-col gap-8">
      <FieldSet>
        <FieldLegend>Kitchen working days</FieldLegend>
        <div className="flex flex-row flex-wrap gap-4">
          {WEEKDAYS.map((day) => (
            <Field key={day.value} orientation="horizontal">
              <Checkbox
                id={`kitchen-day-${day.value}`}
                checked={props.workingDays.includes(day.value)}
                onCheckedChange={(checked) =>
                  props.onToggleDay(toggleDay(props.workingDays, day.value, checked === true))
                }
              />
              <FieldLabel htmlFor={`kitchen-day-${day.value}`} className="font-normal">
                {day.label}
              </FieldLabel>
            </Field>
          ))}
        </div>
      </FieldSet>
      <div className="flex min-w-0 flex-col gap-6">
        <h2 className="heading-sm">Kitchen holidays</h2>
        {isLoading ? (
          <p className="text-body-sm">Loading holidays…</p>
        ) : (
          (holidays ?? []).map((holiday) => (
            <div key={holiday.id} className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-body-sm">
                {holiday.date} {holiday.name ?? ''}
              </p>
              <Button variant="outline" size="sm" onClick={() => remove(holiday.id)}>
                Remove
              </Button>
            </div>
          ))
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (date !== '') {
              add({ date, name: holidayName === '' ? null : holidayName });
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
              <FieldLabel htmlFor="holiday-name">Name</FieldLabel>
              <Input
                id="holiday-name"
                placeholder="Optional"
                value={holidayName}
                onChange={(event) => setHolidayName(event.target.value)}
              />
            </Field>
            <Button type="submit" size="sm" disabled={adding}>
              Add
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
