'use client';

import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@repo/ui/components/ui/button';
import { Calendar } from '@repo/ui/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/ui/components/ui/popover';

function toLabel(value: string): string {
  return value === '' ? 'Pick a date' : value;
}

/**
 * Shared calendar date picker. Value is a `YYYY-MM-DD` string;
 * parsing/formatting is pure string handling (no "today"
 * computation). Replaces native date inputs dashboard-wide.
 */
export function DatePicker(props: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const selected =
    props.value === '' ? undefined : new Date(`${props.value}T00:00:00.000Z`);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="outline" aria-label={props.label} />}
      >
        <CalendarIcon data-icon="inline-start" />
        {toLabel(props.value)}
      </PopoverTrigger>
      <PopoverContent align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date !== undefined) {
              const month = String(date.getUTCMonth() + 1).padStart(2, '0');
              const day = String(date.getUTCDate()).padStart(2, '0');
              props.onChange(`${date.getUTCFullYear()}-${month}-${day}`);
            }
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
