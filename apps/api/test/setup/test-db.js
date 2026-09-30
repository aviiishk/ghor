// The ONLY place the e2e test database URL is decided. Refuses anything that isn't an
// obviously local/CI database: e2e tests truncate every table.
const DEFAULT_URL = 'postgresql://ghor:ghor_test@localhost:55432/ghor_test';
const SAFE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres']);

function testDatabaseUrl() {
  const url = process.env.TEST_DATABASE_URL || DEFAULT_URL;
  const host = new URL(url).hostname;
  if (!SAFE_HOSTS.has(host) && process.env.ALLOW_REMOTE_TEST_DB !== '1') {
    throw new Error(
      `Refusing to run e2e tests against "${host}": TEST_DATABASE_URL must point at a local ` +
        'or CI database (tests truncate every table).',
    );
  }
  return url;
}

module.exports = { testDatabaseUrl };
