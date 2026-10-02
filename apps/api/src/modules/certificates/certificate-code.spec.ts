import { certificateCodeSchema, CERTIFICATE_CODE_ALPHABET } from '@lms/shared';
import { describe, expect, it } from 'vitest';
import { newCertificateCode } from './certificate-code.js';

describe('new certificate codes (ADR-0022)', () => {
  it('are twelve characters of the code alphabet, and pass the public check', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = newCertificateCode();
      expect(code).toHaveLength(12);
      for (const character of code) expect(CERTIFICATE_CODE_ALPHABET).toContain(character);
      expect(certificateCodeSchema.parse(code)).toBe(code);
    }
  });

  it('do not repeat', () => {
    const codes = new Set(Array.from({ length: 5000 }, () => newCertificateCode()));
    expect(codes.size).toBe(5000);
  });

  it('use the whole alphabet, so none of its characters is wasted', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i += 1)
      for (const character of newCertificateCode()) seen.add(character);
    expect(seen.size).toBe(CERTIFICATE_CODE_ALPHABET.length);
  });
});
