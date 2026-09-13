import { describe, expect, it } from 'vitest';
import { parseDelimited, rowToObject } from './csv.js';

describe('parseDelimited', () => {
  it('reads a plain comma-separated sheet', () => {
    const sheet = parseDelimited('name,email\nAda,ada@test.local\nGrace,grace@test.local\n');
    expect(sheet.headers).toEqual(['name', 'email']);
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[0]?.cells).toEqual(['Ada', 'ada@test.local']);
    expect(sheet.rows[1]?.line, 'line numbers point at the row in the file').toBe(3);
  });

  it('keeps commas, quotes and newlines inside quoted fields', () => {
    const sheet = parseDelimited('name,note\n"Rao, Anita","She said ""yes"""\n"Two\nlines",ok\n');
    expect(sheet.rows[0]?.cells).toEqual(['Rao, Anita', 'She said "yes"']);
    expect(sheet.rows[1]?.cells).toEqual(['Two\nlines', 'ok']);
  });

  it('accepts CRLF endings, a byte-order mark and a tab-separated file', () => {
    const sheet = parseDelimited('﻿name,email\r\nAda,ada@test.local\r\n');
    expect(sheet.headers).toEqual(['name', 'email']);
    expect(sheet.rows[0]?.cells).toEqual(['Ada', 'ada@test.local']);

    const tsv = parseDelimited('name\temail\tcity\nAda\tada@test.local\tChennai\n');
    expect(tsv.headers).toEqual(['name', 'email', 'city']);
    expect(tsv.rows[0]?.cells[2]).toBe('Chennai');
  });

  it('drops blank lines and stops at the row limit', () => {
    const sheet = parseDelimited('name\nA\n\n   \nB\n');
    expect(sheet.rows.map((r) => r.cells[0])).toEqual(['A', 'B']);
    const capped = parseDelimited(`name\n${['A', 'B', 'C'].join('\n')}\n`, 2);
    expect(capped.rows).toHaveLength(2);
  });

  it('returns nothing for empty input', () => {
    expect(parseDelimited('')).toEqual({ headers: [], rows: [] });
  });
});

describe('rowToObject', () => {
  it('maps cells onto headers and trims them', () => {
    expect(rowToObject(['name', 'city'], [' Ada ', 'Chennai'])).toEqual({
      name: 'Ada',
      city: 'Chennai',
    });
  });

  it('fills missing trailing cells with empty strings', () => {
    expect(rowToObject(['name', 'city', 'state'], ['Ada'])).toEqual({
      name: 'Ada',
      city: '',
      state: '',
    });
  });
});
