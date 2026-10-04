import { Injectable, Logger } from '@nestjs/common';
import { DomainError, kitchenToday, plannedInstants, toDbDate } from '@repo/shared';
import type { CalendarDate, DropKeyData } from '@repo/shared';
import { PrismaService } from '../../database/prisma.service.js';
import { ClockService } from '../../common/clock/clock.service.js';
import { logAction } from '../../common/logging/logging.interceptor.js';
import { groupIntoDrops } from './domain/group-drops.js';
import { transitionOrder } from '../orders/domain/order-state-machine.js';

/**
 * Dispatch drops and the driver view. PDF §4.8 / D-69..D-73.
 *
 * Drops are a grouping query (no table). Every dispatch/driver
 * write locks its members ordered by id (`FOR UPDATE`) inside one
 * transaction per drop (deadlock-safe); events insert per updated
 * member only. Ownership is enforced inside the query: a foreign
 * drop reads as zero rows -> 404 (D-03).
 *
 * Algorithm (dispatch steps):
 *   1. Lock members for the drop key (CONFIRMED for dispatch
 *      steps, CONFIRMED + own driver for delivery).
 *   2. Pending = step timestamp null; none pending -> 409
 *      `DROP_STEP_ALREADY_DONE`.
 *   3. Every pending member needs its prerequisite (kitchenReady
 *      for dispatch-ready; dispatchReady + driver for out;
 *      out-for-delivery for delivered), else 409
 *      `DROP_PREVIOUS_STEP_MISSING`.
 *   4. Stamp pending members, insert events. Assign is blocked once
 *      any member is out (`DROP_ALREADY_OUT`); the driver must be
 *      active and hold `deliveries.assignable` (D-75).
 * Invariants: on-time = `deliveredAt <= scheduled`, no grace (D-71);
 * delivery moves status CONFIRMED -> DELIVERED via transitionOrder.
 * Edge cases: mixed-stage drops advance pending members only.
 */

