/** Ad-hoc check: prints every role with its permission bundle. `pnpm --filter @lms/api exec tsx scripts/show-roles.ts` */
import { createStandaloneContext } from '../src/core/prisma/standalone.js';

const { prisma } = createStandaloneContext();
const roles = await prisma.role.findMany({
  include: { permissions: { include: { permission: true } } },
  orderBy: { key: 'asc' },
});
for (const role of roles) {
  console.log(
    role.key.padEnd(24),
    String(role.permissions.length).padStart(3),
    role.permissions
      .map((p) => `${p.permission.key}:${p.scope}`)
      .sort()
      .join(' '),
  );
}
await prisma.$disconnect();
