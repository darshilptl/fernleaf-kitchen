/**
 * Company delivery-day check + email domain rules. PDF §4.4 / D-19, D-26.
 *
 * The company calendar NEVER moves the cut-off (only the kitchen
 * calendar does); this predicate gates order delivery dates only.
 */

/** Starter freemail blocklist. Exact match only (D-19). */
export const PUBLIC_EMAIL_DOMAINS: readonly string[] = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'yandex.com',
];

const HOSTNAME_PATTERN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/**
 * Normalize a claimed domain: trim, lowercase, strip one leading
 * `@`. Throws on empty input.
 */
export function normalizeDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const stripped = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  if (stripped === '') {
    throw new Error(`Invalid domain: ${input}`);
  }
  return stripped;
}

/** True when the normalized domain has valid hostname shape. */
export function isValidDomainShape(domain: string): boolean {
  return HOSTNAME_PATTERN.test(domain);
}

/** True when the domain is on the public blocklist (exact match). */
export function isPublicDomain(domain: string): boolean {
  return PUBLIC_EMAIL_DOMAINS.includes(domain);
}

export type CalendarDate = string; // YYYY-MM-DD

/**
 * Company delivery day: ISO weekday in workingDays AND date not in
 * holidays. Pure; used by the order form AND server validation.
 */
export function isCompanyDeliveryDay(
  workingDays: readonly number[],
  holidays: readonly CalendarDate[],
  date: CalendarDate,
): boolean {
  const weekday = isoWeekday(date);
  if (!workingDays.includes(weekday)) {
    return false;
  }
  return !holidays.includes(date);
}

/** ISO weekday of a YYYY-MM-DD date: 1 = Monday .. 7 = Sunday. UTC-based. */
export function isoWeekday(date: CalendarDate): number {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}
