// Unit tests (src/**/*.spec.ts). No database.
//
// Why `compiler` is pinned: ts-jest is hoisted to the monorepo root, where another
// workspace pulls TypeScript 6. Resolved from there, ts-jest compiled this project with
// TS 6, which rejects this tsconfig (TS5011 implicit rootDir, TS5101 deprecated baseUrl) —
// the cause of the failing e2e suite found in the 2026-09-29 audit. Pinning to this
// package's own TypeScript keeps tests on the same compiler as `tsc`/`nest build`.
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\.spec\.ts$',
  transform: {
    '^.+\.(t|j)s$': [
      'ts-jest',
      { tsconfig: '<rootDir>/../tsconfig.spec.json', compiler: require.resolve('typescript') },
    ],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
