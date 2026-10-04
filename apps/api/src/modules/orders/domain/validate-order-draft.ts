import {
  DomainError,
  comboKey,
  computeOrderTotals,
  isCompanyDeliveryDay,
  isLocked,
  kitchenToday,
} from '@repo/shared';
import type {
  CalendarDate,
  CutoffSettings,
  OrderLineInput,
} from '@repo/shared';

/**
 * Order draft validation. PDF §4.6 / skill orders. D-54..D-59.
 *
 * Pure: the service assembles plain data (party, catalog, dates)
 * and this function enforces the checks IN ORDER, throwing the
 * first failure as a DomainError with a form-mapped `path`.
 * Pricing flows through the shared `comboKey`/`computeOrderTotals`
 * only; availability was decided by `resolveMenu` (the catalog
 * holds exactly the orderable dishes).
 *
 * Algorithm (skill order):
 *   1. Employee and company active.
 *   2. Date >= today and not locked (D-50: locked rejects all).
 *   3. Company delivery day.
 *   4. Address/packaging belong and are active; deviations from
 *      company defaults need the employee flags (D-59).
 *   5. Dishes orderable, no repeats (D-54).
 *   6. Line quantity (combo sum) meets `minOrderQuantity` (D-56).
 *   7. Distinct combo keys per line (D-54).
 *   8. Group/option/portion rules per combination.
 *   9. Place requires at least one line.
 * Invariants: line quantity is DERIVED (combo sum), never sent.
 * Edge cases: empty lines allowed for drafts (D-57), never for place.
 */

export interface DraftCatalogOption {
  id: string;
  name: string;
  priceCents: number;
  sizeIds: readonly string[];
}

export interface DraftCatalogSize {
  id: string;
  name: string;
  extraCents: number;
}

export interface DraftCatalogGroup {
  id: string;
  name: string;
  isRequired: boolean;
  usesPortions: boolean;
  options: readonly DraftCatalogOption[];
  sizes: readonly DraftCatalogSize[];
}

export interface DraftCatalogDish {
  id: string;
  name: string;
  minOrderQuantity: number | null;
  priceCents: number;
  groups: readonly DraftCatalogGroup[];
}

export interface DraftDetails {
  addressId: string;
  deliveryTimeMinute: number;
  packagingTypeId: string;
}

export interface DraftParty {
  employeeActive: boolean;
  companyActive: boolean;
  canChooseAddress: boolean;
  canChangeDeliveryTime: boolean;
  canChangePackaging: boolean;
  companyWorkingDays: readonly number[];
  companyHolidays: readonly CalendarDate[];
  defaultAddressId: string;
  defaultDeliveryMinute: number;
  defaultPackagingTypeId: string;
  addressKnown: boolean;
  addressActive: boolean;
  packagingActive: boolean;
}

export interface DraftContext {
  now: Date;
  settings: CutoffSettings;
  kitchenHolidays: readonly CalendarDate[];
  deliveryDate: CalendarDate;
  party: DraftParty;
  details: DraftDetails;
}

export interface PricedChoice {
  optionId: string;
  groupName: string;
  optionName: string;
  portionSizeId: string | null;
  portionSizeName: string | null;
  optionPriceCents: number;
  portionExtraCents: number;
}

export interface PricedCombination {
  key: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  choices: PricedChoice[];
}

export interface PricedLine {
  dishId: string;
  dishName: string;
  dishPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  sortOrder: number;
  combinations: PricedCombination[];
}

export interface PricedOrder {
  lines: PricedLine[];
  totalCents: number;
}

export function validateOrderDraft(
  lines: readonly OrderLineInput[],
  catalog: ReadonlyMap<string, DraftCatalogDish>,
  ctx: DraftContext,
  options?: { requireLines?: boolean },
): PricedOrder {
  checkParty(ctx);
  checkDate(ctx);
  checkDetails(ctx);
  if (options?.requireLines === true && lines.length === 0) {
    throw new DomainError({
      code: 'VALIDATION_ERROR',
      path: 'lines',
      message: 'An order needs at least one line to place',
      httpStatus: 400,
    });
  }
  const seen = new Set<string>();
  const priced = lines.map((line, lineIndex) => checkLine(line, lineIndex, catalog, seen));
  const totals = computeOrderTotals(
    priced.map((line) => ({
      combinations: line.combinations.map((combination) => ({
        quantity: combination.quantity,
        dishPriceCents: line.dishPriceCents,
        options: combination.choices.map((choice) => ({
          optionPriceCents: choice.optionPriceCents,
          portionExtraCents: choice.portionExtraCents,
        })),
      })),
    })),
  );
  const withTotals = priced.map((line, index) => {
    const total = totals.lines[index];
    if (total === undefined) {
      throw new Error('Totals mismatch: computeOrderTotals changed the line count');
    }
    const combinations = line.combinations.map((combination, comboIndex) => {
      const pricedCombo = total.combinations[comboIndex];
      if (pricedCombo === undefined) {
        throw new Error('Totals mismatch: computeOrderTotals changed the combination count');
      }
      return { ...combination, unitPriceCents: pricedCombo.unitPriceCents, totalCents: pricedCombo.totalCents };
    });
    return { ...line, combinations, lineTotalCents: total.lineTotalCents };
  });
  return { lines: withTotals, totalCents: totals.totalCents };
}

