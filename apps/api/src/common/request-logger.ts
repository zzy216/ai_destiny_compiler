import type { RequestHandler } from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';

export interface RequestLogFields {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}

export const REQUEST_LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.headers["x-api-key"]',
  'req.headers["x-auth-token"]',
  'req.headers["proxy-authorization"]',
];

export function buildRequestLog(fields: RequestLogFields): RequestLogFields {
  return {
    method: fields.method,
    path: fields.path,
    statusCode: fields.statusCode,
    durationMs: fields.durationMs,
  };
}

export function createRequestLogger(): RequestHandler {
  const level = process.env.NODE_ENV === 'test' ? 'silent' : process.env.LOG_LEVEL ?? 'info';

  return pinoHttp({
    logger: pino({
      level,
      redact: { paths: REQUEST_LOG_REDACT_PATHS, censor: '[Redacted]' },
    }),
    customSuccessObject: (request, response, responseTime) =>
      buildRequestLog({
        method: request.method ?? 'UNKNOWN',
        path: request.url ?? '/',
        statusCode: response.statusCode,
        durationMs: Number(responseTime),
      }),
    customErrorObject: (request, response, error, responseTime) => ({
      ...buildRequestLog({
        method: request.method ?? 'UNKNOWN',
        path: request.url ?? '/',
        statusCode: response.statusCode,
        durationMs: Number(responseTime),
      }),
      error: error.message,
    }),
  }) as unknown as RequestHandler;
}
