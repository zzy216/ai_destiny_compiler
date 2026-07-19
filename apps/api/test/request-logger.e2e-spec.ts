import { Writable } from 'node:stream';

import pino from 'pino';

import {
  REQUEST_LOG_REDACT_PATHS,
  buildRequestLog,
  createRequestLogger,
} from '../src/common/request-logger';

describe('request logger', () => {
  it('builds stable structured request fields', () => {
    expect(
      buildRequestLog({
        method: 'GET',
        path: '/api/health',
        statusCode: 200,
        durationMs: 12.5,
      }),
    ).toEqual({
      method: 'GET',
      path: '/api/health',
      statusCode: 200,
      durationMs: 12.5,
    });
  });

  it('creates a request logger middleware', () => {
    expect(typeof createRequestLogger()).toBe('function');
  });

  it('redacts sensitive request headers from JSON logs', async () => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });
    const logger = pino({
      level: 'info',
      redact: { paths: REQUEST_LOG_REDACT_PATHS, censor: '[Redacted]' },
    }, stream);

    logger.info({
      req: {
        headers: {
          authorization: 'Bearer access-token',
          cookie: 'session=refresh-token',
          'set-cookie': 'refresh=token',
          'x-api-key': 'model-key',
          'x-auth-token': 'auth-token',
          'proxy-authorization': 'Basic proxy-secret',
          accept: 'application/json',
        },
      },
    });
    await new Promise((resolve) => setImmediate(resolve));

    const log = JSON.parse(chunks.join(''));
    expect(log.req.headers).toMatchObject({
      authorization: '[Redacted]',
      cookie: '[Redacted]',
      'set-cookie': '[Redacted]',
      'x-api-key': '[Redacted]',
      'x-auth-token': '[Redacted]',
      'proxy-authorization': '[Redacted]',
      accept: 'application/json',
    });
    expect(chunks.join('')).not.toContain('access-token');
    expect(chunks.join('')).not.toContain('refresh-token');
    expect(chunks.join('')).not.toContain('model-key');
  });
});
