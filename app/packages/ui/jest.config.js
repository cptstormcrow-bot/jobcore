/** Jest config for @jobcore/ui component tests (tests live in __tests__/, outside the tsc rootDir). */
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts?(x)'],
};
