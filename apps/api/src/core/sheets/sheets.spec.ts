import { describe, expect, it } from 'vitest';
import { ValidationError } from '../http/errors.js';
import { SheetsService } from './sheets.service.js';

const sheets = new SheetsService();

describe('sheets', () => {
  it('reads a CSV with quoted values, embedded commas and CRLF', () => {
    const csv = 'name,email,note\r\n"Patel, Anika",anika@example.test,"said ""yes"""\r\n';
    const parsed = sheets.parseDelimited(csv);
    expect(parsed.headers).toEqual(['name', 'email', 'note']);
    expect(parsed.rows).toEqual([['Patel, Anika', 'anika@example.test', 'said "yes"']]);
  });

  it('reads a tab-separated sheet', () => {
    const parsed = sheets.parseDelimited('name\temail\nAnika\tanika@example.test\n');
    expect(parsed.headers).toEqual(['name', 'email']);
    expect(parsed.rows[0]).toEqual(['Anika', 'anika@example.test']);
  });

  it('quotes what a CSV must quote, and leaves the rest alone', () => {
    const csv = sheets
      .writeCsv(
        [
          { key: 'name', header: 'Name' },
          { key: 'note', header: 'Note' },
        ],
        [
          { name: 'Anika', note: 'plain' },
          { name: 'Patel, Anika', note: 'said "yes"' },
          { name: null, note: undefined },
        ],
      )
      .toString('utf8');

    expect(csv).toContain('Name,Note');
    expect(csv).toContain('Anika,plain');
    expect(csv).toContain('"Patel, Anika","said ""yes"""');
    // A missing value is an empty cell, not the word "null".
    expect(csv).toContain(',\r\n');
    expect(csv).not.toContain('null');
  });

  it('writes text that looks like a formula as text, and numbers as numbers', () => {
    const csv = sheets
      .writeCsv(
        [
          { key: 'name', header: 'Name' },
          { key: 'score', header: 'Score' },
        ],
        [
          { name: '=HYPERLINK("https://example.test","open")', score: -4 },
          { name: '@SUM(A1:A9)', score: 12.5 },
          { name: '+91 98765 43210', score: 0 },
        ],
      )
      .toString('utf8');
    expect(csv).toContain(`"'=HYPERLINK(""https://example.test"",""open"")",-4`);
    expect(csv).toContain(`'@SUM(A1:A9),12.5`);
    expect(csv).toContain(`'+91 98765 43210,0`);
  });

  it('writes a workbook and reads the same rows back', async () => {
    const columns = [
      { key: 'code', header: 'Code' },
      { key: 'name', header: 'Name' },
      { key: 'attendance', header: 'Attendance' },
    ];
    const rows = [
      { code: 'STU-001', name: 'Anika Patel', attendance: 92 },
      { code: 'STU-002', name: 'Rohan, Das', attendance: 71 },
    ];

    const workbook = await sheets.writeWorkbook('Attendance', columns, rows);
    const parsed = await sheets.parse(workbook.toString('base64'), 'base64');

    expect(parsed.headers).toEqual(['Code', 'Name', 'Attendance']);
    expect(parsed.rows).toEqual([
      ['STU-001', 'Anika Patel', '92'],
      ['STU-002', 'Rohan, Das', '71'],
    ]);
  });

  it('turns an uploaded workbook into the CSV the importers already read', async () => {
    const workbook = await sheets.writeWorkbook(
      'Students',
      [
        { key: 'name', header: 'name' },
        { key: 'email', header: 'email' },
      ],
      [
        { name: 'Anika Patel', email: 'anika@example.test' },
        { name: 'Rohan, Das', email: 'rohan@example.test' },
      ],
    );

    const csv = await sheets.toDelimitedText(workbook.toString('base64'), 'base64');
    const parsed = sheets.parseDelimited(csv);
    expect(parsed.headers).toEqual(['name', 'email']);
    expect(parsed.rows).toEqual([
      ['Anika Patel', 'anika@example.test'],
      // The comma in the name survives the trip through CSV.
      ['Rohan, Das', 'rohan@example.test'],
    ]);
  });

  it('leaves a CSV upload exactly as it was', async () => {
    const csv = 'name,email\nAnika,anika@example.test\n';
    expect(await sheets.toDelimitedText(csv, 'text')).toBe(csv);
  });

  it('says so when the file is not a spreadsheet it can read', async () => {
    const error = await sheets
      .parse(Buffer.from('this is not a workbook').toString('base64'), 'base64')
      .then(
        () => null,
        (caught: unknown) => caught as ValidationError,
      );
    expect(error).toBeInstanceOf(ValidationError);
    expect(error?.issues?.[0]?.message).toMatch(/not a spreadsheet/);
  });
});
