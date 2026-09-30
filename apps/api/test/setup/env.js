const { testDatabaseUrl } = require('./test-db');

// The complete environment for the API under test. AppModule ignores .env when
// NODE_ENV=test, so nothing from a developer's local config (e.g. the shared Supabase dev
// database) can leak in. All secrets below are throwaway test values.
const url = testDatabaseUrl();
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: url,
  DIRECT_URL: url,
  JWT_ACCESS_SECRET: 'test-user-access-secret-0123456789abcdef0123456789',
  JWT_REFRESH_SECRET: 'test-user-refresh-secret-0123456789abcdef012345678',
  JWT_ADMIN_ACCESS_SECRET: 'test-admin-access-secret-0123456789abcdef01234567',
  ADMIN_TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  ADMIN_RECOVERY_CODE_PEPPER: 'test-recovery-pepper-0123456789abcdef0123456789',
  ADMIN_PHONES: '+919900000001',
  IP_HASH_KEY: 'test-ip-hash-key',
  BFF_PROXY_SECRET: 'test-bff-proxy-secret',
  ADMIN_ALLOWED_ORIGINS: 'http://admin.test',
  CORS_ALLOWED_ORIGINS: 'http://web.test',
  JOBS_ENABLED: 'false',
  // Off by default in the app (fail closed); enabled explicitly so the legacy suites run.
  LEGACY_ADMIN_ENABLED: 'true',
  GOOGLE_CLIENT_ID: '',
  SMS_API_URL: '',
  CLOUDINARY_CLOUD_NAME: 'ghortest',
});
