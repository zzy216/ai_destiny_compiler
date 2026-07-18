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

  it('requires a model selection when creating a conversation', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .send({ title: '职业选择' })
      .expect(400);

    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'modelConfigId' }),
      ]),
    );
  });

  it('requires a UUID idempotency key when sending a message', async () => {
    const response = await request(app.getHttpServer())
      .post(
        '/api/v1/conversations/6cdbbfa1-7674-4b53-a2d9-a38af20aa1b0/messages',
      )
      .send({ content: '我应该先做什么？', idempotencyKey: 'retry-1' })
      .expect(400);

    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'idempotencyKey' }),
      ]),
    );
  });

  it('rejects insecure custom model base URLs at the DTO boundary', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/custom-models')
      .send({
        displayName: '本地测试模型',
        protocol: 'openai_compatible',
        baseUrl: 'http://127.0.0.1:11434/v1',
        modelName: 'example-model',
        apiKey: 'secret-value',
      })
      .expect(400);

    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'baseUrl' }),
      ]),
    );
  });

  it('routes valid requests to every contract placeholder', async () => {
    const resourceId = '6cdbbfa1-7674-4b53-a2d9-a38af20aa1b0';
    const idempotencyKey = '83b5f9f2-f829-4a8e-b82b-9d508973f220';
    const refreshToken = 'r'.repeat(32);
    const password = 'correct-horse-battery-staple';
    const calls: Array<{
      method: 'get' | 'post' | 'patch' | 'delete';
      path: string;
      body?: Record<string, unknown>;
    }> = [
      {
        method: 'post',
        path: '/api/v1/auth/login',
        body: { identifier: 'user@example.com', password },
      },
      {
        method: 'post',
        path: '/api/v1/auth/register',
        body: {
          invitationCode: 'invite-code-2026',
          email: 'user@example.com',
          password,
        },
      },
      {
        method: 'post',
        path: '/api/v1/auth/register',
        body: {
          invitationCode: 'invite-code-2026',
          username: 'destiny_user',
          password,
        },
      },
      {
        method: 'post',
        path: '/api/v1/auth/refresh',
        body: { refreshToken },
      },
      {
        method: 'post',
        path: '/api/v1/auth/logout',
        body: { refreshToken },
      },
      {
        method: 'post',
        path: '/api/v1/auth/change-password',
        body: { currentPassword: password, newPassword: `${password}-new` },
      },
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
    ];

    for (const call of calls) {
      const pendingRequest = request(app.getHttpServer())[call.method](call.path);
      if (call.body) {
        pendingRequest.send(call.body);
      }

      const response = await pendingRequest.expect(501);
      expect(response.body).toMatchObject({
        error: { code: 'contract_not_implemented' },
      });
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
