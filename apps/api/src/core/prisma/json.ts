import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Narrows an already-validated plain value to the type Prisma accepts for a JSON column.
 * Every caller validates with a Zod schema first, so the cast asserts something the schema
 * has just proved: the value is JSON-serialisable.
 */
export function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
