// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * ESLint for the SPA.
 *
 * SCOPED TO WHAT A TYPE CHECKER CANNOT ALREADY SEE. `tsc -b` runs on every
 * build and catches type errors, so this config deliberately does not duplicate
 * it. What it adds is the class of mistake TypeScript is happy with and a
 * reviewer is not: an unused import, a `case` that falls through, a hook whose
 * dependency array quietly disagrees with its body.
 *
 * NOT TYPE-AWARE, ON PURPOSE. typescript-eslint's type-checked presets need a
 * full program per lint run, which on this repository costs more than the build
 * itself. The rules below are syntactic; the type-level guarantees come from
 * `npm run build`, which is where they belong.
 *
 * WARN, NOT ERROR, FOR THE STYLISTIC RULES. This config is being added to a
 * codebase that has lived without one, so anything that would fail the whole
 * lint run over pre-existing style would make the command useless on the day it
 * arrives — nobody runs a linter that always exits 1. Correctness rules stay at
 * error; taste stays at warn, and `--max-warnings` can be tightened later once
 * the backlog is worked down.
 */
export default tseslint.config(
  {
    // Build output, dependencies and generated contract types. Linting a
    // generated file produces findings nobody can act on without regenerating.
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.config.js', 'scripts/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      /*
       * `any` is load-bearing in this codebase and removing it is not this
       * change's job. api/client.ts returns Promise<any> by design — the
       * response shape is the server's, validated at the screen — and every
       * caller inherits it. Flagging each one would bury real findings under
       * hundreds of hits nobody is going to act on in this pass.
       */
      '@typescript-eslint/no-explicit-any': 'off',

      // An unused variable is either dead code or a bug. `_`-prefixed names are
      // the established way to say "deliberately discarded" and are honoured.
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],

      // Correctness, not taste: each of these is a defect wherever it appears.
      'no-fallthrough': 'error',
      'no-unsafe-optional-chaining': 'error',
      'no-constant-binary-expression': 'error',
      eqeqeq: ['error', 'smart'],

      // A hook dependency array that disagrees with its body is the single most
      // common source of stale data on these screens.
      'react-hooks/exhaustive-deps': 'warn',

      // Left to the test runner's own globals rather than banned outright.
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      // Test fixtures load JSON through require(), which predates this config.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
