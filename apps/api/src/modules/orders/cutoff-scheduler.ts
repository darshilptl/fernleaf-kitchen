import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClockService } from '../../common/clock/clock.service.js';
import { logAction } from '../../common/logging/logging.interceptor.js';
import { OrdersService } from './orders.service.js';

/**
 * Cut-off processing schedule. PDF §4.6 / skill time-and-cutoff.
 *
 * Every 60 s while the server is awake, once on startup
 * (catch-up for dates that locked while down), plus the manual
 * `POST /orders/cutoff/run`. The service call is idempotent, so
 * overlapping runs are safe by construction.
 */
@Injectable()
export class CutoffScheduler implements OnModuleInit {
  private readonly logger = new Logger(CutoffScheduler.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly clock: ClockService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.runOnce('startup');
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron(): Promise<void> {
    await this.runOnce('schedule');
  }

  private async runOnce(source: string): Promise<void> {
    try {
      const result = await this.orders.runCutoff(this.clock.now());
      if (result.processedDates.length > 0) {
        logAction(this.logger, 'order.cutoff-scheduled', {
          source,
          dates: result.processedDates.length,
        });
      }
    } catch (error) {
      this.logger.error(`Cut-off run failed (${source})`, error instanceof Error ? error.stack : undefined);
    }
  }
}
