import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import {
  configureApplication,
  createOpenApiDocument,
  setupOpenApi,
} from './bootstrap';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApplication(app);
  setupOpenApi(app, createOpenApiDocument(app));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
