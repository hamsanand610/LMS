import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/** Unit tests for web helpers and (later) components; browser journeys live in e2e/ (Playwright). */
export default defineConfig({
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
  test: {
    include: ['src/**/*.spec.{ts,tsx}'],
    environment: 'node',
  },
});
