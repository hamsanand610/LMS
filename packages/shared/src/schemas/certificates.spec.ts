import { describe, expect, it } from 'vitest';
import {
  CERTIFICATE_CODE_ALPHABET,
  CERTIFICATE_CODE_LENGTH,
  certificateCodeSchema,
  formatCertificateCode,
} from './certificates.js';

describe('certificate codes (ADR-0022)', () => {
  it('uses Crockford base32, with no letter that reads like a digit', () => {
    expect(CERTIFICATE_CODE_ALPHABET).toHaveLength(32);
    for (const letter of ['I', 'L', 'O', 'U']) {
      expect(CERTIFICATE_CODE_ALPHABET).not.toContain(letter);
    }
    expect(new Set(CERTIFICATE_CODE_ALPHABET).size).toBe(32);
  });

  it('prints as three groups of four', () => {
    expect(formatCertificateCode('ABCD2345WXYZ')).toBe('ABCD-2345-WXYZ');
  });

  it('accepts a code however it was typed: lower case, the printed dashes, spaces', () => {
    for (const typed of ['abcd-2345-wxyz', ' ABCD 2345 WXYZ ', 'ABCD2345WXYZ', 'abcd-2345 wxyz']) {
      expect(certificateCodeSchema.parse(typed)).toBe('ABCD2345WXYZ');
    }
  });

  it('refuses anything that cannot be a code', () => {
    for (const typed of [
      '',
      'ABCD2345WXY',
      'ABCD2345WXYZ0',
      'ABCD2345WXYI',
      'ABCD2345WXYO',
      'ABCD-2345-WX!Z',
      '../../etc/pass',
    ]) {
      expect(certificateCodeSchema.safeParse(typed).success).toBe(false);
    }
    expect(CERTIFICATE_CODE_LENGTH).toBe(12);
  });
});