function checkParty(ctx: DraftContext): void {
  if (!ctx.party.employeeActive || !ctx.party.companyActive) {
    throw new DomainError({
      code: 'VALIDATION_ERROR',
      path: 'employeeId',
      message: 'Employee and company must both be active',
      httpStatus: 400,
    });
  }
}

function checkDate(ctx: DraftContext): void {
  if (ctx.deliveryDate < kitchenToday(ctx.now)) {
    throw new DomainError({
      code: 'VALIDATION_ERROR',
      path: 'deliveryDate',
      message: 'Delivery date cannot be in the past',
      httpStatus: 400,
    });
  }
  if (isLocked(ctx.deliveryDate, ctx.now, ctx.settings, ctx.kitchenHolidays)) {
    throw new DomainError({
      code: 'ORDER_LOCKED',
      path: 'deliveryDate',
      message: 'The cut-off for this delivery date has passed',
      httpStatus: 409,
    });
  }
  if (!isCompanyDeliveryDay(ctx.party.companyWorkingDays, ctx.party.companyHolidays, ctx.deliveryDate)) {
    throw new DomainError({
      code: 'VALIDATION_ERROR',
      path: 'deliveryDate',
      message: 'The company does not receive deliveries on this date',
      httpStatus: 400,
    });
  }
}

function checkDetails(ctx: DraftContext): void {
  const party = ctx.party;
  const details = ctx.details;
  if (!party.addressKnown || !party.addressActive) {
    throw new DomainError({
      code: 'VALIDATION_ERROR',
      path: 'details.addressId',
      message: 'Address must be an active address of the company',
      httpStatus: 400,
    });
  }
  if (!party.packagingActive) {
    throw new DomainError({
      code: 'VALIDATION_ERROR',
      path: 'details.packagingTypeId',
      message: 'Packaging must be active',
      httpStatus: 400,
    });
  }
  if (details.addressId !== party.defaultAddressId && !party.canChooseAddress) {
    throw new DomainError({
      code: 'VALIDATION_ERROR',
      path: 'details.addressId',
      message: 'This employee cannot choose a different address',
      httpStatus: 400,
    });
  }
  if (details.deliveryTimeMinute !== party.defaultDeliveryMinute && !party.canChangeDeliveryTime) {
    throw new DomainError({
      code: 'VALIDATION_ERROR',
      path: 'details.deliveryTimeMinute',
      message: 'This employee cannot change the delivery time',
      httpStatus: 400,
    });
  }
  if (details.packagingTypeId !== party.defaultPackagingTypeId && !party.canChangePackaging) {
    throw new DomainError({
      code: 'VALIDATION_ERROR',
      path: 'details.packagingTypeId',
      message: 'This employee cannot change the packaging',
      httpStatus: 400,
    });
  }
}

interface NormalizedChoice {
  optionId: string;
  portionSizeId: string | null;
}

interface UnpricedCombination {
  key: string;
  quantity: number;
  choices: ChoiceWithGroup[];
}

interface UnpricedLine {
  dishId: string;
  dishName: string;
  dishPriceCents: number;
  quantity: number;
  sortOrder: number;
  combinations: UnpricedCombination[];
}

