import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { requestIdMiddleware } from './common/request-context';
import { webCorsOrigin } from './common/cors';
import {
  GhorValidationPipe,
  validationModeMiddleware,
} from './common/validation';

// Shared by main.ts and the e2e test harness, so tests exercise the same error handling,
// request ids, validation and CORS policy as production.
export function configureApp(app: INestApplication) {
  // Security headers (nosniff, frame-deny, HSTS, no X-Powered-By, …). The API serves JSON
  // only, so helmet's defaults are safe as-is.
  app.use(helmet());
  app.use(requestIdMiddleware);
  app.use(validationModeMiddleware);
  // Explicit allowlist (never "*"). Admin origins are deliberately NOT added here: the
  // admin console talks to this API only through its own server-side BFF.
  app.enableCors({ origin: webCorsOrigin, credentials: false, maxAge: 600 });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new GhorValidationPipe());
}
