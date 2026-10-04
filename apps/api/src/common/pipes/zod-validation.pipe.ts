import type { PipeTransform } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Parses every request body/query with a shared Zod schema.
 * AGENTS.md §4.4: never validate by hand. Zod failures reach
 * the DomainExceptionFilter, which shapes them for the client.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    return this.schema.parse(value);
  }
}
