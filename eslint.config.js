import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['dist/**', 'node_modules/**', '.vite/**'],
  },

  js.configs.recommended,
  tseslint.configs.recommended,
  unicorn.configs.recommended,

  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/filename-case': 'off',
    },
  },

  // Скрипты сборки данных: в выходном JSON null означает «значения нет» и нужен шаблонам
  {
    files: ['tools/**/*.mjs'],
    rules: {
      'unicorn/no-null': 'off',
    },
  },

  eslintConfigPrettier,
);
