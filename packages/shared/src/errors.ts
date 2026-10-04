/**
 * Error contracts. AGENTS.md §4.5.
 *
 * Business code throws only DomainError. One Nest filter maps
 * DomainError and Zod errors to the `{ code, path, message }[]`
 * response shape. The web api-client parses that same shape.
 */

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'AUTH_REQUIRED',
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_INACTIVE',
  'PERMISSION_DENIED',
  'ORDER_NOT_FOUND',
  'STAFF_NOT_FOUND',
  'STAFF_EMAIL_DUPLICATE',
  'STAFF_SELF_DEACTIVATE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorItem {
  code: string;
  path?: string;
  message: string;
}

interface DomainErrorInput {
  code: ErrorCode;
  path?: string;
  message: string;
  httpStatus: number;
}

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly path: string | undefined;
  readonly httpStatus: number;

  constructor(input: DomainErrorInput) {
    super(input.message);
    this.name = 'DomainError';
    this.code = input.code;
    this.path = input.path;
    this.httpStatus = input.httpStatus;
  }

  toItem(): ApiErrorItem {
    const item: ApiErrorItem = { code: this.code, message: this.message };
    if (this.path !== undefined) {
      item.path = this.path;
    }
    return item;
  }
}
