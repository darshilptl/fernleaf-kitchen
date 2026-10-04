import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import type { ApiError } from './api-client.js';

/**
 * Maps server error `path` entries onto matching form fields.
 * Form shapes mirror API payloads 1:1, so `email` lands on the
 * email field. Items without a path become a root error shown
 * as server text (the toast file lands separately from the user).
 */
export function applyServerErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: ApiError,
): void {
  let mapped = false;
  for (const field of error.fieldErrors()) {
    try {
      form.setError(field.path as Path<T>, { type: 'server', message: field.message });
      mapped = true;
    } catch {
      // Unknown path: falls through to the root error below.
    }
  }
  if (!mapped) {
    form.setError('root.server' as Path<T>, {
      type: 'server',
      message: error.items[0]?.message ?? 'Request failed',
    });
  }
}
