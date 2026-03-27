/**
 * ESLint configuration for the Liminal monorepo.
 * Applies strict TypeScript rules across all packages and apps.
 */

import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // ── Global ignores ──────────────────────────────────────────────────────
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.d.ts',
      'apps/desktop/**',
      // Web app uses Next.js built-in ESLint config
      'apps/web/**',
    ],
  },

  // ── Base JS rules ───────────────────────────────────────────────────────
  js.configs.recommended,

  // ── TypeScript rules (all .ts/.tsx files) ──────────────────────────────
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // ── TypeScript strict ─────────────────────────────────────────────
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // Note: these rules require type information (parserOptions.project)
      // Disabled here for performance — enable per-package if needed
      // '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      // '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

      // ── General code quality ─────────────────────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-throw-literal': 'error',

      // ── Security ─────────────────────────────────────────────────────
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // ── Disable base rules that conflict with TS versions ────────────
      'no-unused-vars': 'off',
    },
  },

  // ── Test files — relax some rules ──────────────────────────────────────
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // ── React/Next.js frontend ──────────────────────────────────────────────
  {
    files: ['apps/web/**/*.tsx', 'apps/web/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
