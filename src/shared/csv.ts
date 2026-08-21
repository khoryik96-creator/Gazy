/**
 * Pure CSV helpers, kept free of DOM/chrome APIs so they can be unit-tested.
 *
 * `csvField` both quotes/escapes a value AND neutralises spreadsheet formula
 * injection: a field beginning with = + - @ (or a control char) is treated as a
 * formula by Excel/Sheets, so a crafted LinkedIn name like `=HYPERLINK(...)` or
 * `=cmd|...` could execute on open. Prefixing such values with a single quote
 * makes them inert text.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function csvField(value: string | number): string {
  let s = String(value);
  if (FORMULA_TRIGGER.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

/** Joins rows of values into CSV text with real newlines. */
export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(csvField).join(',')).join('\n');
}
