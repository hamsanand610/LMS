/**
 * Clears a failed-login lockout for one account (local troubleshooting only).
 *   pnpm --filter @lms/api exec tsx scripts/unlock-account.ts <email>
 */
import { createStandaloneContext } from '../src/core/prisma/standalone.js';

const email = process.argv[2];
if (!email) throw new Error('Usage: unlock-account.ts <email>');
const { prisma } = createStandaloneContext();
const result = await prisma.user.updateMany({
  where: { email: email.toLowerCase() },
  data: { failedLoginCount: 0, lockedUntil: null },
});
console.log(`Cleared the lockout on ${result.count} account(s).`);
await prisma.$disconnect();
