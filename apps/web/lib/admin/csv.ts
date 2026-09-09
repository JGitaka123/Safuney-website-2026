/**
 * CSV parsing and writing, RFC 4180 shaped: quoted fields, doubled quotes inside them, embedded
 * newlines, and a tolerated BOM (Excel writes one, and it otherwise poisons the first header).
 *
 * A small hand-rolled parser rather than a dependency: the format is this short, and the catalogue
 * import must not fail in a way nobody can read.
 */
export type Row = Record<string, string>;

export function parseCsv(text: string): { headers: string[]; rows: Row[] } {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (quoted) {
      if (c === '"') {
        if (body[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { record.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { record.push(field); records.push(record); field = ""; record = []; continue; }
    field += c;
  }
  if (field.length > 0 || record.length > 0) { record.push(field); records.push(record); }

  const headerRow = records.shift();
  if (!headerRow) return { headers: [], rows: [] };
  const headers = headerRow.map((h) => h.trim());
  const rows = records
    // A trailing newline leaves one empty record; so does a blank line in the middle.
    .filter((r) => r.some((v) => v.trim().length > 0))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
  return { headers, rows };
}

function escape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(headers: string[], rows: Row[]): string {
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h] ?? "")).join(","));
  return `${lines.join("\r\n")}\r\n`;
}
