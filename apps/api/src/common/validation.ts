import { AsyncLocalStorage } from 'async_hooks';
import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
  ValidationPipe,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

// Marketplace endpoints strip unknown properties silently (older mobile builds may send
// extra fields). Admin and legacy-admin endpoints are strict: an unexpected property is a
// 400, so a typo'd or injected field can never be silently dropped on a privileged
// mutation.
//
// Why path-based via AsyncLocalStorage: Nest runs global pipes BEFORE controller-scoped
// pipes, so a lenient global pipe would already have stripped the extra fields by the
// time a controller-level strict pipe looked (found by moderation.e2e-spec.ts). Deciding
// by path in one global pipe also means a new admin controller can't forget to opt in.
const store = new AsyncLocalStorage<{ strict: boolean }>();
const STRICT_PATH = /^\/(admin|legacy-admin)(\/|$)/;

export function validationModeMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  store.run({ strict: STRICT_PATH.test(req.path) }, next);
}

const lenient = new ValidationPipe({ whitelist: true, transform: true });
const strict = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

@Injectable()
export class GhorValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    return (store.getStore()?.strict ? strict : lenient).transform(
      value,
      metadata,
    );
  }
}
