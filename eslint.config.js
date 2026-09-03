import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'reference/**'],
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['packages/**/*.ts', 'apps/**/*.ts', 'apps/**/*.tsx'],
  })),
  {
    files: ['packages/**/*.ts', 'apps/**/*.ts', 'apps/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
);
