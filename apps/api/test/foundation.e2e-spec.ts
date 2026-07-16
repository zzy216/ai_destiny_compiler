import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');

import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
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
  });
});
