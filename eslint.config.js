// Flat ESLint config (ESLint 9+). Lints the TypeScript sources with
// typescript-eslint's type-checked rule set, so bugs the compiler tolerates
// but that are almost always mistakes — floating promises, unsafe `any` flows,
// bad string concatenation — get flagged too.
//
// Type-aware linting needs the TypeScript compiler's JS API, which the TS 7
// native compiler does not yet expose; the project therefore pins TypeScript
// 6.0.x (see package.json) until typescript-eslint supports TS 7.1+.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    // dist/ is build output; node_modules/ is deps. Never lint them.
    ignores: ['dist/**', 'node_modules/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    // TypeScript sources: enable type-aware linting rooted at tsconfig.json.
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        chrome: 'readonly',
      },
    },
    rules: {
      // A timer handle read (via clearTimeout) inside a closure before its single
      // assignment is a legitimate forward declaration, not a missed `const`.
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
    },
  },

  {
    // Test files run in Node and import the compiled dist/ output as plain JS,
    // so they are not part of the TS program — lint them without type info.
    files: ['test/**/*.js'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  {
    // Build/tooling scripts: Node ESM, not part of the TS program.
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
