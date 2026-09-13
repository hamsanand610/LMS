import { baseConfig, moduleBoundaryRules } from '@lms/config/eslint';

export default [
  { ignores: ['dist/**', 'src/generated/**', 'coverage/**'] },
  ...baseConfig,
  ...moduleBoundaryRules('src/modules'),
  {
    files: ['**/*.ts'],
    // Nest reads constructor parameter types at runtime (emitDecoratorMetadata); tell the type-import rule.
    languageOptions: {
      parserOptions: { emitDecoratorMetadata: true, experimentalDecorators: true },
    },
    rules: {
      // Nest decorators rely on parameter properties and metadata; these are fine here.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    // Operational entry points talk to a terminal.
    files: ['src/cli/**/*.ts', 'src/worker.ts'],
    rules: { 'no-console': 'off' },
  },
];
