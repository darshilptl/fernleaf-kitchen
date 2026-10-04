'use client';

import { useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Input } from '@repo/ui/components/ui/input';
import { useAddHoliday, useHolidays, useRemoveHoliday } from '@/hooks/use-settings';

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
      <div className="flex flex-col gap-4">
        <h2 className="heading-sm">Kitchen working days</h2>
        <div className="flex flex-wrap gap-4">
          {WEEKDAYS.map((day) => (
            <label key={day.value} className="flex items-center gap-2 text-body-sm">
              <Checkbox
                checked={props.workingDays.includes(day.value)}
                onCheckedChange={(checked) =>
                  props.onToggleDay(toggleDay(props.workingDays, day.value, checked === true))
                }
              />
              {day.label}
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="heading-sm">Kitchen holidays</h2>
        {isLoading ? (
          <p className="text-body-sm">Loading holidays…</p>
        ) : (
          (holidays ?? []).map((holiday) => (
            <div key={holiday.id} className="flex items-center justify-between gap-4">
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
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (date !== '') {
              add({ date, name: holidayName === '' ? null : holidayName });
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
          <Button type="submit" size="sm" disabled={adding}>
            Add
          </Button>
        </form>
      </div>
    </div>
  );
}
