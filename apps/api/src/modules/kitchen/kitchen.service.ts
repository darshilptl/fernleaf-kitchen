import { Injectable, Logger } from '@nestjs/common';
import {
  DomainError,
  getLateness,
  kitchenToday,
  plannedInstants,
  toDbDate,
} from '@repo/shared';
import type { CalendarDate } from '@repo/shared';
import { PrismaService } from '../../database/prisma.service.js';
import { ClockService } from '../../common/clock/clock.service.js';
import { logAction } from '../../common/logging/logging.interceptor.js';

/**
 * Kitchen board and prep-unit transitions. PDF §4.7 / D-61, D-62, D-66..D-68.
 *
 * Board: prep unit = one `OrderLineCombination` of a CONFIRMED order
 * on the date, routed to the dish's CURRENT station else "Unassigned"
 * (D-61). Planned times derive live via shared `plannedInstants`
 * (D-62), never stored. Lateness via shared `getLateness` (D-68).
 *
 * Algorithm (start/done, one transaction each):
 *   1. Lock the parent order row (`SELECT .. FOR UPDATE`); not
 *      CONFIRMED -> 409 `ORDER_NOT_CONFIRMED`; unit must belong to
 *      the order (join), else 404.
 *   2. START: conditional write `startedAt IS NULL`, else 409.
 *      DONE: conditional write `doneAt IS NULL` with
 *      `startedAt = COALESCE(startedAt, now)` (unstarted finish
 *      records a start), else 409.
 *   3. Set `kitchenStartedAt` once; set `kitchenReadyAt` only when
 *      no open unit remains (+ events only on change). The parent
 *      row lock serialises parallel "done" clicks (D-67).
 * Invariants: state lives on the combination row (D-66); order
 * timestamps update in the same transaction (D-67).
 * Edge cases: last-two-units parallel done -> ready set once;
 * force-complete closes every open unit under the same lock.
 */

export interface BoardUnit {
  id: string;
  orderId: string;
  orderNumber: number;
  version: number;
  deliveryTimeMinute: number;
  companyName: string;
  dishName: string;
  stationId: string | null;
  stationName: string | null;
  quantity: number;
  startedAt: Date | null;
  doneAt: Date | null;
  lateness: string;
}

