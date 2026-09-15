/**
 * Minimal RFC 4180 reader for import sheets. Handles quoted fields, embedded commas,
 * doubled quotes, CRLF and a UTF-8 byte-order mark. Tab-separated files are detected from
 * the header line, so a sheet exported as TSV also works.
 *
 * A `.xlsx` workbook never reaches this reader: `SheetsService` turns one into CSV first, so
 * there is one row reader, one set of line numbers and one error report whatever was uploaded.
 */
export interface ParsedSheet {
  headers: string[];
  /** One entry per data row: the raw cells, plus the 1-based line number in the file. */
  rows: { line: number; cells: string[] }[];
}

export function parseDelimited(input: string, maxRows = 5000): ParsedSheet {
  const text = input.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(text);
  const records = splitRecords(text, delimiter);
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = (records[0]?.cells ?? []).map((h) => h.trim());
  const rows = records
    .slice(1)
    .filter((record) => record.cells.some((cell) => cell.trim().length > 0))
    .slice(0, maxRows);
  return { headers, rows };
}

/** Maps a row onto its headers; missing trailing cells become empty strings. */
export function rowToObject(headers: string[], cells: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((header, index) => {
    out[header] = (cells[index] ?? '').trim();
  });
  return out;
}

function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'));
  const commas = (firstLine.match(/,/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  if (tabs > commas && tabs >= semicolons) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

function splitRecords(text: string, delimiter: string): { line: number; cells: string[] }[] {
  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  const endField = (): void => {
    cells.push(field);
    field = '';
  };
  const endRecord = (): void => {
    endField();
    records.push({ line: recordLine, cells });
    cells = [];
    recordLine = line;
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === '\n') line += 1;
        field += char;
      }
      continue;
    }
    if (char === '"' && field.length === 0) {
      inQuotes = true;
    } else if (char === delimiter) {
      endField();
    } else if (char === '\r') {
      // handled by the following \n
    } else if (char === '\n') {
      line += 1;
      endRecord();
      recordLine = line;
    } else {
      field += char;
    }
  }
  if (field.length > 0 || cells.length > 0) endRecord();
  return records;
}
