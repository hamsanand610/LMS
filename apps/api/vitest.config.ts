import { defineConfig } from 'vitest/config';

/** Unit tests live next to the code (`*.spec.ts`); API tests use vitest.config.e2e.ts. */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
});
