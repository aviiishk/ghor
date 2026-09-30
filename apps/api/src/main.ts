import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

// Security review 2026-09-26: .env.example ships JWT secrets of "change-me" — a deploy
// that copies it unchanged would let anyone forge access tokens. Phase 0 (2026-09-29)
// extends the same fail-fast rule to every admin-console secret and the origin lists.
function assertProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  const problems: string[] = [];
  const strong = (key: string, min = 32) => {
    const value = process.env[key] ?? '';
    if (value.length < min || /change-me|placeholder/i.test(value)) {
      problems.push(`${key} must be a random secret of at least ${min} characters`);
    }
  };
  strong('JWT_ACCESS_SECRET');
  strong('JWT_REFRESH_SECRET');
  strong('JWT_ADMIN_ACCESS_SECRET');
  strong('ADMIN_RECOVERY_CODE_PEPPER');
  strong('IP_HASH_KEY');
  const secrets = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'JWT_ADMIN_ACCESS_SECRET'].map((k) => process.env[k]);
  if (new Set(secrets).size !== secrets.length) {
    problems.push('JWT_ACCESS_SECRET, JWT_REFRESH_SECRET and JWT_ADMIN_ACCESS_SECRET must all differ');
  }
  const totpKey = Buffer.from(process.env.ADMIN_TOTP_ENCRYPTION_KEY ?? '', 'base64');
  if (totpKey.length !== 32) problems.push('ADMIN_TOTP_ENCRYPTION_KEY must be 32 random bytes, base64-encoded');
  if (!process.env.ADMIN_ALLOWED_ORIGINS) problems.push('ADMIN_ALLOWED_ORIGINS must list the admin console origin(s)');
  if (!process.env.CORS_ALLOWED_ORIGINS) problems.push('CORS_ALLOWED_ORIGINS must list the marketplace web origin(s)');
  if (process.env.SMS_TEST_SINK_DIR) {
    problems.push('SMS_TEST_SINK_DIR is a test-only setting and must never be set in production');
  }
  if (problems.length) {
    throw new Error(`Refusing to start in production:\n - ${problems.join('\n - ')}`);
  }
}

async function bootstrap() {
  assertProductionConfig();
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
