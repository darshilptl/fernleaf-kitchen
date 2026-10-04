import type { DropKeyData } from '@repo/shared';

/**
 * Drop grouping. PDF §4.8 / D-69.
 *
 * A drop is a grouping query over orders on
 * `(companyId, addressId, deliveryDate, deliveryTimeMinute)` —
 * there is no Drop table. Drop status is the least advanced step
 * among members. Pure: takes plain rows, returns plain drops.
 *
 * Algorithm:
 *   1. Bucket rows by the four-part key.
 *   2. Member stage: delivered > out-for-delivery > dispatch-ready
 *      > kitchen-ready > confirmed.
 *   3. Drop status = minimum member stage; member count = bucket size.
 * Invariants: input rows already filtered to displayable statuses.
 * Edge cases: single-order drops; mixed stages show the least step.
 */

export type DropMemberStage =
  | 'CONFIRMED'
  | 'KITCHEN_READY'
  | 'DISPATCH_READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED';

export interface DropRow {
  id: string;
  companyId: string;
  addressId: string;
  deliveryDate: string;
  deliveryTimeMinute: number;
  status: 'CONFIRMED' | 'DELIVERED';
  kitchenReadyAt: string | Date | null;
  dispatchReadyAt: string | Date | null;
  outForDeliveryAt: string | Date | null;
  driverId: string | null;
}

export interface DropGroup {
  key: DropKeyData;
  status: DropMemberStage;
  memberIds: string[];
}

export function memberStage(row: DropRow): DropMemberStage {
  if (row.status === 'DELIVERED') {
    return 'DELIVERED';
  }
  if (row.outForDeliveryAt !== null) {
    return 'OUT_FOR_DELIVERY';
  }
  if (row.dispatchReadyAt !== null) {
    return 'DISPATCH_READY';
  }
  if (row.kitchenReadyAt !== null) {
    return 'KITCHEN_READY';
  }
  return 'CONFIRMED';
}

const STAGE_RANK: Record<DropMemberStage, number> = {
  CONFIRMED: 0,
  KITCHEN_READY: 1,
  DISPATCH_READY: 2,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
};

export function groupIntoDrops(rows: readonly DropRow[]): DropGroup[] {
  const buckets = new Map<string, DropGroup>();
  for (const row of rows) {
    const mapKey = `${row.companyId}|${row.addressId}|${row.deliveryDate}|${row.deliveryTimeMinute}`;
    const stage = memberStage(row);
    const existing = buckets.get(mapKey);
    if (existing === undefined) {
      buckets.set(mapKey, {
        key: {
          companyId: row.companyId,
          addressId: row.addressId,
          deliveryDate: row.deliveryDate,
          deliveryTimeMinute: row.deliveryTimeMinute,
        },
        status: stage,
        memberIds: [row.id],
      });
      continue;
    }
    existing.memberIds.push(row.id);
    if (STAGE_RANK[stage] < STAGE_RANK[existing.status]) {
      existing.status = stage;
    }
  }
  return [...buckets.values()].sort(
    (a, b) => a.key.deliveryTimeMinute - b.key.deliveryTimeMinute,
  );
}
