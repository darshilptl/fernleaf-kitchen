import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DomainError,
  cutoffInstant,
  fromDbDate,
  isLocked,
  toDbDate,
} from '@repo/shared';
import type {
  CalendarDate,
  CreateOrderInput,
  OrderLineInput,
  OrderListQueryData,
  OverrideDetailsInput,
  RejectOrderInput,
  UpdateOrderInput,
} from '@repo/shared';
import { resolveDishPrice, resolveOptionPrice } from '../pricing/domain/resolve-price.js';
import { resolveMenu } from '../menu/domain/menu-resolver.js';
import type { MenuDishInput } from '../menu/domain/menu-resolver.js';
import { PricingService } from '../pricing/pricing.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { ClockService } from '../../common/clock/clock.service.js';
import { logAction } from '../../common/logging/logging.interceptor.js';
import { transitionOrder } from './domain/order-state-machine.js';
import { validateOrderDraft } from './domain/validate-order-draft.js';
import type {
  DraftCatalogDish,
  DraftContext as DraftValidationCtx,
  PricedOrder,
} from './domain/validate-order-draft.js';

/**
 * Orders: drafts, placing, overrides, listing, cut-off.
 * PDF §4.6. The ONLY writer of orders/lines/events (G4 kitchen
 * and dispatch steps arrive through `transitionOrder` too).
 *
 * The client sends choices and quantities ONLY: names and prices
 * resolve server-side and snapshot on every save (D-51). Status
 * changes go through `transitionOrder`; availability through
 * `resolveMenu` (union over secret slugs, D-35); arithmetic
 * through the shared totals. Viewing never reprices.
 */

interface LoadedDishOption {
  id: string;
  name: string;
  isActive: boolean;
  costCents: number;
  sizeIds: string[];
}

interface LoadedDishGroup {
  id: string;
  name: string;
  isRequired: boolean;
  sortOrder: number;
  usesPortions: boolean;
  options: LoadedDishOption[];
  sizes: Array<{ id: string; name: string; extraCents: number }>;
}

interface LoadedDish {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  temperature: string;
  minOrderQuantity: number | null;
  costCents: number;
  placements: Array<{
    itemId: string;
    itemSortOrder: number;
    itemIsActive: boolean;
    categoryId: string;
    categoryName: string;
    categorySlug: string;
    categorySortOrder: number;
    categoryIsActive: boolean;
    categoryIsSecret: boolean;
  }>;
  groups: LoadedDishGroup[];
}

interface StoredChoice {
  optionId: string;
  portionSizeName: string | null;
}

