import { DomainError } from '@repo/shared';

/**
 * Catalogue Must-only guards. PDF §4.1.
 *
 * Portions are [Should] and deferred: any write smuggling portion
 * data (`usesPortions: true`, sizes) is rejected here, in a
 * transaction, before it can break the portion invariant.
 * Name trimming lives in the Zod schemas; uniqueness is
 * case-insensitive at the DB layer (see migration constraints).
 */
export function assertNoPortions(value: unknown): void {
  if (typeof value !== 'object' || value === null) {
    return;
  }
  const record = value as Record<string, unknown>;
  const usesPortions = record['usesPortions'];
  const sizes = record['sizes'];
  const portionSizeId = record['portionSizeId'];
  const sizeId = record['sizeId'];
  if (
    usesPortions === true ||
    (Array.isArray(sizes) && sizes.length > 0) ||
    typeof portionSizeId === 'string' ||
    typeof sizeId === 'string'
  ) {
    throw new DomainError({
      code: 'PORTIONS_DEFERRED',
      message: 'Portions are not supported yet',
      httpStatus: 409,
    });
  }
}

/**
 * Reject blank-after-trim names that slipped past transport
 * (schemas already trim; this is the service-side backstop).
 */
export function assertNonBlank(name: string, field: string): void {
  if (name.trim() === '') {
    throw new DomainError({
      code: 'VALIDATION_ERROR',
      path: field,
      message: `${field} must not be blank`,
      httpStatus: 400,
    });
  }
}
