import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

/**
 * Global request log. Emits one line per request: method, path,
 * status, duration. Never logs bodies, query strings, headers,
 * cookies, or tokens — ids and outcomes only.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('http');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ method: string; url: string }>();
    const started = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<{ statusCode: number }>();
          this.logger.log(`${request.method} ${request.url} -> ${response.statusCode} ${Date.now() - started}ms`);
        },
        error: (error: unknown) => {
          const status = typeof error === 'object' && error !== null && 'status' in error
            ? String((error as { status: unknown }).status)
            : 'ERR';
          this.logger.warn(`${request.method} ${request.url} -> ${status} ${Date.now() - started}ms`);
        },
      }),
    );
  }
}

/**
 * Structured mutation log for the five business modules. Call
 * with the action name and entity ids only — never names,
 * emails, passwords, hashes, tokens, or request bodies.
 */
export function logAction(
  logger: Logger,
  action: string,
  details?: Record<string, string | number | boolean>,
): void {
  if (details === undefined) {
    logger.log(action);
    return;
  }
  const flat = Object.entries(details)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
  logger.log(`${action} ${flat}`);
}