interface StoredLine {
  dishId: string;
  combinations: Array<{ quantity: number; choices: StoredChoice[] }>;
}
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly clock: ClockService,
  ) {}

  async createOrder(actorId: string, input: CreateOrderInput): Promise<{ id: string; orderNumber: number }> {
    const party = await this.loadParty(input.employeeId);
    const priced = await this.priceLines(input.employeeId, input.deliveryDate, input.lines ?? [], {
      details: input.details ?? {
        addressId: party.defaultAddressId,
        deliveryTimeMinute: party.defaultDeliveryMinute,
        packagingTypeId: party.defaultPackagingTypeId,
      },
      requireLines: false,
    });
    const details = input.details ?? {
      addressId: party.defaultAddressId,
      deliveryTimeMinute: party.defaultDeliveryMinute,
      packagingTypeId: party.defaultPackagingTypeId,
    };
    const created = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          employeeId: input.employeeId,
          companyId: party.companyId,
          createdById: actorId,
          deliveryDate: toDbDate(input.deliveryDate),
          deliveryTimeMinute: details.deliveryTimeMinute,
          addressId: details.addressId,
          packagingTypeId: details.packagingTypeId,
          totalCents: priced.totalCents,
        },
        select: { id: true, orderNumber: true },
      });
      await this.writeLines(tx, order.id, priced);
      await tx.orderEvent.create({
        data: { orderId: order.id, type: 'CREATED', actorId, note: null },
      });
      return order;
    });
    logAction(this.logger, 'order.create', { orderId: created.id });
    return created;
  }

  async updateOrder(id: string, actorId: string, input: UpdateOrderInput): Promise<{ id: string; version: number }> {
    const order = await this.requireEditable(id, input.version);
    const details = input.details ?? {
      addressId: order.addressId,
      deliveryTimeMinute: order.deliveryTimeMinute,
      packagingTypeId: order.packagingTypeId,
    };
    const prepared = await this.prepareValidation(order.employeeId, fromDbDate(order.deliveryDate), {
      details,
      expectedCompanyId: order.companyId,
    });
    const incoming =
      input.lines ?? this.storedToInput(await this.readLines(id), prepared.catalog);
    const priced = validateOrderDraft(incoming, prepared.catalog, prepared.ctx, {
      requireLines: false,
    });
    const version = await this.prisma.$transaction(async (tx) => {
      const guarded = await tx.order.updateMany({
        where: { id, version: input.version, status: { in: ['DRAFT', 'PLACED'] } },
        data: {
          version: { increment: 1 },
          deliveryTimeMinute: details.deliveryTimeMinute,
          addressId: details.addressId,
          packagingTypeId: details.packagingTypeId,
          totalCents: priced.totalCents,
        },
      });
      if (guarded.count === 0) {
        throw new DomainError({
          code: 'ORDER_STATE_CONFLICT',
          message: 'Order changed since it was read',
          httpStatus: 409,
        });
      }
      await tx.orderLine.deleteMany({ where: { orderId: id } });
      await this.writeLines(tx, id, priced);
      await tx.orderEvent.create({
        data: { orderId: id, type: 'EDITED', actorId, note: null },
      });
      return input.version + 1;
    });
    logAction(this.logger, 'order.edit', { orderId: id });
    return { id, version };
  }

  async placeOrder(id: string, actorId: string, version: number): Promise<{ id: string; version: number }> {
    const order = await this.requireEditable(id, version);
    const prepared = await this.prepareValidation(
      order.employeeId,
      fromDbDate(order.deliveryDate),
      {
        details: {
          addressId: order.addressId,
          deliveryTimeMinute: order.deliveryTimeMinute,
          packagingTypeId: order.packagingTypeId,
        },
        expectedCompanyId: order.companyId,
      },
    );
    const stored = await this.readLines(id);
    const priced = validateOrderDraft(
      this.storedToInput(stored, prepared.catalog),
      prepared.catalog,
      prepared.ctx,
      { requireLines: true },
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.orderLine.deleteMany({ where: { orderId: id } });
      await this.writeLines(tx, id, priced);
      await tx.order.update({
        where: { id },
        data: { totalCents: priced.totalCents },
      });
      await transitionOrder(tx, {
        orderId: id,
        from: ['DRAFT'],
        to: 'PLACED',
        expectedVersion: version,
        actorId,
        event: 'PLACED',
      });
    });
    logAction(this.logger, 'order.place', { orderId: id });
    return { id, version: version + 1 };
  }

  async cancelOrder(
    id: string,
    actorId: string,
    version: number,
    allowLocked: boolean,
  ): Promise<{ id: string }> {
    const order = await this.requireOrder(id);
    if (order.status !== 'DRAFT' && order.status !== 'PLACED' && order.status !== 'CONFIRMED') {
      throw new DomainError({
        code: 'ORDER_STATE_CONFLICT',
        message: `Order cannot be cancelled from ${order.status}`,
        httpStatus: 409,
      });
    }
    if (order.version !== version) {
      throw new DomainError({
        code: 'ORDER_STATE_CONFLICT',
        message: 'Order changed since it was read',
        httpStatus: 409,
      });
    }
    if (!allowLocked) {
      await this.assertUnlocked(fromDbDate(order.deliveryDate));
      if (order.status === 'CONFIRMED') {
        throw new DomainError({
          code: 'ORDER_STATE_CONFLICT',
          message: 'Confirmed orders need an override to cancel',
          httpStatus: 409,
        });
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await transitionOrder(tx, {
        orderId: id,
        from: ['DRAFT', 'PLACED', 'CONFIRMED'],
        to: 'CANCELLED',
        expectedVersion: version,
        requireUninvoiced: true,
        actorId,
        event: 'CANCELLED',
      });
    });
    logAction(this.logger, 'order.cancel', { orderId: id });
    return { id };
  }

  async rejectOrder(id: string, actorId: string, input: RejectOrderInput): Promise<{ id: string }> {
    const order = await this.requireOrder(id);
    if (order.status !== 'PLACED' && order.status !== 'CONFIRMED') {
      throw new DomainError({
        code: 'ORDER_STATE_CONFLICT',
        message: `Order cannot be rejected from ${order.status}`,
        httpStatus: 409,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await transitionOrder(tx, {
        orderId: id,
        from: ['PLACED', 'CONFIRMED'],
        to: 'REJECTED',
        expectedVersion: input.version,
        requireUninvoiced: true,
        actorId,
        event: 'REJECTED',
        note: input.reason,
      });
    });
    logAction(this.logger, 'order.reject', { orderId: id });
    return { id };
  }

  async overrideDetails(
    id: string,
    actorId: string,
    input: OverrideDetailsInput,
  ): Promise<{ id: string; version: number }> {
    const order = await this.requireOrder(id);
    if (order.status !== 'PLACED' && order.status !== 'CONFIRMED') {
      throw new DomainError({
        code: 'ORDER_STATE_CONFLICT',
        message: `Details cannot change from ${order.status}`,
        httpStatus: 409,
      });
    }
    if (order.version !== input.version) {
      throw new DomainError({
        code: 'ORDER_STATE_CONFLICT',
        message: 'Order changed since it was read',
        httpStatus: 409,
      });
    }
    const touchesSchedule =
      (input.addressId !== undefined && input.addressId !== order.addressId) ||
      (input.deliveryTimeMinute !== undefined && input.deliveryTimeMinute !== order.deliveryTimeMinute);
    const touchesPackaging =
      input.packagingTypeId !== undefined && input.packagingTypeId !== order.packagingTypeId;
    if (!touchesSchedule && !touchesPackaging) {
      return { id, version: order.version };
    }
    if (touchesSchedule && order.dispatchReadyAt !== null) {
      throw new DomainError({
        code: 'ORDER_STATE_CONFLICT',
        message: 'Time and address are frozen once dispatch is ready',
        httpStatus: 409,
      });
    }
    if (touchesPackaging && order.outForDeliveryAt !== null) {
      throw new DomainError({
        code: 'ORDER_STATE_CONFLICT',
        message: 'Packaging is frozen once out for delivery',
        httpStatus: 409,
      });
    }
    if (input.addressId !== undefined) {
      const address = await this.prisma.companyAddress.findUnique({
        where: { id: input.addressId },
        select: { companyId: true, isActive: true },
      });
      if (address === null || address.companyId !== order.companyId || !address.isActive) {
        throw new DomainError({
          code: 'VALIDATION_ERROR',
          path: 'addressId',
          message: 'Address must be an active address of the company',
          httpStatus: 400,
        });
      }
    }
    if (input.packagingTypeId !== undefined) {
      const packaging = await this.prisma.packagingType.findUnique({
        where: { id: input.packagingTypeId },
        select: { isActive: true },
      });
      if (packaging === null || !packaging.isActive) {
        throw new DomainError({
          code: 'VALIDATION_ERROR',
          path: 'packagingTypeId',
          message: 'Packaging must be active',
          httpStatus: 400,
        });
      }
    }
    const notes: string[] = [];
    if (input.deliveryTimeMinute !== undefined && input.deliveryTimeMinute !== order.deliveryTimeMinute) {
      notes.push(`Time ${formatMinute(order.deliveryTimeMinute)} -> ${formatMinute(input.deliveryTimeMinute)}`);
    }
    if (input.addressId !== undefined && input.addressId !== order.addressId) {
      notes.push('Address changed');
    }
    if (touchesPackaging) {
      notes.push('Packaging changed');
    }
    const version = await this.prisma.$transaction(async (tx) => {
      const guarded = await tx.order.updateMany({
        where: { id, version: input.version, status: { in: ['PLACED', 'CONFIRMED'] } },
        data: {
          version: { increment: 1 },
          ...(input.addressId !== undefined ? { addressId: input.addressId } : {}),
          ...(input.deliveryTimeMinute !== undefined
            ? { deliveryTimeMinute: input.deliveryTimeMinute }
            : {}),
          ...(input.packagingTypeId !== undefined ? { packagingTypeId: input.packagingTypeId } : {}),
          ...(touchesSchedule ? { driverId: null } : {}),
        },
      });
      if (guarded.count === 0) {
        throw new DomainError({
          code: 'ORDER_STATE_CONFLICT',
          message: 'Order changed since it was read',
          httpStatus: 409,
        });
      }
      await tx.orderEvent.create({
        data: { orderId: id, type: 'DETAILS_OVERRIDDEN', actorId, note: notes.join('; ') },
      });
      return input.version + 1;
    });
    logAction(this.logger, 'order.override-details', { orderId: id });
    return { id, version };
  }

  async listOrders(query: OrderListQueryData): Promise<{
    items: unknown[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    const page = query.page;
    const pageSize = query.pageSize;
    const search = query.search;
    const invoiced = query.invoiced;
    const where: Prisma.OrderWhereInput = {
      ...(query.from !== undefined || query.to !== undefined
        ? {
            deliveryDate: {
              ...(query.from !== undefined ? { gte: toDbDate(query.from) } : {}),
              ...(query.to !== undefined ? { lte: toDbDate(query.to) } : {}),
            },
          }
        : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.companyId !== undefined ? { companyId: query.companyId } : {}),
      ...(invoiced !== undefined ? (invoiced ? { invoiceId: { not: null } } : { invoiceId: null }) : {}),
      ...(search !== ''
        ? {
            OR: [
              ...(Number.isInteger(Number(search)) ? [{ orderNumber: Number(search) }] : []),
              { employee: { name: { contains: search, mode: 'insensitive' } } },
              { employee: { email: { contains: search, mode: 'insensitive' } } },
              { company: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          version: true,
          deliveryDate: true,
          deliveryTimeMinute: true,
          totalCents: true,
          invoiceId: true,
          employee: { select: { id: true, name: true, email: true } },
          company: { select: { id: true, name: true } },
        },
        orderBy: [{ deliveryDate: 'desc' }, { orderNumber: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: items.map((row) => ({ ...row, deliveryDate: fromDbDate(row.deliveryDate) })),
      page,
      pageSize,
      total,
    };
  }

  async getOrder(id: string): Promise<unknown> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, name: true } },
        address: {
          select: { id: true, label: true, line1: true, city: true, postalCode: true, country: true },
        },
        packagingType: { select: { id: true, name: true } },
        lines: {
          orderBy: { sortOrder: 'asc' },
          include: {
            combinations: {
              include: { choices: true },
            },
          },
        },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (order === null) {
      throw new DomainError({ code: 'ORDER_NOT_FOUND', message: 'Order not found', httpStatus: 404 });
    }
    return { ...order, deliveryDate: fromDbDate(order.deliveryDate) };
  }

  /**
   * Cut-off processing for every past-cut-off date holding open
   * orders. Idempotent: only Draft/Placed rows move, and events
   * insert only for rows the UPDATE actually changed (RETURNING),
   * so parallel runs cannot duplicate anything.
   */
  async runCutoff(now: Date): Promise<{ processedDates: CalendarDate[]; cancelled: number; confirmed: number }> {
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 1 } });
    if (settings === null) {
      throw new Error('Platform settings row is missing (id = 1)');
    }
    const holidays = (
      await this.prisma.kitchenHoliday.findMany({ select: { date: true } })
    ).map((row) => fromDbDate(row.date));
    const cutoffSettings = {
      kitchenWorkingDays: settings.kitchenWorkingDays,
      cutoffTimeMinute: settings.cutoffTimeMinute,
      cutoffWorkingDays: settings.cutoffWorkingDays,
    };
    const open = await this.prisma.order.findMany({
      where: { status: { in: ['DRAFT', 'PLACED'] } },
      select: { deliveryDate: true },
      distinct: ['deliveryDate'],
    });
    const processedDates: CalendarDate[] = [];
    let cancelled = 0;
    let confirmed = 0;
    for (const row of open) {
      const date = fromDbDate(row.deliveryDate);
      if (now.getTime() < cutoffInstant(date, cutoffSettings, holidays).getTime()) {
        continue;
      }
      const day = toDbDate(date);
      const result = await this.prisma.$transaction(async (tx) => {
        const cancelledIds = await tx.$queryRaw<Array<{ id: string }>>`
          WITH changed AS (
            UPDATE orders SET status = 'CANCELLED', version = version + 1, "updatedAt" = now()
            WHERE "deliveryDate" = ${day} AND status = 'DRAFT' RETURNING id)
          INSERT INTO order_events (id, "orderId", type, "actorId", note, "createdAt")
          SELECT gen_random_uuid(), id, 'CANCELLED'::"OrderEventType", NULL, 'Cut-off passed', now() FROM changed
          RETURNING "orderId" AS id`;
        const confirmedIds = await tx.$queryRaw<Array<{ id: string }>>`
          WITH changed AS (
            UPDATE orders SET status = 'CONFIRMED', version = version + 1, "updatedAt" = now()
            WHERE "deliveryDate" = ${day} AND status = 'PLACED' RETURNING id)
          INSERT INTO order_events (id, "orderId", type, "actorId", note, "createdAt")
          SELECT gen_random_uuid(), id, 'CONFIRMED'::"OrderEventType", NULL, 'Cut-off passed', now() FROM changed
          RETURNING "orderId" AS id`;
        return { cancelled: cancelledIds.length, confirmed: confirmedIds.length };
      });
      processedDates.push(date);
      cancelled += result.cancelled;
      confirmed += result.confirmed;
    }
    if (processedDates.length > 0) {
      logAction(this.logger, 'order.cutoff-run', {
        dates: processedDates.length,
        cancelled,
        confirmed,
      });
    }
    return { processedDates, cancelled, confirmed };
  }

  private async requireOrder(id: string): Promise<{
    id: string;
    status: 'DRAFT' | 'PLACED' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED' | 'REJECTED';
    version: number;
    employeeId: string;
    companyId: string;
    deliveryDate: Date;
    deliveryTimeMinute: number;
    addressId: string;
    packagingTypeId: string;
    dispatchReadyAt: Date | null;
    outForDeliveryAt: Date | null;
  }> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        version: true,
        employeeId: true,
        companyId: true,
        deliveryDate: true,
        deliveryTimeMinute: true,
        addressId: true,
        packagingTypeId: true,
        dispatchReadyAt: true,
        outForDeliveryAt: true,
      },
    });
    if (order === null) {
      throw new DomainError({ code: 'ORDER_NOT_FOUND', message: 'Order not found', httpStatus: 404 });
    }
    return order;
  }

  private async requireEditable(
    id: string,
    version: number,
  ): Promise<{ employeeId: string; companyId: string; deliveryDate: Date; addressId: string; deliveryTimeMinute: number; packagingTypeId: string }> {
    const order = await this.requireOrder(id);
    if (order.status !== 'DRAFT' && order.status !== 'PLACED') {
      throw new DomainError({
        code: 'ORDER_STATE_CONFLICT',
        message: `Order cannot change from ${order.status}`,
        httpStatus: 409,
      });
    }
    if (order.version !== version) {
      throw new DomainError({
        code: 'ORDER_STATE_CONFLICT',
        message: 'Order changed since it was read',
        httpStatus: 409,
      });
    }
    await this.assertUnlocked(fromDbDate(order.deliveryDate));
    return order;
  }

  private async assertUnlocked(deliveryDate: CalendarDate): Promise<void> {
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 1 } });
    if (settings === null) {
      throw new Error('Platform settings row is missing (id = 1)');
    }
    const holidays = (
      await this.prisma.kitchenHoliday.findMany({ select: { date: true } })
    ).map((row) => fromDbDate(row.date));
    if (
      isLocked(deliveryDate, this.clock.now(), {
        kitchenWorkingDays: settings.kitchenWorkingDays,
        cutoffTimeMinute: settings.cutoffTimeMinute,
        cutoffWorkingDays: settings.cutoffWorkingDays,
      }, holidays)
    ) {
      throw new DomainError({
        code: 'ORDER_LOCKED',
        path: 'deliveryDate',
        message: 'The cut-off for this delivery date has passed',
        httpStatus: 409,
      });
    }
  }

  private async loadParty(employeeId: string): Promise<{
    companyId: string;
    defaultAddressId: string;
    defaultDeliveryMinute: number;
    defaultPackagingTypeId: string;
  }> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true },
    });
    if (employee === null) {
      throw new DomainError({
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Employee not found',
        httpStatus: 404,
      });
    }
    const company = await this.prisma.company.findUnique({
      where: { id: employee.companyId },
      select: {
        id: true,
        defaultDeliveryMinute: true,
        defaultPackagingTypeId: true,
        addresses: { where: { isActive: true }, select: { id: true, isDefault: true } },
      },
    });
    if (company === null) {
      throw new DomainError({
        code: 'COMPANY_NOT_FOUND',
        message: 'Company not found',
        httpStatus: 404,
      });
    }
    const fallback = company.addresses[0];
    const preferred = company.addresses.find((row) => row.isDefault) ?? fallback;
    if (preferred === undefined) {
      throw new DomainError({
        code: 'VALIDATION_ERROR',
        path: 'details.addressId',
        message: 'The company has no active address',
        httpStatus: 400,
      });
    }
    return {
      companyId: company.id,
      defaultAddressId: preferred.id,
      defaultDeliveryMinute: company.defaultDeliveryMinute,
      defaultPackagingTypeId: company.defaultPackagingTypeId,
    };
  }

  /**
   * Price and validate lines for an employee and date. Availability
   * is the `resolveMenu` union over the listing plus every secret
   * slug (D-35: orderability never depends on opening a secret
   * link); prices resolve per tier through the pricing domain.
   */
  private async priceLines(
    employeeId: string,
    deliveryDate: CalendarDate,
    lines: readonly OrderLineInput[],
    options: {
      details: { addressId: string; deliveryTimeMinute: number; packagingTypeId: string };
      requireLines: boolean;
      expectedCompanyId?: string;
    },
  ): Promise<PricedOrder> {
    const prepared = await this.prepareValidation(employeeId, deliveryDate, options);
    return validateOrderDraft(lines, prepared.catalog, prepared.ctx, {
      requireLines: options.requireLines,
    });
  }

  /**
   * Stored lines keep the portion size NAME snapshot (the schema
   * has no size id column); map it back to an id through the
   * catalog so re-validation on place sees the same input shape
   * as creation. Unknown names become null and fail loudly.
   */
  private storedToInput(
    stored: readonly StoredLine[],
    catalog: ReadonlyMap<string, DraftCatalogDish>,
  ): OrderLineInput[] {
    return stored.map((line) => {
      const dish = catalog.get(line.dishId);
      return {
        dishId: line.dishId,
        combinations: line.combinations.map((combination) => ({
          quantity: combination.quantity,
          choices: combination.choices.map((choice) => {
            if (choice.portionSizeName === null) {
              return { optionId: choice.optionId, portionSizeId: null };
            }
            const group = dish?.groups.find((row) =>
              row.options.some((option) => option.id === choice.optionId),
            );
            const size = group?.sizes.find((row) => row.name === choice.portionSizeName);
            return { optionId: choice.optionId, portionSizeId: size?.id ?? null };
          }),
        })),
      };
    });
  }
  /**
   * Assemble the validation context: employee, company, settings,
   * holidays, tier prices and the orderable-dish catalog.
   * Availability is the `resolveMenu` union over the listing plus
   * every secret slug (D-35: orderability never depends on opening
   * a secret link); prices resolve per tier through pricing domain.
   */
  private async prepareValidation(
    employeeId: string,
    deliveryDate: CalendarDate,
    options: {
      details: { addressId: string; deliveryTimeMinute: number; packagingTypeId: string };
      expectedCompanyId?: string;
    },
  ): Promise<{ catalog: Map<string, DraftCatalogDish>; ctx: DraftValidationCtx }> {
    const now = this.clock.now();
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        isActive: true,
        companyId: true,
        canChooseAddress: true,
        canChangeDeliveryTime: true,
        canChangePackaging: true,
        company: {
          select: {
            id: true,
            isActive: true,
            workingDays: true,
            defaultDeliveryMinute: true,
            defaultPackagingTypeId: true,
            priceTierId: true,
            addresses: { select: { id: true, isDefault: true, isActive: true } },
            holidays: { select: { date: true } },
            hiddenCategories: { select: { categoryId: true } },
            hiddenItems: { select: { menuItemId: true } },
          },
        },
      },
    });
    if (employee === null) {
      throw new DomainError({
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Employee not found',
        httpStatus: 404,
      });
    }
    if (
      options.expectedCompanyId !== undefined &&
      employee.companyId !== options.expectedCompanyId
    ) {
      throw new DomainError({
        code: 'VALIDATION_ERROR',
        path: 'employeeId',
        message: 'Employee does not belong to this order',
        httpStatus: 400,
      });
    }
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 1 } });
    if (settings === null) {
      throw new Error('Platform settings row is missing (id = 1)');
    }
    const kitchenHolidays = (
      await this.prisma.kitchenHoliday.findMany({ select: { date: true } })
    ).map((row) => fromDbDate(row.date));
    const address = employee.company.addresses.find((row) => row.id === options.details.addressId);
    const packaging = await this.prisma.packagingType.findUnique({
      where: { id: options.details.packagingTypeId },
      select: { isActive: true },
    });
    const defaultAddress = employee.company.addresses.find((row) => row.isDefault && row.isActive)
      ?? employee.company.addresses.find((row) => row.isActive);
    if (defaultAddress === undefined) {
      throw new DomainError({
        code: 'VALIDATION_ERROR',
        path: 'details.addressId',
        message: 'The company has no active address',
        httpStatus: 400,
      });
    }
    const tierId = await this.pricing.resolveEmployeeTierId(employee.company.priceTierId);
    const { maps } = await this.pricing.loadPriceMaps(tierId);
    const dishes = await this.loadDishes();
    const menuInputs: MenuDishInput[] = dishes.map((dish) => ({
      id: dish.id,
      name: dish.name,
      description: dish.description,
      imageUrl: dish.imageUrl,
      temperature: dish.temperature,
      minOrderQuantity: dish.minOrderQuantity,
      allergens: [],
      dietaryTags: [],
      costCents: dish.costCents,
      placements: dish.placements,
      groups: dish.groups.map((group) => ({
        id: group.id,
        name: group.name,
        isRequired: group.isRequired,
        sortOrder: group.sortOrder,
        options: group.options.map((option) => ({
          id: option.id,
          name: option.name,
          isActive: option.isActive,
          costCents: option.costCents,
        })),
      })),
    }));
    const secretSlugs = [
      ...new Set(
        dishes.flatMap((dish) =>
          dish.placements.filter((row) => row.categoryIsSecret).map((row) => row.categorySlug),
        ),
      ),
    ];
    const resolverBase = {
      tierId,
      maps,
      hiddenCategoryIds: new Set(employee.company.hiddenCategories.map((row) => row.categoryId)),
      hiddenItemIds: new Set(employee.company.hiddenItems.map((row) => row.menuItemId)),
    };
    const orderable = new Set<string>();
    for (const slug of [null, ...secretSlugs]) {
      for (const category of resolveMenu(menuInputs, { ...resolverBase, secretSlug: slug })) {
        for (const item of category.items) {
          orderable.add(item.dishId);
        }
      }
    }
    const catalog = new Map<string, DraftCatalogDish>();
    for (const dish of dishes) {
      if (!orderable.has(dish.id)) {
        continue;
      }
      const price = resolveDishPrice({ id: dish.id, costCents: dish.costCents }, tierId, maps);
      if (price === null) {
        continue;
      }
      catalog.set(dish.id, {
        id: dish.id,
        name: dish.name,
        minOrderQuantity: dish.minOrderQuantity,
        priceCents: price,
        groups: dish.groups.map((group) => ({
          id: group.id,
          name: group.name,
          isRequired: group.isRequired,
          usesPortions: group.usesPortions,
          options: group.options
            .filter((option) => option.isActive)
            .map((option) => ({
              id: option.id,
              name: option.name,
              priceCents: resolveOptionPrice(
                { id: option.id, costCents: option.costCents },
                tierId,
                maps,
              ),
              sizeIds: option.sizeIds,
            }))
            .filter((option): option is { id: string; name: string; priceCents: number; sizeIds: string[] } =>
              option.priceCents !== null,
            ),
          sizes: group.sizes,
        })),
      });
    }
    return {
      catalog,
      ctx: {
        now,
        settings: {
          kitchenWorkingDays: settings.kitchenWorkingDays,
          cutoffTimeMinute: settings.cutoffTimeMinute,
          cutoffWorkingDays: settings.cutoffWorkingDays,
        },
        kitchenHolidays,
        deliveryDate,
        party: {
          employeeActive: employee.isActive,
          companyActive: employee.company.isActive,
          canChooseAddress: employee.canChooseAddress,
          canChangeDeliveryTime: employee.canChangeDeliveryTime,
          canChangePackaging: employee.canChangePackaging,
          companyWorkingDays: employee.company.workingDays,
          companyHolidays: employee.company.holidays.map((row) => fromDbDate(row.date)),
          defaultAddressId: defaultAddress.id,
          defaultDeliveryMinute: employee.company.defaultDeliveryMinute,
          defaultPackagingTypeId: employee.company.defaultPackagingTypeId,
          addressKnown: await this.addressBelongsTo(address?.id, employee.company.id),
          addressActive: address?.isActive ?? false,
          packagingActive: packaging?.isActive ?? false,
        },
        details: options.details,
      },
    };
  }

  private async addressBelongsTo(
    addressId: string | undefined,
    companyId: string,
  ): Promise<boolean> {
    if (addressId === undefined) {
      return false;
    }
    const address = await this.prisma.companyAddress.findUnique({
      where: { id: addressId },
      select: { companyId: true },
    });
    return address !== null && address.companyId === companyId;
  }

  private async loadDishes(): Promise<LoadedDish[]> {
    const dishes = await this.prisma.dish.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        temperature: true,
        minOrderQuantity: true,
        costCents: true,
        menuItems: {
          select: {
            id: true,
            sortOrder: true,
            isActive: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                sortOrder: true,
                isActive: true,
                isSecret: true,
              },
            },
          },
        },
        optionGroups: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            isRequired: true,
            usesPortions: true,
            sortOrder: true,
            options: {
              orderBy: { sortOrder: 'asc' },
              select: {
                option: {
                  select: {
                    id: true,
                    name: true,
                    isActive: true,
                    costCents: true,
                    portions: { select: { portionSizeId: true } },
                  },
                },
              },
            },
            sizes: {
              orderBy: { sortOrder: 'asc' },
              select: {
                portionSizeId: true,
                extraChargeCents: true,
                portionSize: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
    return dishes.map((dish) => ({
      id: dish.id,
      name: dish.name,
      description: dish.description,
      imageUrl: dish.imageUrl,
      temperature: dish.temperature,
      minOrderQuantity: dish.minOrderQuantity,
      costCents: dish.costCents,
      placements: dish.menuItems.map((item) => ({
        itemId: item.id,
        itemSortOrder: item.sortOrder,
        itemIsActive: item.isActive,
        categoryId: item.category.id,
        categoryName: item.category.name,
        categorySlug: item.category.slug,
        categorySortOrder: item.category.sortOrder,
        categoryIsActive: item.category.isActive,
        categoryIsSecret: item.category.isSecret,
      })),
      groups: dish.optionGroups.map((group) => ({
        id: group.id,
        name: group.name,
        isRequired: group.isRequired,
        sortOrder: group.sortOrder,
        usesPortions: group.usesPortions,
        options: group.options.map((link) => ({
          id: link.option.id,
          name: link.option.name,
          isActive: link.option.isActive,
          costCents: link.option.costCents,
          sizeIds: link.option.portions.map((row) => row.portionSizeId),
        })),
        sizes: group.sizes.map((row) => ({
          id: row.portionSize.id,
          name: row.portionSize.name,
          extraCents: row.extraChargeCents,
        })),
      })),
    }));
  }

  private async readLines(orderId: string): Promise<StoredLine[]> {
    const lines = await this.prisma.orderLine.findMany({
      where: { orderId },
      orderBy: { sortOrder: 'asc' },
      include: { combinations: { include: { choices: true } } },
    });
    return lines.map((line) => ({
      dishId: line.dishId,
      combinations: line.combinations.map((combination) => ({
        quantity: combination.quantity,
        choices: combination.choices.map((choice) => ({
          optionId: choice.optionId,
          portionSizeName: choice.portionSizeName,
        })),
      })),
    }));
  }

  private async writeLines(
    tx: Prisma.TransactionClient,
    orderId: string,
    priced: PricedOrder,
  ): Promise<void> {
    for (const line of priced.lines) {
      const created = await tx.orderLine.create({
        data: {
          orderId,
          dishId: line.dishId,
          dishName: line.dishName,
          dishPriceCents: line.dishPriceCents,
          quantity: line.quantity,
          lineTotalCents: line.lineTotalCents,
          sortOrder: line.sortOrder,
        },
        select: { id: true },
      });
      for (const combination of line.combinations) {
        const createdCombo = await tx.orderLineCombination.create({
          data: {
            lineId: created.id,
            comboKey: combination.key,
            quantity: combination.quantity,
            unitPriceCents: combination.unitPriceCents,
            totalCents: combination.totalCents,
          },
          select: { id: true },
        });
        if (combination.choices.length > 0) {
          await tx.orderCombinationChoice.createMany({
            data: combination.choices.map((choice) => ({
              combinationId: createdCombo.id,
              groupName: choice.groupName,
              optionId: choice.optionId,
              optionName: choice.optionName,
              portionSizeName: choice.portionSizeName,
              optionPriceCents: choice.optionPriceCents,
              portionExtraCents: choice.portionExtraCents,
            })),
          });
        }
      }
    }
  }
}

function formatMinute(minute: number): string {
  const hours = Math.floor(minute / 60);
  const rest = minute % 60;
  return `${hours.toString().padStart(2, '0')}:${rest.toString().padStart(2, '0')}`;
}
