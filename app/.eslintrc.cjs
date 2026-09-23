/**
 * Root ESLint config for the Jobcore monorepo.
 * Flat-file (.cjs) so it loads without ESM interop under Node 20+.
 * Per-package configs may extend this; none should re-declare the base rules.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  settings: { react: { version: 'detect' } },
  env: { es2022: true, node: true },
  ignorePatterns: ['node_modules', 'dist', '.expo', '*.config.js'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'react-native',
            importNames: ['Text'],
            message: "Import Text from '@jobcore/ui' (packages/ui: './Text').",
          },
        ],
      },
    ],
  },
  overrides: [
    // FX-36: packages/ui/src/Text.tsx is the sole legitimate importer of
    // react-native's Text — it's the component being wrapped — so the
    // repo-wide no-restricted-imports guard above is turned off just here.
    {
      files: ['packages/ui/src/Text.tsx'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
    // S0.4: field-tech/src/domain/transition.ts is the module's sole
    // `applyTransition` call site (see S0.5) — everything else under
    // modules/field-tech/src must go through `transitionJob` instead of
    // importing the state machine directly, so job-status changes never
    // scatter into raw `status === '...'` comparisons.
    {
      files: ['modules/field-tech/src/**/*.{ts,tsx}'],
      excludedFiles: ['modules/field-tech/src/domain/transition.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@jobcore/core',
                importNames: ['applyTransition'],
                message:
                  'field-tech must call transitionJob() from domain/transition.ts, not applyTransition directly — see Master Spec state machine isolation rule.',
              },
            ],
          },
        ],
      },
    },
    // P3f.1 (AC-4): admin-finance/src/domain/transition.ts is the module's
    // sole `applyTransition` call site — everything else under
    // modules/admin-finance/src must go through `transitionJob` instead of
    // importing the state machine directly, so job-status changes never
    // scatter into raw `status === '...'` comparisons.
    {
      files: ['modules/admin-finance/src/**/*.{ts,tsx}'],
      excludedFiles: ['modules/admin-finance/src/domain/transition.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@jobcore/core',
                importNames: ['applyTransition'],
                message:
                  'Import transitionJob from modules/admin-finance/src/domain/transition.ts instead — it is the sole applyTransition call site (P3f.1, AC-4).',
              },
            ],
          },
        ],
      },
    },
  ],
};
