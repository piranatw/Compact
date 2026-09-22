const FORMULA_TRIGGER_CHARS = ["=", "+", "-", "@", "\t", "\r"];

function sanitizeCell(value: unknown): string {
  if (value == null) return "";
  let str = String(value);
  if (FORMULA_TRIGGER_CHARS.some((c) => str.startsWith(c))) {
    str = "'" + str; // neutralize spreadsheet formula injection from free-text cells
  }
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const header = columns.map((c) => sanitizeCell(c)).join(",");
  const lines = rows.map((row) => columns.map((c) => sanitizeCell(row[c])).join(","));
  return [header, ...lines].join("\r\n");
}
