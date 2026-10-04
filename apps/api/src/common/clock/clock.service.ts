import { Injectable } from '@nestjs/common';

/**
 * Testable clock. PDF §7 / skill testing.
 *
 * Services read `now()` instead of `new Date()` so specs can
 * freeze time with `setNow`. Production default is the real
 * clock; tests inject a fixed instant per test.
 */
@Injectable()
export class ClockService {
  private frozen: Date | null = null;

  now(): Date {
    return this.frozen === null ? new Date() : new Date(this.frozen);
  }

  /** Test-only: freeze the clock at `instant`. */
  setNow(instant: Date): void {
    this.frozen = new Date(instant);
  }

  /** Test-only: resume the real clock. */
  reset(): void {
    this.frozen = null;
  }
}
