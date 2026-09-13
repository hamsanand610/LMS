// Shared ESLint flat-config fragments for Node/TypeScript packages and the API.
// Consumers compose: [...baseConfig, ...moduleBoundaryRules(...)]
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export const baseConfig = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  prettier,
];

/**
 * Module boundary rule: code may import another module only through its public index
 * (e.g. `../users/index.js`), never its internals (services, repositories, controllers).
 * `modulesRoot` is the path prefix of the modules directory relative to the linted files.
 */
export function moduleBoundaryRules(modulesRoot = 'src/modules') {
  return [
    {
      files: [`${modulesRoot}/*/**/*.ts`],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '../*/services/*',
                  '../*/repositories/*',
                  '../*/controllers/*',
                  '../*/jobs/*',
                ],
                message:
                  'Import another module only through its public index (../<module>/index.js).',
              },
              {
                group: ['@lms/api/*'],
                message: 'Modules must not import app internals by package path.',
              },
            ],
          },
        ],
      },
    },
  ];
}
