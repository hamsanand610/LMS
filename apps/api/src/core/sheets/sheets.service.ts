import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { SheetEncoding } from '@lms/shared';
import { ValidationError } from '../http/errors.js';

export interface SheetColumn {
  key: string;
  header: string;
  /** Widths are a courtesy: a spreadsheet nobody has to resize reads better. */
  width?: number;
}

/** A parsed sheet: the header row, and every row after it as strings. */
export interface ParsedSheet {
  headers: string[];
  rows: string[][];
}

const MAX_ROWS = 5_000;

/**
 * Reads and writes the spreadsheets the platform exchanges with people: the import sheets the
 * admin and question wizards accept, and the files an export job produces. It lives in core
 * because three modules use it and none of them should depend on another (rule 12).
 */
@Injectable()
export class SheetsService {
  /**
   * Turns an uploaded sheet into rows of strings. `text` is a CSV or TSV file, `base64` is an
   * `.xlsx` workbook, whose first worksheet is read.
   */
  async parse(content: string, encoding: SheetEncoding = 'text'): Promise<ParsedSheet> {
    return encoding === 'base64' ? this.parseWorkbook(content) : this.parseDelimited(content);
  }

  /**
   * Normalises an upload to CSV text. A `.xlsx` workbook is re-emitted as CSV so the importers
   * keep one row reader, one set of row numbers and one error report whatever was uploaded.
   */
  async toDelimitedText(content: string, encoding: SheetEncoding = 'text'): Promise<string> {
    if (encoding !== 'base64') return content;
    const sheet = await this.parseWorkbook(content);
    const lines = [sheet.headers.map(csvCell).join(',')];
    for (const row of sheet.rows) lines.push(row.map(csvCell).join(','));
    return lines.join('\n');
  }

  /** CSV or TSV, with the delimiter chosen from the header row and quotes handled properly. */
  parseDelimited(content: string): ParsedSheet {
    const text = content.replace(/^\uFEFF/, '');
    const lines = splitRecords(text);
    if (lines.length === 0)
      throw new ValidationError([{ path: 'content', message: 'The sheet is empty' }]);

    const first = lines[0] ?? '';
    const delimiter = first.includes('\t') && !first.includes(',') ? '\t' : ',';
    const headers = splitLine(first, delimiter).map((h) => h.trim());
    const rows = lines
      .slice(1)
      .filter((line) => line.trim().length > 0)
      .slice(0, MAX_ROWS)
      .map((line) => splitLine(line, delimiter));
    return { headers, rows };
  }

  private async parseWorkbook(base64: string): Promise<ParsedSheet> {
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch {
      throw new ValidationError([{ path: 'content', message: 'The file could not be decoded' }]);
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new ValidationError([
        { path: 'content', message: 'That file is not a spreadsheet this platform can read' },
      ]);
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new ValidationError([{ path: 'content', message: 'The workbook has no sheets' }]);
    }

    const table: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      if (table.length > MAX_ROWS) return;
      const values: string[] = [];
      // `row.values` is 1-based with a hole at index 0, which is why this is not a plain map.
      const cells = row.values as unknown[];
      for (let index = 1; index < cells.length; index += 1) {
        values.push(cellToString(cells[index]));
      }
      table.push(values);
    });

    const headers = (table.shift() ?? []).map((h) => h.trim());
    const rows = table.filter((row) => row.some((cell) => cell.trim().length > 0));
    return { headers, rows };
  }

  /** A CSV file, quoted so a comma or a newline inside a value cannot break the columns. */
  writeCsv(columns: SheetColumn[], rows: Record<string, unknown>[]): Buffer {
    const lines = [columns.map((c) => csvCell(c.header)).join(',')];
    for (const row of rows) {
      lines.push(columns.map((c) => csvCell(row[c.key])).join(','));
    }
    // The byte-order mark is what makes Excel open a UTF-8 CSV without mangling accents.
    return Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
  }

  /** An `.xlsx` workbook with one sheet, a frozen header row and an auto-filter. */
  async writeWorkbook(
    title: string,
    columns: SheetColumn[],
    rows: Record<string, unknown>[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LMS';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(safeSheetName(title));
    sheet.columns = columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width ?? Math.min(40, Math.max(12, column.header.length + 4)),
    }));
    for (const row of rows) {
      sheet.addRow(
        Object.fromEntries(columns.map((column) => [column.key, cellValue(row[column.key])])),
      );
    }
    const header = sheet.getRow(1);
    header.font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    if (rows.length > 0) {
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    }
    const written = await workbook.xlsx.writeBuffer();
    return Buffer.from(written);
  }
}

/** Splits on newlines that are not inside a quoted value. */
function splitRecords(text: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        current += '""';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      records.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.length > 0) records.push(current);
  return records;
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Numbers stay numbers so a spreadsheet can total a column. */
function cellValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  return String(value);
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const rich = value as { text?: string; result?: unknown; hyperlink?: string };
    if (typeof rich.text === 'string') return rich.text;
    if (rich.result !== undefined) return String(rich.result);
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return String(value);
}

/** Excel refuses these characters in a sheet name, and truncates at 31. */
function safeSheetName(title: string): string {
  const cleaned = title.replace(/[\\/?*[\]:]/g, ' ').trim();
  return (cleaned || 'Report').slice(0, 31);
}
