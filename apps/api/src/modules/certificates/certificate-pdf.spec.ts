import { inflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { drawCertificate, type CertificateContent } from './certificate-pdf.js';

const content = (overrides: Partial<CertificateContent> = {}): CertificateContent => ({
  code: 'ABCD2345WXYZ',
  learnerName: 'Priya Raman',
  courseTitle: 'Java Full Stack Development',
  institute: 'SI Academy',
  completedOn: '2 October 2026',
  issuedOn: '2 October 2026',
  verifyUrl: 'https://lms.example/verify/ABCD2345WXYZ',
  ...overrides,
});

const header = (bytes: Uint8Array) => new TextDecoder().decode(bytes.slice(0, 5));

describe('the certificate PDF (ADR-0022)', () => {
  it('is a one-page landscape PDF titled after the course', async () => {
    const bytes = await drawCertificate(content());
    expect(header(bytes)).toBe('%PDF-');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeGreaterThan(height);
    expect(pdf.getTitle()).toContain('Java Full Stack Development');
    expect(pdf.getAuthor()).toBe('SI Academy');
  });

  it('still draws when a name has characters the standard fonts cannot print', async () => {
    const bytes = await drawCertificate(
      content({ learnerName: 'தமிழ் செல்வி 😀', courseTitle: 'Python — 数据 Basics' }),
    );
    expect(header(bytes)).toBe('%PDF-');
  });

  it('still draws a title far too long for one line', async () => {
    const bytes = await drawCertificate(content({ courseTitle: 'Advanced '.repeat(40).trim() }));
    expect(header(bytes)).toBe('%PDF-');
  });

  it('signs with the signatory recorded at issue, and draws no line without one', async () => {
    // Standard-font text is written as hexadecimal strings inside the page's compressed content.
    const hex = (text: string) => Buffer.from(text, 'latin1').toString('hex').toUpperCase();
    const raw = (bytes: Uint8Array) => {
      const pdf = Buffer.from(bytes);
      const parts: string[] = [];
      for (let at = pdf.indexOf('stream'); at >= 0; at = pdf.indexOf('stream', at + 6)) {
        const start = at + (pdf[at + 6] === 0x0d ? 8 : 7);
        const end = pdf.indexOf('endstream', start);
        if (end < 0) break;
        try {
          parts.push(inflateSync(pdf.subarray(start, end)).toString('latin1'));
        } catch {
          parts.push(pdf.subarray(start, end).toString('latin1'));
        }
        at = end;
      }
      return parts.join('\n').toUpperCase();
    };
    const signed = raw(
      await drawCertificate(
        content({ signatoryName: 'Dr Meera Nair', signatoryTitle: 'Director of Studies' }),
      ),
    );
    expect(signed).toContain(hex('Dr Meera Nair'));
    expect(signed).toContain(hex('Director of Studies'));
    const unsigned = raw(await drawCertificate(content()));
    expect(unsigned).not.toContain(hex('Director of Studies'));
  });
});
