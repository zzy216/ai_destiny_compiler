import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import helmet from 'helmet';

import { ApiExceptionFilter } from './common/api-exception.filter';
import { createRequestLogger } from './common/request-logger';
import { createValidationException } from './common/validation';

export function configureApplication(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.use(createRequestLogger());
  app.use(helmet());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: false,
      exceptionFactory: createValidationException,
    }),
  );
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Destiny Compiler API')
    .setDescription('命运编译器 MVP 代码契约')
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();

  return SwaggerModule.createDocument(app, config);
}

export function setupOpenApi(
  app: INestApplication,
  document: OpenAPIObject,
): void {
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });
}
