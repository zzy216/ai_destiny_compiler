import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');

import { AppModule } from '../src/app.module';
import {
  configureApplication,
  createOpenApiDocument,
  setupOpenApi,
} from '../src/bootstrap';

describe('MVP API contract', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = testingModule.createNestApplication();
    configureApplication(app);
    setupOpenApi(app, createOpenApiDocument(app));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('publishes the first auth, model, and conversation paths in OpenAPI', () => {
    const document = createOpenApiDocument(app);
    const paths = Object.keys(document.paths);

    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/v1/auth/login',
        '/api/v1/auth/register',
        '/api/v1/auth/refresh',
        '/api/v1/auth/logout',
        '/api/v1/auth/change-password',
        '/api/v1/models',
        '/api/v1/custom-models',
        '/api/v1/custom-models/{id}',
        '/api/v1/custom-models/{id}/publish',
        '/api/v1/custom-models/{id}/disable',
        '/api/v1/custom-models/{id}/test',
        '/api/v1/admin/models',
        '/api/v1/admin/models/{id}',
        '/api/v1/admin/models/{id}/publish',
        '/api/v1/admin/models/{id}/disable',
        '/api/v1/admin/models/{id}/test',
        '/api/v1/admin/models/{id}/set-default',
        '/api/v1/admin/coach-configs',
        '/api/v1/admin/coach-configs/{id}',
        '/api/v1/admin/coach-configs/{id}/publish',
        '/api/v1/admin/knowledge-cards',
        '/api/v1/admin/knowledge-cards/{id}',
        '/api/v1/admin/knowledge-cards/{id}/publish',
        '/api/v1/admin/agent-runs',
        '/api/v1/admin/agent-runs/{id}',
        '/api/v1/conversations',
        '/api/v1/conversations/{id}/messages',
        '/api/v1/action-cards',
        '/api/v1/action-cards/{id}',
        '/api/v1/action-cards/{id}/execution-records',
        '/api/v1/reviews',
        '/api/v1/memories',
        '/api/v1/memories/{id}',
      ]),
    );
  });

  it('documents bearer auth and the standard validation error schema', () => {
    const document = createOpenApiDocument(app);

    expect(document.components?.securitySchemes).toHaveProperty('bearer');
    expect(document.components?.schemas).toHaveProperty(
      'ApiErrorResponseDto',
    );
    expect(document.components?.schemas).toHaveProperty(
      'ValidationErrorDetailDto',
    );
  });

  it('serves the generated OpenAPI JSON from the documented URL', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    expect(response.body.info).toMatchObject({
      title: 'Destiny Compiler API',
      version: '0.1.0',
    });
    expect(response.body.paths).toHaveProperty('/api/v1/auth/login');
  });

  it('does not expose model credentials through response schemas', () => {
    const document = createOpenApiDocument(app);
    const schemas = document.components?.schemas ?? {};
    const responseSchemaNames = [
      'ModelSummaryDto',
      'ModelVersionDto',
      'ModelDetailDto',
      'ModelSnapshotDto',
      'ConversationDto',
    ];
    const serializedSchemas = JSON.stringify(
      Object.fromEntries(
        responseSchemaNames.map((schemaName) => [
          schemaName,
          schemas[schemaName],
        ]),
      ),
    );

    expect(serializedSchemas).not.toMatch(
      /apiKey|ciphertext|authTag|refreshTokenHash|passwordHash/,
    );
    expect(serializedSchemas).toContain('hasCredential');
    expect(serializedSchemas).toContain('secretHint');
  });

  it('rejects an invalid login request with the unified error envelope', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: '', password: 'short' })
      .expect(400);

    expect(response.body).toMatchObject({
      error: {
        code: 'validation_error',
        message: 'Request validation failed',
      },
    });
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'identifier' }),
        expect.objectContaining({ field: 'password' }),
      ]),
    );
  });

  it('rejects unknown request properties', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: 'user@example.com',
        password: 'correct-horse-battery-staple',
        role: 'admin',
      })
      .expect(400);

    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'role', code: 'not_allowed' }),
      ]),
    );
  });

  it('requires authentication before validating protected conversation requests', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .send({ title: '职业选择' })
      .expect(401);

    expect(response.body.error).toMatchObject({ code: 'request_failed' });
  });

  it('requires authentication before accepting protected message requests', async () => {
    const response = await request(app.getHttpServer())
      .post(
        '/api/v1/conversations/6cdbbfa1-7674-4b53-a2d9-a38af20aa1b0/messages',
      )
      .send({ content: '我应该先做什么？', idempotencyKey: 'retry-1' })
      .expect(401);

    expect(response.body.error).toMatchObject({ code: 'request_failed' });
  });

  it('requires authentication before validating protected custom model requests', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/custom-models')
      .send({
        displayName: '本地测试模型',
        protocol: 'openai_compatible',
        baseUrl: 'http://127.0.0.1:11434/v1',
        modelName: 'example-model',
        apiKey: 'secret-value',
      })
      .expect(401);

    expect(response.body.error).toMatchObject({ code: 'request_failed' });
  });

  it('requires authentication for protected model and admin paths', async () => {
    const resourceId = '6cdbbfa1-7674-4b53-a2d9-a38af20aa1b0';
    const calls: Array<{
      method: 'get' | 'post' | 'patch' | 'delete';
      path: string;
      body?: Record<string, unknown>;
    }> = [
      { method: 'get', path: '/api/v1/models?page=1&perPage=20' },
      { method: 'get', path: '/api/v1/custom-models?page=1&perPage=20' },
      {
        method: 'post',
        path: '/api/v1/custom-models',
        body: {
          displayName: '我的 API 模型',
          protocol: 'openai_compatible',
          baseUrl: 'https://api.example.com/v1',
          modelName: 'example-model',
        },
      },
      {
        method: 'patch',
        path: `/api/v1/custom-models/${resourceId}`,
        body: { displayName: '更新后的模型' },
      },
      { method: 'delete', path: `/api/v1/custom-models/${resourceId}` },
      { method: 'post', path: `/api/v1/custom-models/${resourceId}/publish` },
      { method: 'post', path: `/api/v1/custom-models/${resourceId}/disable` },
      { method: 'post', path: `/api/v1/custom-models/${resourceId}/test` },
      { method: 'get', path: '/api/v1/admin/models?page=1&perPage=20' },
      {
        method: 'post',
        path: '/api/v1/admin/models',
        body: {
          slug: 'primary-model',
          displayName: '主模型',
          modelType: 'api',
          protocol: 'openai_compatible',
          baseUrl: 'https://api.example.com/v1',
          modelName: 'example-model',
        },
      },
      { method: 'get', path: `/api/v1/admin/models/${resourceId}` },
      {
        method: 'patch',
        path: `/api/v1/admin/models/${resourceId}`,
        body: { displayName: '主模型 v2' },
      },
      { method: 'delete', path: `/api/v1/admin/models/${resourceId}` },
      { method: 'post', path: `/api/v1/admin/models/${resourceId}/publish` },
      { method: 'post', path: `/api/v1/admin/models/${resourceId}/disable` },
      { method: 'post', path: `/api/v1/admin/models/${resourceId}/test` },
      {
        method: 'post',
        path: `/api/v1/admin/models/${resourceId}/set-default`,
      },
      { method: 'get', path: '/api/v1/action-cards?page=1&perPage=20' },
      { method: 'get', path: `/api/v1/action-cards/${resourceId}` },
      { method: 'get', path: `/api/v1/action-cards/${resourceId}/execution-records` },
      {
        method: 'post',
        path: `/api/v1/action-cards/${resourceId}/execution-records`,
        body: { result: 'completed' },
      },
      { method: 'get', path: '/api/v1/reviews?page=1&perPage=20' },
      {
        method: 'post',
        path: '/api/v1/reviews',
        body: { reviewType: 'daily', summary: '今日完成一次行动。' },
      },
      { method: 'get', path: '/api/v1/memories?page=1&perPage=20' },
      {
        method: 'post',
        path: '/api/v1/memories',
        body: { category: 'preference', content: '偏好早上处理深度工作' },
      },
      { method: 'delete', path: `/api/v1/memories/${resourceId}` },
    ];

    for (const call of calls) {
      const pendingRequest = request(app.getHttpServer())[call.method](call.path);
      if (call.body) {
        pendingRequest.send(call.body);
      }

      const response = await pendingRequest.expect(401);
      expect(response.body).toMatchObject({ error: { code: 'request_failed' } });
    }
  });

  it('wraps framework 404 errors in the unified error envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/not-found')
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: 'request_failed',
        message: 'Request failed',
      },
    });
  });
});
