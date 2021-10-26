module.exports = {
  root: true,
  extends: ['plugin:@typescript-eslint/recommended', 'prettier', 'plugin:prettier/recommended'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    'prefer-const': 1,
    'prettier/prettier': 1,
    '@typescript-eslint/explicit-module-boundary-types': 0,
  },
  parser: '@typescript-eslint/parser',
};