@Injectable()
export class KitchenService {
  private readonly logger = new Logger(KitchenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  async board(query: { date?: string; station?: string }): Promise<{
    date: CalendarDate;
    units: BoardUnit[];
  }> {
    const date = query.date ?? kitchenToday(this.clock.now());
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 1 } });
    const atRiskMinutes = settings?.atRiskMinutes ?? 30;
    const day = toDbDate(date);
    const orders = await this.prisma.order.findMany({
      where: { deliveryDate: day, status: 'CONFIRMED' },
      select: {
        id: true,
        orderNumber: true,
        version: true,
        deliveryTimeMinute: true,
        company: { select: { dispatchLeadMinutes: true, name: true } },
        lines: {
          select: {
            dish: {
              select: {
                name: true,
                station: { select: { id: true, name: true } },
              },
            },
            combinations: {
              select: {
                id: true,
                quantity: true,
                startedAt: true,
                doneAt: true,
              },
              orderBy: { id: 'asc' },
            },
          },
        },
      },
      orderBy: [{ deliveryTimeMinute: 'asc' }, { orderNumber: 'asc' }],
    });
    const now = this.clock.now();
    const units: BoardUnit[] = [];
    for (const order of orders) {
      const plan = plannedInstants(date, order.deliveryTimeMinute, order.company.dispatchLeadMinutes);
      for (const line of order.lines) {
        const stationId = line.dish.station?.id ?? null;
        if (query.station !== undefined && stationId !== query.station) {
          continue;
        }
        for (const unit of line.combinations) {
          units.push({
            id: unit.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            version: order.version,
            deliveryTimeMinute: order.deliveryTimeMinute,
            companyName: order.company.name,
            dishName: line.dish.name,
            stationId,
            stationName: line.dish.station?.name ?? 'Unassigned',
            quantity: unit.quantity,
            startedAt: unit.startedAt,
            doneAt: unit.doneAt,
            lateness: getLateness(now, plan.plannedKitchenReady, atRiskMinutes, unit.doneAt !== null),
          });
        }
      }
    }
    return { date, units };
  }

  async startUnit(unitId: string, actorId: string): Promise<{ id: string }> {
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const owner = await tx.$queryRaw<Array<{ orderId: string }>>`
        SELECT l."orderId" AS "orderId" FROM order_line_combinations c
        JOIN order_lines l ON l.id = c."lineId" WHERE c.id = ${unitId}`;
      const orderId = owner[0]?.orderId;
      if (orderId === undefined) {
        throw new DomainError({ code: 'ORDER_NOT_FOUND', message: 'Prep unit not found', httpStatus: 404 });
      }
      await this.lockConfirmed(tx, orderId);
      const changed = await tx.$executeRaw`
        UPDATE order_line_combinations SET "startedAt" = ${now}
        WHERE id = ${unitId} AND "startedAt" IS NULL`;
      if (changed === 0) {
        throw new DomainError({
          code: 'UNIT_ALREADY_STARTED',
          message: 'Prep unit already started',
          httpStatus: 409,
        });
      }
      await this.touchStarted(tx, orderId, actorId, now);
    });
    logAction(this.logger, 'kitchen.unit.start', { unit: unitId, actor: actorId });
    return { id: unitId };
  }

  async doneUnit(unitId: string, actorId: string): Promise<{ id: string }> {
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const owner = await tx.$queryRaw<Array<{ orderId: string }>>`
        SELECT l."orderId" AS "orderId" FROM order_line_combinations c
        JOIN order_lines l ON l.id = c."lineId" WHERE c.id = ${unitId}`;
      const orderId = owner[0]?.orderId;
      if (orderId === undefined) {
        throw new DomainError({ code: 'ORDER_NOT_FOUND', message: 'Prep unit not found', httpStatus: 404 });
      }
      await this.lockConfirmed(tx, orderId);
      const changed = await tx.$executeRaw`
        UPDATE order_line_combinations
        SET "startedAt" = COALESCE("startedAt", ${now}), "doneAt" = ${now}
        WHERE id = ${unitId} AND "doneAt" IS NULL`;
      if (changed === 0) {
        throw new DomainError({
          code: 'UNIT_ALREADY_DONE',
          message: 'Prep unit already done',
          httpStatus: 409,
        });
      }
      await this.touchStarted(tx, orderId, actorId, now);
      await this.touchReady(tx, orderId, actorId, now);
    });
    logAction(this.logger, 'kitchen.unit.done', { unit: unitId, actor: actorId });
    return { id: unitId };
  }

  async forceComplete(orderId: string, actorId: string, version: number): Promise<{ id: string; version: number }> {
    const now = this.clock.now();
    const next = await this.prisma.$transaction(async (tx) => {
      await this.lockConfirmed(tx, orderId);
      const guarded = await tx.order.updateMany({
        where: { id: orderId, version, status: 'CONFIRMED' },
        data: { version: { increment: 1 } },
      });
      if (guarded.count === 0) {
        throw new DomainError({
          code: 'ORDER_STATE_CONFLICT',
          message: 'Order changed since it was read',
          httpStatus: 409,
        });
      }
      await tx.$executeRaw`
        UPDATE order_line_combinations c SET "startedAt" = COALESCE(c."startedAt", ${now}), "doneAt" = COALESCE(c."doneAt", ${now})
        FROM order_lines l WHERE l.id = c."lineId" AND l."orderId" = ${orderId}`;
      await tx.order.update({
        where: { id: orderId },
        data: { kitchenStartedAt: now, kitchenReadyAt: now },
      });
      await tx.orderEvent.create({
        data: { orderId, type: 'FORCE_COMPLETED', actorId, note: null },
      });
      return version + 1;
    });
    logAction(this.logger, 'kitchen.order.force-complete', { order: orderId, actor: actorId });
    return { id: orderId, version: next };
  }

  private async lockConfirmed(
    tx: { $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T> },
    orderId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM orders WHERE id = ${orderId} FOR UPDATE`;
    const status = rows[0]?.status;
    if (status === undefined) {
      throw new DomainError({ code: 'ORDER_NOT_FOUND', message: 'Order not found', httpStatus: 404 });
    }
    if (status !== 'CONFIRMED') {
      throw new DomainError({
        code: 'ORDER_NOT_CONFIRMED',
        message: 'Only confirmed orders can be worked on',
        httpStatus: 409,
      });
    }
  }

  private async touchStarted(
    tx: {
      $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
      orderEvent: { create(args: unknown): Promise<unknown> };
    },
    orderId: string,
    actorId: string,
    now: Date,
  ): Promise<void> {
    const changed = await tx.$executeRaw`
      UPDATE orders SET "kitchenStartedAt" = ${now}
      WHERE id = ${orderId} AND "kitchenStartedAt" IS NULL`;
    if (changed > 0) {
      await tx.orderEvent.create({
        data: { orderId, type: 'KITCHEN_STARTED', actorId, note: null },
      });
    }
  }

  private async touchReady(
    tx: {
      $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
      orderEvent: { create(args: unknown): Promise<unknown> };
    },
    orderId: string,
    actorId: string,
    now: Date,
  ): Promise<void> {
    const changed = await tx.$executeRaw`
      UPDATE orders SET "kitchenReadyAt" = ${now} WHERE id = ${orderId}
      AND "kitchenReadyAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM order_line_combinations c
        JOIN order_lines l ON l.id = c."lineId"
        WHERE l."orderId" = ${orderId} AND c."doneAt" IS NULL)`;
    if (changed > 0) {
      await tx.orderEvent.create({
        data: { orderId, type: 'KITCHEN_READY', actorId, note: null },
      });
    }
  }
}
