import type { OrderEventType, OrderStatus } from '@prisma/client';
import { DomainError } from '@repo/shared';

/**
 * Order status changes. PDF §4.6 / skill orders. D-65.
 *
 * The ONLY place that changes `status`. Every transition is a
 * conditional `updateMany` (expected status set, optional
 * version, optional uninvoiced) plus its `OrderEvent` in the
 * same transaction — concurrent runs and double clicks collapse
 * to one winner and one 409.
 *
 * Algorithm:
 *   1. `updateMany` the order to `to` (bumping `version`) where
 *      id, status in `from`, version and uninvoiced match.
 *   2. `count === 0` -> reload: missing -> 404; invoiced when
 *      required -> 409 `ORDER_INVOICED`; else 409 conflict.
 *   3. Insert the event for the updated row only.
 * Invariants: terminal states (DELIVERED, CANCELLED, REJECTED)
 * never appear in `from` of a forward transition.
 * Edge cases: two racers -> exactly one `count === 1`.
 */
export interface TransitionTx {
  order: {
    updateMany(args: unknown): Promise<{ count: number }>;
    findUnique(args: unknown): Promise<{ id: string; invoiceId: string | null } | null>;
  };
  orderEvent: {
    create(args: unknown): Promise<unknown>;
  };
}

export interface TransitionInput {
  orderId: string;
  from: OrderStatus[];
  to: OrderStatus;
  expectedVersion?: number;
  requireUninvoiced?: boolean;
  actorId: string | null;
  event: OrderEventType;
  note?: string;
}

export async function transitionOrder(tx: TransitionTx, input: TransitionInput): Promise<void> {
  const where: Record<string, unknown> = { id: input.orderId, status: { in: input.from } };
  if (input.expectedVersion !== undefined) {
    where.version = input.expectedVersion;
  }
  if (input.requireUninvoiced === true) {
    where.invoiceId = null;
  }
  const updated = await tx.order.updateMany({
    where,
    data: { status: input.to, version: { increment: 1 } },
  });
  if (updated.count === 1) {
    await tx.orderEvent.create({
      data: {
        orderId: input.orderId,
        type: input.event,
        actorId: input.actorId,
        note: input.note ?? null,
      },
    });
    return;
  }
  const current = await tx.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, invoiceId: true },
  });
  if (current === null) {
    throw new DomainError({
      code: 'ORDER_NOT_FOUND',
      message: 'Order not found',
      httpStatus: 404,
    });
  }
  if (input.requireUninvoiced === true && current.invoiceId !== null) {
    throw new DomainError({
      code: 'ORDER_INVOICED',
      message: 'Order is on an invoice and cannot change',
      httpStatus: 409,
    });
  }
  throw new DomainError({
    code: 'ORDER_STATE_CONFLICT',
    message: 'Order changed since it was read',
    httpStatus: 409,
  });
}