interface DropMember {
  id: string;
  companyId: string;
  addressId: string;
  deliveryTimeMinute: number;
  kitchenReadyAt: Date | null;
  dispatchReadyAt: Date | null;
  outForDeliveryAt: Date | null;
  driverId: string | null;
}

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  async listDrops(dateInput?: string): Promise<unknown> {
    const date = dateInput ?? kitchenToday(this.clock.now());
    const rows = await this.loadDateRows(toDbDate(date));
    return { date, drops: this.shapeDrops(date, rows) };
  }

  async assignDriver(key: DropKeyData, driverId: string, actorId: string): Promise<{ updated: number }> {
    const driver = await this.prisma.staffUser.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        isActive: true,
        role: { select: { permissions: { select: { permission: true } } } },
      },
    });
    const assignable = driver?.role.permissions.some((row) => row.permission === 'deliveries.assignable') ?? false;
    if (driver === null || !driver.isActive || !assignable) {
      throw new DomainError({
        code: 'DRIVER_INELIGIBLE',
        message: 'Driver must be active and assignable',
        httpStatus: 409,
      });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const members = await this.lockDropMembers(tx, key);
      if (members.some((row) => row.outForDeliveryAt !== null)) {
        throw new DomainError({
          code: 'DROP_ALREADY_OUT',
          message: 'Drop is already out for delivery',
          httpStatus: 409,
        });
      }
      await tx.order.updateMany({
        where: { id: { in: members.map((row) => row.id) } },
        data: { driverId },
      });
      return members.length;
    });
    logAction(this.logger, 'dispatch.drop.assign', { driver: driverId, actor: actorId, updated });
    return { updated };
  }

  async markDispatchReady(key: DropKeyData, actorId: string): Promise<{ updated: number }> {
    const now = this.clock.now();
    const updated = await this.prisma.$transaction(async (tx) => {
      const members = await this.lockDropMembers(tx, key);
      const pending = members.filter((row) => row.dispatchReadyAt === null);
      if (pending.length === 0) {
        throw new DomainError({
          code: 'DROP_STEP_ALREADY_DONE',
          message: 'Drop is already dispatch ready',
          httpStatus: 409,
        });
      }
      if (pending.some((row) => row.kitchenReadyAt === null)) {
        throw new DomainError({
          code: 'DROP_PREVIOUS_STEP_MISSING',
          message: 'Every order needs kitchen ready first',
          httpStatus: 409,
        });
      }
      await tx.order.updateMany({
        where: { id: { in: pending.map((row) => row.id) } },
        data: { dispatchReadyAt: now },
      });
      for (const row of pending) {
        await tx.orderEvent.create({
          data: { orderId: row.id, type: 'DISPATCH_READY', actorId, note: null },
        });
      }
      return pending.length;
    });
    logAction(this.logger, 'dispatch.drop.dispatch-ready', { actor: actorId, updated });
    return { updated };
  }

  async markOutForDelivery(key: DropKeyData, actorId: string): Promise<{ updated: number }> {
    const now = this.clock.now();
    const updated = await this.prisma.$transaction(async (tx) => {
      const members = await this.lockDropMembers(tx, key);
      const pending = members.filter((row) => row.outForDeliveryAt === null);
      if (pending.length === 0) {
        throw new DomainError({
          code: 'DROP_STEP_ALREADY_DONE',
          message: 'Drop is already out for delivery',
          httpStatus: 409,
        });
      }
      if (pending.some((row) => row.dispatchReadyAt === null || row.driverId === null)) {
        throw new DomainError({
          code: 'DROP_PREVIOUS_STEP_MISSING',
          message: 'Every order needs dispatch ready and a driver first',
          httpStatus: 409,
        });
      }
      await tx.order.updateMany({
        where: { id: { in: pending.map((row) => row.id) } },
        data: { outForDeliveryAt: now },
      });
      for (const row of pending) {
        await tx.orderEvent.create({
          data: { orderId: row.id, type: 'OUT_FOR_DELIVERY', actorId, note: null },
        });
      }
      return pending.length;
    });
    logAction(this.logger, 'dispatch.drop.out-for-delivery', { actor: actorId, updated });
    return { updated };
  }

  async listOwnDrops(driverId: string): Promise<unknown> {
    const date = kitchenToday(this.clock.now());
    const orders = await this.prisma.order.findMany({
      where: { driverId, deliveryDate: toDbDate(date), status: { in: ['CONFIRMED', 'DELIVERED'] } },
      select: {
        id: true,
        status: true,
        companyId: true,
        addressId: true,
        deliveryTimeMinute: true,
        kitchenReadyAt: true,
        dispatchReadyAt: true,
        outForDeliveryAt: true,
        driverId: true,
        company: { select: { name: true } },
        address: { select: { label: true, line1: true, city: true } },
      },
      orderBy: [{ deliveryTimeMinute: 'asc' }, { id: 'asc' }],
    });
    return {
      date,
      drops: groupIntoDrops(
        orders.map((row) => ({
          ...row,
          deliveryDate: date,
          status: row.status as 'CONFIRMED' | 'DELIVERED',
        })),
      ).map((drop) => ({
        ...drop,
        members: drop.memberIds.map((id) => orders.find((row) => row.id === id)),
      })),
    };
  }

  async markDelivered(
    key: DropKeyData,
    driverId: string,
    note: string | undefined,
    photoUrl: string | undefined,
  ): Promise<{ updated: number }> {
    const now = this.clock.now();
    const updated = await this.prisma.$transaction(async (tx) => {
      const day = toDbDate(key.deliveryDate);
      const locked = await tx.$queryRaw<DropMember[]>`
        SELECT id, "companyId", "addressId", "deliveryTimeMinute",
          "kitchenReadyAt", "dispatchReadyAt", "outForDeliveryAt", "driverId"
        FROM orders
        WHERE "companyId" = ${key.companyId} AND "addressId" = ${key.addressId}
          AND "deliveryDate" = ${day} AND "deliveryTimeMinute" = ${key.deliveryTimeMinute}
          AND "driverId" = ${driverId} AND status = 'CONFIRMED'
        ORDER BY id FOR UPDATE`;
      if (locked.length === 0) {
        throw new DomainError({
          code: 'DROP_NOT_FOUND',
          message: 'Drop not found',
          httpStatus: 404,
        });
      }
      const pending = locked.filter((row) => row.outForDeliveryAt !== null);
      if (pending.length === 0) {
        throw new DomainError({
          code: 'DROP_PREVIOUS_STEP_MISSING',
          message: 'Drop must be out for delivery first',
          httpStatus: 409,
        });
      }
      const dispatchLead = await tx.company.findUnique({
        where: { id: key.companyId },
        select: { dispatchLeadMinutes: true },
      });
      const lead = dispatchLead?.dispatchLeadMinutes ?? 60;
      for (const row of pending) {
        const plan = plannedInstants(key.deliveryDate, row.deliveryTimeMinute, lead);
        const onTime = now.getTime() <= plan.scheduledInstant.getTime();
        await tx.order.update({
          where: { id: row.id },
          data: {
            deliveredAt: now,
            deliveryNote: note ?? null,
            deliveryPhotoUrl: photoUrl ?? null,
            deliveredOnTime: onTime,
          },
        });
        await transitionOrder(tx, {
          orderId: row.id,
          from: ['CONFIRMED'],
          to: 'DELIVERED',
          actorId: driverId,
          event: 'DELIVERED',
          note: note ?? undefined,
        });
      }
      return pending.length;
    });
    logAction(this.logger, 'driver.drop.delivered', { driver: driverId, updated });
    return { updated };
  }

  private async lockDropMembers(
    tx: { $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T> },
    key: DropKeyData,
  ): Promise<DropMember[]> {
    const day = toDbDate(key.deliveryDate);
    const rows = await tx.$queryRaw<DropMember[]>`
      SELECT id, "companyId", "addressId", "deliveryTimeMinute",
        "kitchenReadyAt", "dispatchReadyAt", "outForDeliveryAt", "driverId"
      FROM orders
      WHERE "companyId" = ${key.companyId} AND "addressId" = ${key.addressId}
        AND "deliveryDate" = ${day} AND "deliveryTimeMinute" = ${key.deliveryTimeMinute}
        AND status = 'CONFIRMED'
      ORDER BY id FOR UPDATE`;
    if (rows.length === 0) {
      throw new DomainError({ code: 'DROP_NOT_FOUND', message: 'Drop not found', httpStatus: 404 });
    }
    return rows;
  }

  private async loadDateRows(day: Date): Promise<
    Array<{
      id: string;
      status: 'CONFIRMED' | 'DELIVERED';
      companyId: string;
      addressId: string;
      deliveryTimeMinute: number;
      kitchenReadyAt: Date | null;
      dispatchReadyAt: Date | null;
      outForDeliveryAt: Date | null;
      driverId: string | null;
      company: { name: string; defaultDriverId: string | null };
      address: { label: string; line1: string; city: string };
      driver: { id: string; name: string } | null;
    }>
  > {
    const found = await this.prisma.order.findMany({
      where: { deliveryDate: day, status: { in: ['CONFIRMED', 'DELIVERED'] } },
      select: {
        id: true,
        status: true,
        companyId: true,
        addressId: true,
        deliveryTimeMinute: true,
        kitchenReadyAt: true,
        dispatchReadyAt: true,
        outForDeliveryAt: true,
        driverId: true,
        company: { select: { name: true, defaultDriverId: true } },
        address: { select: { label: true, line1: true, city: true } },
        driver: { select: { id: true, name: true } },
      },
      orderBy: [{ deliveryTimeMinute: 'asc' }, { id: 'asc' }],
    });
    return found as Array<{
      id: string;
      status: 'CONFIRMED' | 'DELIVERED';
      companyId: string;
      addressId: string;
      deliveryTimeMinute: number;
      kitchenReadyAt: Date | null;
      dispatchReadyAt: Date | null;
      outForDeliveryAt: Date | null;
      driverId: string | null;
      company: { name: string; defaultDriverId: string | null };
      address: { label: string; line1: string; city: string };
      driver: { id: string; name: string } | null;
    }>;
  }

  private shapeDrops(
    date: CalendarDate,
    rows: Array<{
      id: string;
      status: 'CONFIRMED' | 'DELIVERED';
      companyId: string;
      addressId: string;
      deliveryTimeMinute: number;
      kitchenReadyAt: Date | null;
      dispatchReadyAt: Date | null;
      outForDeliveryAt: Date | null;
      driverId: string | null;
    }>,
  ): unknown[] {
    const byId = new Map(rows.map((row) => [row.id, row]));
    return groupIntoDrops(rows.map((row) => ({ ...row, deliveryDate: date }))).map((drop) => ({
      ...drop,
      members: drop.memberIds.map((id) => byId.get(id)),
    }));
  }
}
