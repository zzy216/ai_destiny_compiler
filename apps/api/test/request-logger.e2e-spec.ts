import { buildRequestLog, createRequestLogger } from '../src/common/request-logger';

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
});
