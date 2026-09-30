import path from "path";

// Throwaway values for the browser test only. The database is a local disposable Postgres
// (docker, see apps/api/test/README.md); the harness refuses any non-local host.
const DEFAULT_DB = "postgresql://ghor:ghor_test@localhost:55432/ghor_test";
const dbUrl = process.env.TEST_DATABASE_URL || DEFAULT_DB;
const host = new URL(dbUrl).hostname;
if (!["localhost", "127.0.0.1", "::1", "postgres"].includes(host)) {
  throw new Error(`Refusing to run the admin browser test against "${host}" (local/CI databases only)`);
}

const apiPort = 3310;
const adminPort = 3311;
// bff-origin.spec.ts runs a reverse proxy here in front of the console.
const proxyPort = 3312;
const proxyOrigin = `http://127.0.0.1:${proxyPort}`;
const bff = "e2e-bff-proxy-secret-0123456789abcdef0123";

export const E2E = {
  dbUrl,
  apiPort,
  adminPort,
  proxyPort,
  proxyOrigin,
  apiUrl: `http://localhost:${apiPort}`,
  adminUrl: `http://localhost:${adminPort}`,
  smsSinkDir: path.join(__dirname, "..", "test-results", "sms-sink"),
  adminPhone: "+919900000555",
  listingTitle: "Playwright review listing",
  get apiEnv(): Record<string, string> {
    return {
      NODE_ENV: "development",
      PORT: String(apiPort),
      DATABASE_URL: dbUrl,
      DIRECT_URL: dbUrl,
      JWT_ACCESS_SECRET: "e2e-user-access-secret-0123456789abcdef0123456",
      JWT_REFRESH_SECRET: "e2e-user-refresh-secret-0123456789abcdef012345",
      JWT_ADMIN_ACCESS_SECRET: "e2e-admin-access-secret-0123456789abcdef01234",
      ADMIN_TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString("base64"),
      ADMIN_RECOVERY_CODE_PEPPER: "e2e-recovery-pepper-0123456789abcdef0123456789",
      IP_HASH_KEY: "e2e-ip-hash-key",
      BFF_PROXY_SECRET: bff,
      ADMIN_ALLOWED_ORIGINS: `http://localhost:${adminPort}`,
      CORS_ALLOWED_ORIGINS: "http://localhost:3000",
      ADMIN_PHONES: "",
      JOBS_ENABLED: "false",
      SMS_API_URL: "",
      // Test-only OTP sink (the API refuses to start in production with this set).
      SMS_TEST_SINK_DIR: path.join(__dirname, "..", "test-results", "sms-sink"),
      CLOUDINARY_CLOUD_NAME: "ghortest"
    };
  },
  get adminEnv(): Record<string, string> {
    return {
      ADMIN_API_URL: `http://localhost:${apiPort}`,
      BFF_PROXY_SECRET: bff,
      NEXT_PUBLIC_ADMIN_ENV: "development",
      // `next start` runs as production, so the trusted origin must be configured.
      ADMIN_ALLOWED_ORIGINS: `http://localhost:${adminPort},${proxyOrigin}`,
      NEXT_TELEMETRY_DISABLED: "1"
    };
  }
};
