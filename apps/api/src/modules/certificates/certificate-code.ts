import { randomInt } from 'node:crypto';
import { CERTIFICATE_CODE_ALPHABET, CERTIFICATE_CODE_LENGTH } from '@lms/shared';

/**
 * A new verification code: 12 characters of Crockford base32 from the system's secure random
 * source, about 60 bits. Codes are public by design (they are printed on the certificate), so
 * what protects them is that they cannot be guessed, and the verification endpoint is rate-limited.
 */
export function newCertificateCode(): string {
  let code = '';
  for (let i = 0; i < CERTIFICATE_CODE_LENGTH; i += 1) {
    code += CERTIFICATE_CODE_ALPHABET[randomInt(CERTIFICATE_CODE_ALPHABET.length)];
  }
  return code;
}
