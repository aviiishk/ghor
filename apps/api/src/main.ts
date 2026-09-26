import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// Security review 2026-09-26: .env.example ships JWT secrets of "change-me" — a deploy
// that copies it unchanged would let anyone forge access tokens (including role:admin
// claims for the socket gateway). Refuse to start in production with weak secrets.
function assertProductionSecrets() {
  if (process.env.NODE_ENV !== 'production') return;
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = process.env[key] ?? '';
    if (value.length < 32 || /change-me/i.test(value)) {
      throw new Error(
        `${key} must be a random secret of at least 32 characters in production`,
      );
    }
  }
  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }
}

async function bootstrap() {
  assertProductionSecrets();
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
