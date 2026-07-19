import 'reflect-metadata';

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';

async function generateOpenApi(): Promise<void> {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_ENABLED ??= 'false';

  const [{ AppModule }, { configureApplication, createOpenApiDocument }] = await Promise.all([
    import('./app.module'),
    import('./bootstrap'),
  ]);
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApplication(app);
  await app.init();

  const document = createOpenApiDocument(app);
  const outputPath = resolve(process.cwd(), 'openapi.json');
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();
}

void generateOpenApi();
