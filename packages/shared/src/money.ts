/**
 * Money parse/format in integer cents. PDF §7 / D-76.
 *
 * Money is integer cents everywhere. Parsing uses string handling
 * only — never `Number("7.45") * 100`. Display is `$` with two
 * decimals. No floats cross this boundary.
 */

const MONEY_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Parse a dollars string into cents.
 * Throws a plain Error on invalid input; callers map it to a
 * validation issue at the schema boundary.
 *
 * Edge cases: "7" -> 700, "7.4" -> 740, "7.45" -> 745,
 * "" / "7.456" / "-1" / "abc" throw.
 */
export function parseMoney(input: string): number {
  const trimmed = input.trim();
  const match = MONEY_PATTERN.exec(trimmed);
  if (match === null || match[1] === undefined) {
    throw new Error(`Invalid money value: ${input}`);
  }
  const dollars = Number.parseInt(match[1], 10);
  const centsPart = (match[2] ?? '').padEnd(2, '0');
  return dollars * 100 + Number.parseInt(centsPart, 10);
}

/**
 * Format integer cents as `$7.45`. Cents must be an integer;
 * negative totals never occur (DB checks) but format honestly
 * if one ever appears.
 */
export function formatMoney(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error(`Cents must be an integer: ${cents}`);
  }
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100);
  const remainder = absolute % 100;
  return `${sign}$${dollars}.${remainder.toString().padStart(2, '0')}`;
}
