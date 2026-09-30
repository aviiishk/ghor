// End-to-end tests (test/**/*.e2e-spec.ts) against a REAL, DISPOSABLE Postgres.
// See test/README.md. Same compiler pinning rationale as ../jest.config.js.
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testRegex: 'test/.*\.e2e-spec\.ts$',
  testEnvironment: 'node',
  transform: {
    '^.+\.(t|j)s$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tsconfig.spec.json', compiler: require.resolve('typescript') },
    ],
  },
  globalSetup: '<rootDir>/test/setup/global-setup.js',
  setupFiles: ['<rootDir>/test/setup/env.js'],
  testTimeout: 60_000,
  maxWorkers: 1,
};
