/**
 * Pricing math in integer cents. PDF §4.3 / D-10, D-11, D-12.
 *
 * Only TYPED prices are stored; derived prices compute on read.
 * NEVER floats: every operation here is integer arithmetic.
 */

/**
 * Ceiling to a multiple of 5 cents. PDF §4.3.6 / D-11.
 *
 * ceil(baseCents * multiplierBp / 50000) * 5, via integer division.
 * A result already on a multiple of 5 is unchanged.
 * Checks: cost 310 x 24000 -> 745. 184 x 11500 -> 215.
 */
export function ceilToFiveCents(baseCents: number, multiplierBp: number): number {
  if (!Number.isInteger(baseCents) || baseCents < 0) {
    throw new Error(`Base must be a non-negative integer: ${baseCents}`);
  }
  if (!Number.isInteger(multiplierBp) || multiplierBp <= 0) {
    throw new Error(`Multiplier must be a positive integer: ${multiplierBp}`);
  }
  const n = baseCents * multiplierBp;
  return Math.floor((n + 49999) / 50000) * 5;
}

const MULTIPLIER_PATTERN = /^(\d+)(?:\.(\d{1,4}))?$/;
const PERCENT_PATTERN = /^\+(\d+)(?:\.(\d{1,4}))?%$/;

/**
 * Parse a tier multiplier into basis points (10000 = x1.00).
 * Accepts `"2.4"` (cost multiplier) or `"+15%"` (tier uplift).
 * Max 4 decimals; string handling only, never floats.
 * `"2.4"` -> 24000, `"+15%"` -> 11500. Throws on invalid input.
 */
export function parseMultiplier(input: string): number {
  const trimmed = input.trim();
  const percent = PERCENT_PATTERN.exec(trimmed);
  if (percent !== null && percent[1] !== undefined) {
    // "+15%" -> 11500: whole percent points plus hundredths.
    const hundredths = (percent[2] ?? '').padEnd(2, '0');
    return 10000 + Number.parseInt(percent[1], 10) * 100 + Number.parseInt(hundredths, 10);
  }
  const plain = MULTIPLIER_PATTERN.exec(trimmed);
  if (plain !== null && plain[1] !== undefined) {
    return parseDecimalPart(plain[1], plain[2]);
  }
  throw new Error(`Invalid multiplier: ${input}`);
}

function parseDecimalPart(whole: string, fraction: string | undefined): number {
  const padded = (fraction ?? '').padEnd(4, '0');
  return Number.parseInt(whole, 10) * 10000 + Number.parseInt(padded, 10);
}
