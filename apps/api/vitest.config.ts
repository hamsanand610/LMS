import { defineConfig } from 'vitest/config';

/**
 * Unit tests live next to the code (`*.spec.ts`), including the seeded content's own checks;
 * API tests use vitest.config.e2e.ts.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'prisma/seed/**/*.spec.ts'],
  },
});
