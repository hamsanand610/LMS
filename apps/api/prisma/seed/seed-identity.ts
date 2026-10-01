/**
 * The sample institute's identity for seeded accounts. Every address is on a reserved `.example`
 * domain (RFC 2606), so a seeded account can never receive real mail.
 */
export const SEED_DOMAIN = 'siacademy.example';

/** `seedEmail('student01')` → `student01@siacademy.example`. */
export function seedEmail(localPart: string): string {
  return `${localPart}@${SEED_DOMAIN}`;
}