function checkLine(
  line: OrderLineInput,
  lineIndex: number,
  catalog: ReadonlyMap<string, DraftCatalogDish>,
  seen: Set<string>,
): UnpricedLine {
  const dish = catalog.get(line.dishId);
  if (dish === undefined) {
    throw new DomainError({
      code: 'VALIDATION_ERROR',
      path: `lines[${lineIndex}].dishId`,
      message: 'Dish is not available for this employee',
      httpStatus: 400,
    });
  }
  if (seen.has(line.dishId)) {
    throw new DomainError({
      code: 'VALIDATION_ERROR',
      path: `lines[${lineIndex}].dishId`,
      message: 'Each dish may appear only once per order',
      httpStatus: 400,
    });
  }
  seen.add(line.dishId);
  const keys = new Set<string>();
  const combinations = line.combinations.map((combination, comboIndex) => {
    const path = `lines[${lineIndex}].combinations[${comboIndex}]`;
    const normalized: NormalizedChoice[] = combination.choices.map((choice) => ({
      optionId: choice.optionId,
      portionSizeId: choice.portionSizeId ?? null,
    }));
    const choices = checkChoices(normalized, path, dish);
    const key = comboKey(
      choices.map((choice) => ({
        groupId: choice.groupId,
        optionId: choice.optionId,
        sizeId: choice.portionSizeId,
      })),
    );
    if (keys.has(key)) {
      throw new DomainError({
        code: 'VALIDATION_ERROR',
        path,
        message: 'Combinations in a line must be distinct',
        httpStatus: 400,
      });
    }
    keys.add(key);
    return { key, quantity: combination.quantity, choices };
  });
  const quantity = combinations.reduce((sum, combination) => sum + combination.quantity, 0);
  if (dish.minOrderQuantity !== null && quantity < dish.minOrderQuantity) {
    throw new DomainError({
      code: 'VALIDATION_ERROR',
      path: `lines[${lineIndex}].quantity`,
      message: `This dish needs at least ${dish.minOrderQuantity} covers`,
      httpStatus: 400,
    });
  }
  return {
    dishId: dish.id,
    dishName: dish.name,
    dishPriceCents: dish.priceCents,
    quantity,
    sortOrder: lineIndex,
    combinations,
  };
}

interface ChoiceWithGroup extends PricedChoice {
  groupId: string;
}

function checkChoices(
  choices: readonly NormalizedChoice[],
  path: string,
  dish: DraftCatalogDish,
): ChoiceWithGroup[] {
  const byGroup = new Map<string, NormalizedChoice[]>();
  const optionToGroup = new Map<string, DraftCatalogGroup>();
  for (const group of dish.groups) {
    for (const option of group.options) {
      optionToGroup.set(option.id, group);
    }
  }
  choices.forEach((choice, choiceIndex) => {
    const group = optionToGroup.get(choice.optionId);
    if (group === undefined) {
      throw new DomainError({
        code: 'VALIDATION_ERROR',
        path: `${path}.choices[${choiceIndex}].optionId`,
        message: 'Option is not part of this dish',
        httpStatus: 400,
      });
    }
    const list = byGroup.get(group.id) ?? [];
    list.push(choice);
    byGroup.set(group.id, list);
  });
  const priced: ChoiceWithGroup[] = [];
  for (const group of dish.groups) {
    const picked = byGroup.get(group.id) ?? [];
    if (group.isRequired && picked.length !== 1) {
      throw new DomainError({
        code: 'VALIDATION_ERROR',
        path: `${path}.choices`,
        message: `Exactly one option is required for ${group.name}`,
        httpStatus: 400,
      });
    }
    if (!group.isRequired && picked.length > 1) {
      throw new DomainError({
        code: 'VALIDATION_ERROR',
        path: `${path}.choices`,
        message: `At most one option is allowed for ${group.name}`,
        httpStatus: 400,
      });
    }
    for (const choice of picked) {
      priced.push(priceChoice(choice, group, path));
    }
  }
  return priced;
}

function priceChoice(
  choice: { optionId: string; portionSizeId: string | null },
  group: DraftCatalogGroup,
  path: string,
): ChoiceWithGroup {
  const option = group.options.find((row) => row.id === choice.optionId);
  if (option === undefined) {
    throw new DomainError({
      code: 'VALIDATION_ERROR',
      path: `${path}.choices`,
      message: 'Option is not available for this employee',
      httpStatus: 400,
    });
  }
  if (!group.usesPortions) {
    if (choice.portionSizeId !== null) {
      throw new DomainError({
        code: 'VALIDATION_ERROR',
        path: `${path}.choices`,
        message: `Options in ${group.name} take no portion size`,
        httpStatus: 400,
      });
    }
    return {
      groupId: group.id,
      optionId: option.id,
      groupName: group.name,
      optionName: option.name,
      portionSizeId: null,
      portionSizeName: null,
      optionPriceCents: option.priceCents,
      portionExtraCents: 0,
    };
  }
  const size = group.sizes.find((row) => row.id === choice.portionSizeId);
  if (size === undefined || !option.sizeIds.includes(size.id)) {
    throw new DomainError({
      code: 'VALIDATION_ERROR',
      path: `${path}.choices`,
      message: `A portion size supported by ${option.name} is required`,
      httpStatus: 400,
    });
  }
  return {
    groupId: group.id,
    optionId: option.id,
    groupName: group.name,
    optionName: option.name,
    portionSizeId: size.id,
    portionSizeName: size.name,
    optionPriceCents: option.priceCents,
    portionExtraCents: size.extraCents,
  };
}
