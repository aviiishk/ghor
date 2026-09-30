const { execSync } = require('child_process');
const path = require('path');
const { testDatabaseUrl } = require('./test-db');

// Apply the committed migrations to the disposable test database (non-destructive and
// idempotent — `prisma migrate deploy`, exactly what production runs). Suites then clear
// their own data with TRUNCATE (resetDatabase in helpers/harness.ts). For a from-scratch
// schema, recreate the container (see test/README.md); CI always starts from an empty
// Postgres service container.
module.exports = async () => {
  const url = testDatabaseUrl();
  execSync('npx prisma migrate deploy', {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: 'pipe',
  });
};
