'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { settingsSchema } from '@repo/shared';
import type { SettingsInput } from '@repo/shared';
import { Button } from '@repo/ui/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@repo/ui/components/ui/field';
import { Input } from '@repo/ui/components/ui/input';
import { applyServerErrors } from '@/lib/apply-server-errors';
import { notifyError } from '@/lib/notify';
import { ApiError } from '@/lib/api-client';
import { useSettings, useUpdateSettings } from '@/hooks/use-settings';
import { HolidayList } from './holiday-list';

function toMinuteInput(minute: number): string {
  const hours = Math.floor(minute / 60);
  const rest = minute % 60;
  return `${hours.toString().padStart(2, '0')}:${rest.toString().padStart(2, '0')}`;
}

function fromMinuteInput(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/**
 * Platform settings form: cut-off time and day count, at-risk
 * window, and the kitchen calendar. Changes are not retroactive:
 * confirmed orders stay confirmed.
 */
export function SettingsForm(): React.JSX.Element {
  const { settings, isLoading, isError, refetch } = useSettings();
  const { update, isPending } = useUpdateSettings();
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const form = useForm<SettingsInput>({ resolver: zodResolver(settingsSchema) });

  useEffect(() => {
    if (settings !== undefined) {
      form.reset({
        kitchenWorkingDays: settings.kitchenWorkingDays,
        cutoffTimeMinute: settings.cutoffTimeMinute,
        cutoffWorkingDays: settings.cutoffWorkingDays,
        atRiskMinutes: settings.atRiskMinutes,
      });
      setWorkingDays(settings.kitchenWorkingDays);
    }
  }, [settings, form]);

  if (isLoading || settings === undefined) {
    return <p className="text-body-sm">Loading settings…</p>;
  }
  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body-sm">Could not load the settings.</p>
        <Button variant="outline" size="sm" onClick={refetch}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit(
            (input) => update({ ...input, kitchenWorkingDays: workingDays }),
            (error) => {
              if (error instanceof ApiError) {
                applyServerErrors(form, error);
              } else {
                notifyError(error, 'Could not save the settings');
              }
            },
          )();
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="cutoff-time">Cut-off time (kitchen time)</FieldLabel>
            <Input
              id="cutoff-time"
              type="time"
              defaultValue={toMinuteInput(settings.cutoffTimeMinute)}
              onChange={(event) => {
                const minute = fromMinuteInput(event.target.value);
                form.setValue('cutoffTimeMinute', minute ?? settings.cutoffTimeMinute);
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="cutoff-days">Cut-off working days before delivery</FieldLabel>
            <Input
              id="cutoff-days"
              type="number"
              min={0}
              defaultValue={settings.cutoffWorkingDays}
              onChange={(event) => form.setValue('cutoffWorkingDays', Number(event.target.value))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="at-risk">At-risk window (minutes)</FieldLabel>
            <Input
              id="at-risk"
              type="number"
              min={0}
              defaultValue={settings.atRiskMinutes}
              onChange={(event) => form.setValue('atRiskMinutes', Number(event.target.value))}
            />
          </Field>
        </FieldGroup>
        <div className="mt-4">
          <Button type="submit" size="sm" disabled={isPending}>
            Save settings
          </Button>
        </div>
      </form>
      <HolidayList workingDays={workingDays} onToggleDay={setWorkingDays} />
      <p className="description-sm">
        Working-day ticks apply when you press Save settings. Holidays add and remove
        immediately. Changes never rewrite existing orders.
      </p>
    </div>
  );
}
