import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');

import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { HealthController } from '../src/health/health.controller';
import {
  EnvironmentValidationError,
  validateEnvironment,
} from '../src/config/environment';

describe('foundation engineering', () => {
  describe('environment validation', () => {
    it('normalizes valid non-database test configuration', () => {
      expect(
        validateEnvironment({
          NODE_ENV: 'test',
          PORT: '3100',
          DATABASE_ENABLED: 'false',
        }),
      ).toMatchObject({
        nodeEnv: 'test',
        port: 3100,
        databaseEnabled: false,
      });
    });

    it('rejects an enabled database without a real password', () => {
      expect(() =>
        validateEnvironment({
          NODE_ENV: 'development',
          DATABASE_ENABLED: 'true',
          DB_HOST: '127.0.0.1',
          DB_PORT: '5432',
          DB_USERNAME: 'destiny_compiler',
          DB_PASSWORD: 'replace-me',
          DB_NAME: 'destiny_compiler',
        }),
      ).toThrow(EnvironmentValidationError);
    });

    it('accepts a complete production database configuration', () => {
      expect(
        validateEnvironment({
          NODE_ENV: 'production',
          PORT: '443',
          DATABASE_ENABLED: 'true',
          DB_HOST: 'db.internal',
          DB_PORT: '5433',
          DB_USERNAME: 'app',
          DB_PASSWORD: 'provided-outside-the-repository',
          DB_NAME: 'destiny',
          DB_SCHEMA: 'app',
          DB_SSL: 'true',
          DB_LOGGING: 'false',
          MODEL_CREDENTIAL_MASTER_KEY: Buffer.alloc(32, 9).toString('base64'),
          MODEL_CREDENTIAL_KEY_VERSION: '4',
        }),
      ).toMatchObject({
        nodeEnv: 'production',
        port: 443,
        databaseEnabled: true,
        modelCredentialKeyVersion: 4,
        database: { host: 'db.internal', port: 5433, ssl: true, logging: false },
      });
    });

    it('reports malformed ports, booleans, environment and encryption key', () => {
      expect(() =>
        validateEnvironment({
          NODE_ENV: 'staging',
          PORT: '0',
          DATABASE_ENABLED: 'sometimes',
          DB_PORT: 'not-a-port',
          DB_SSL: 'sometimes',
          DB_LOGGING: 'sometimes',
          MODEL_CREDENTIAL_MASTER_KEY: 'not-base64',
          MODEL_CREDENTIAL_KEY_VERSION: '0',
        }),
      ).toThrow(EnvironmentValidationError);
    });
  });

  describe('health check', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const testingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = testingModule.createNestApplication();
      configureApplication(app);
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('reports the API as healthy when the database is disabled', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          status: 'ok',
          database: 'disabled',
        },
      });
      expect(response.body.data.timestamp).toEqual(expect.any(String));
    });

    it('reports database up and degraded states', async () => {
      const upController = new HealthController({
        query: jest.fn().mockResolvedValue([]),
      } as never);
      await expect(upController.check()).resolves.toMatchObject({ data: { status: 'ok', database: 'up' } });

      const downController = new HealthController({
        query: jest.fn().mockRejectedValue(new Error('database unavailable')),
      } as never);
      await expect(downController.check()).resolves.toMatchObject({ data: { status: 'degraded', database: 'down' } });
    });
  });
});
