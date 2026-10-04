import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch } from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorItem } from '@repo/shared';
import { DomainError } from '@repo/shared';

/**
 * Maps business and validation failures to the
 * `{ code, path, message }[]` response shape. AGENTS.md §4.5.
 *
 * DomainError carries its own HTTP status. Zod errors become
 * 400 VALIDATION_ERROR items with dotted paths (e.g.
 * `lines[0].combinations[1].choices`). Anything else is a 500
 * INTERNAL_ERROR with no leaked detail.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof DomainError) {
      response.status(exception.httpStatus).json([exception.toItem()]);
      return;
    }
    if (exception instanceof ZodError) {
      const items: ApiErrorItem[] = exception.issues.map((issue) => {
        const item: ApiErrorItem = {
          code: 'VALIDATION_ERROR',
          message: issue.message,
        };
        if (issue.path.length > 0) {
          item.path = issue.path.join('.');
        }
        return item;
      });
      response.status(400).json(items);
      return;
    }
    const status =
      typeof exception === 'object' &&
      exception !== null &&
      'status' in exception &&
      typeof exception.status === 'number'
        ? exception.status
        : 500;
    const items: ApiErrorItem[] = [
      { code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR', message: 'Request failed' },
    ];
    response.status(status).json(items);
  }
}
