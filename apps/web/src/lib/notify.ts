'use client';

import { toast } from '@repo/ui/components/ui/toast';
import { ApiError } from './api-client';

/**
 * Shows an unmapped server failure as a toast. Field errors go
 * through `applyServerErrors` instead; this is for the rest.
 */
export function notifyError(error: unknown, fallback: string): void {
  if (error instanceof ApiError) {
    const first = error.items[0];
    toast.add({
      title: 'Request failed',
      description: first?.message ?? fallback,
      type: 'error',
    });
    return;
  }
  toast.add({ title: 'Request failed', description: fallback, type: 'error' });
}

export function notifySuccess(title: string, description?: string): void {
  toast.add({ title, description, type: 'success' });
}
