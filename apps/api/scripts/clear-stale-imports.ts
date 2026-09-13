/** Clears import jobs left queued or running by an interrupted process. */
import { createStandaloneContext } from '../src/core/prisma/standalone.js';

const { prisma } = createStandaloneContext();
const result = await prisma.importJob.updateMany({
  where: { status: { in: ['queued', 'running'] } },
  data: { status: 'failed', finishedAt: new Date() },
});
console.log(`Marked ${result.count} stale import job(s) failed.`);
await prisma.$disconnect();
