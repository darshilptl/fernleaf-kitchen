import { Injectable, Logger } from '@nestjs/common';
import { kitchenToday, toDbDate } from '@repo/shared';
import { PrismaService } from '../../database/prisma.service.js';
import { ClockService } from '../../common/clock/clock.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { resolveDishPrice } from '../pricing/domain/resolve-price.js';

export interface StatusSlice {
  status: string;
  count: number;
  totalCents: number;
}

export interface CompanySlice {
  companyId: string;
  companyName: string;
  count: number;
  totalCents: number;
}

export interface AdminFigures {
  byStatus: StatusSlice[];
  unbilledTotalCents: number;
  topCompanies: CompanySlice[];
  unpaidCount: number;
  unpaidTotalCents: number;
  oldestUnpaidAgeDays: number | null;
  pricingGapDishes: number;
}

const ALL_STATUSES = ['DRAFT', 'PLACED', 'CONFIRMED', 'DELIVERED', 'CANCELLED', 'REJECTED'];

/**
 * Admin dashboard figures. PDF §4.11 / skill dashboards (A1-A4).
 *
 * Computed on the server with SQL aggregates; the browser only
 * renders. Date basis is always `deliveryDate` in the kitchen
 * zone; money is integer cents. Missing data is null ("n/a"),
 * never a fake zero. Definitions live in `docs/dashboards.md`.
 */
@Injectable()
export class DashboardsService {
  private readonly logger = new Logger(DashboardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly clock: ClockService,
  ) {}

  async adminFigures(): Promise<AdminFigures> {
    const now = this.clock.now();
    const today = kitchenToday(now);
    const end = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
    const grouped = await this.prisma.$queryRaw<Array<{ status: string; count: bigint; total: bigint | null }>>`
      SELECT status, COUNT(*)::bigint AS count, COALESCE(SUM("totalCents"), 0)::bigint AS total
      FROM orders
      WHERE "deliveryDate" BETWEEN ${toDbDate(today)} AND ${toDbDate(kitchenToday(end))}
      GROUP BY status`;
    const byStatus = ALL_STATUSES.map((status) => {
      const row = grouped.find((entry) => entry.status === status);
      return { status, count: Number(row?.count ?? 0), totalCents: Number(row?.total ?? 0) };
    });

    const billable = await this.prisma.$queryRaw<Array<{ companyId: string; companyName: string; count: bigint; total: bigint }>>`
      SELECT o."companyId", c.name AS "companyName", COUNT(*)::bigint AS count, SUM(o."totalCents")::bigint AS total
      FROM orders o JOIN companies c ON c.id = o."companyId"
      WHERE o.status IN ('CONFIRMED', 'DELIVERED') AND o."invoiceId" IS NULL
      GROUP BY o."companyId", c.name
      ORDER BY total DESC`;
    const unbilledTotalCents = billable.reduce((sum, row) => sum + Number(row.total), 0);
    const topCompanies = billable.slice(0, 5).map((row) => ({
      companyId: row.companyId,
      companyName: row.companyName,
      count: Number(row.count),
      totalCents: Number(row.total),
    }));

    const unpaid = await this.prisma.invoice.findMany({
      where: { paidAt: null },
      select: { totalCents: true, createdAt: true },
    });
    const unpaidTotalCents = unpaid.reduce((sum, row) => sum + row.totalCents, 0);
    const oldest = unpaid
      .map((row) => dayDiff(today, row.createdAt))
      .reduce((max, age) => Math.max(max, age), -1);

    return {
      byStatus,
      unbilledTotalCents,
      topCompanies,
      unpaidCount: unpaid.length,
      unpaidTotalCents,
      oldestUnpaidAgeDays: oldest < 0 ? null : oldest,
      pricingGapDishes: await this.pricingGapCount(),
    };
  }

  /** Active dishes with no effective price on the default tier. */
  private async pricingGapCount(): Promise<number> {
    const fallback = await this.prisma.priceTier.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });
    if (fallback === null) {
      return 0;
    }
    const { maps } = await this.pricing.loadPriceMaps(fallback.id);
    const dishes = await this.prisma.dish.findMany({
      where: { isActive: true },
      select: { id: true, costCents: true },
    });
    return dishes.filter(
      (dish) => resolveDishPrice({ id: dish.id, costCents: dish.costCents }, fallback.id, maps) === null,
    ).length;
  }
}

/** Whole calendar days from a `YYYY-MM-DD` day back to a timestamp. */
function dayDiff(todayDate: string, createdAt: Date): number {
  const start = Date.UTC(
    Number(todayDate.slice(0, 4)),
    Number(todayDate.slice(5, 7)) - 1,
    Number(todayDate.slice(8, 10)),
  );
  const created = Date.UTC(createdAt.getUTCFullYear(), createdAt.getUTCMonth(), createdAt.getUTCDate());
  return Math.max(0, Math.floor((start - created) / (24 * 60 * 60 * 1000)));
}
