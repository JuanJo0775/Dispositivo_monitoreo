// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '.expo/**',
      '.harness/**',
      '.claude/**',
      '.opencode/**',
      'docs/**',
      'android/**',
      'ios/**',
    ],
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'tests/**/*.ts', 'tests/**/*.tsx'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
]);
