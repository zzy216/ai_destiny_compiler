import type { RequestHandler } from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';

export interface RequestLogFields {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}

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
    logger: pino({ level }),
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
