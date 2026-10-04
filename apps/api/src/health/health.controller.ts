import { Controller, Get } from '@nestjs/common';
import { Public } from '../modules/auth/auth.decorator.js';

/** Liveness probe. Served as `/api/health` via the global prefix. */
@Public()
@Controller('health')
export class HealthController {
  @Get()
  check(): { ok: boolean } {
    return { ok: true };
  }
}
