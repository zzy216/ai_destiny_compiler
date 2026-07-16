import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import {
  configureApplication,
  createOpenApiDocument,
  setupOpenApi,
} from './bootstrap';
import { validateEnvironment } from './config/environment';

async function bootstrap(): Promise<void> {
  const environment = validateEnvironment();
  const app = await NestFactory.create(AppModule);
  configureApplication(app);
  setupOpenApi(app, createOpenApiDocument(app));

  await app.listen(environment.port);
}

void bootstrap();
