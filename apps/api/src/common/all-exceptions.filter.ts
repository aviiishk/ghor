import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import type { GhorRequest } from './request-context';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  code?: string;
  requestId?: string;
  [extra: string]: unknown;
}

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  410: 'Gone',
  422: 'Unprocessable Entity',
  423: 'Locked',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

// One place that decides what an error looks like on the wire. Guarantees: no stack
// traces, no Prisma internals (query text, constraint names, column names), no secrets —
// only a status, a human message, an optional stable `code`, and the request id so a
// report can be matched to server logs.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') throw exception;
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<GhorRequest>();
    const body = this.toBody(exception);
    body.requestId = req.requestId;

    if (body.statusCode >= 500) {
      this.logger.error(
        `${req.method} ${req.path} → ${body.statusCode} [${req.requestId}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    if (res.headersSent) return;
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return {
          statusCode: status,
          error: STATUS_TEXT[status] ?? 'Error',
          message: response,
        };
      }
      const r = response as Record<string, unknown>;
      // Keep the caller-facing fields Nest/our code put there (message, code, and any
      // explicitly attached context such as currentVersion), never anything else.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- statusCode is dropped on purpose
      const { statusCode: _statusCode, error, message, ...rest } = r;
      return {
        ...rest,
        statusCode: status,
        error:
          typeof error === 'string' ? error : (STATUS_TEXT[status] ?? 'Error'),
        message: (message as string | string[]) ?? exception.message,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2025': // record to update/delete not found
        case 'P2001':
          return this.simple(404, 'Not found', 'NOT_FOUND');
        case 'P2002': // unique constraint
          return this.simple(
            409,
            'This conflicts with an existing record',
            'UNIQUE_CONSTRAINT',
          );
        case 'P2003': // foreign key
        case 'P2014':
          return this.simple(
            409,
            'This record is referenced by other data',
            'REFERENCE_CONSTRAINT',
          );
        case 'P2000':
        case 'P2006':
        case 'P2007':
        case 'P2023':
          return this.simple(400, 'Invalid request data', 'INVALID_DATA');
        default:
          return this.simple(500, 'Internal server error', 'INTERNAL');
      }
    }
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return this.simple(400, 'Invalid request data', 'INVALID_DATA');
    }
    // Body-parser failures (malformed JSON, payload too large) carry a numeric status.
    const status = (exception as { status?: unknown })?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return this.simple(
        status,
        STATUS_TEXT[status] ?? 'Bad request',
        'BAD_REQUEST',
      );
    }
    return this.simple(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Internal server error',
      'INTERNAL',
    );
  }

  private simple(statusCode: number, message: string, code: string): ErrorBody {
    return {
      statusCode,
      error: STATUS_TEXT[statusCode] ?? 'Error',
      message,
      code,
    };
  }
}
