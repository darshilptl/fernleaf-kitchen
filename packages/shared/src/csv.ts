/**
 * Minimal CSV parser for 2-column admin imports. PDF §4.5 [Should].
 *
 * No dependency: handles CRLF, quoted fields, and escaped quotes.
 * Callers validate rows against Zod and enforce row limits.
 */

export interface CsvRow {
  /** 1-based file line number (header is line 1). */
  line: number;
  values: string[];
}

export interface ParsedCsv {
  header: string[];
  rows: CsvRow[];
}

/**
 * Parse CSV text into header + data rows. Skips blank lines.
 * Throws on unbalanced quotes.
 */
export function parseCsv(text: string): ParsedCsv {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const records = splitRecords(normalized).filter((record) =>
    record.some((field) => field.trim() !== ''),
  );
  if (records.length === 0) {
    throw new Error('CSV is empty');
  }
  const header = records[0];
  if (header === undefined) {
    throw new Error('CSV is empty');
  }
  const rows: CsvRow[] = [];
  for (let index = 1; index < records.length; index += 1) {
    const record = records[index];
    if (record !== undefined) {
      rows.push({ line: index + 1, values: record });
    }
  }
  return {
    header: header.map((cell) => cell.trim()),
    rows,
  };
}

function splitRecords(text: string): string[][] {
  const records: string[][] = [];
  let current: string[] = [];
  let field = '';
  let quoted = false;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === undefined) {
      break;
    }
    if (quoted) {
      if (char === '"') {
        const next = text[index + 1];
        if (next === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = true;
      index += 1;
      continue;
    }
    if (char === ',') {
      current.push(field);
      field = '';
      index += 1;
      continue;
    }
    if (char === '\n') {
      current.push(field);
      field = '';
      records.push(current);
      current = [];
      index += 1;
      continue;
    }
    field += char;
    index += 1;
  }
  if (quoted) {
    throw new Error('CSV has an unbalanced quote');
  }
  current.push(field);
  if (current.some((cell) => cell !== '')) {
    records.push(current);
  }
  return records;
}
