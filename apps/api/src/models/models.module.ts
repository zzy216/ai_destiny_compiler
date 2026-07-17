import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ModelConfig, ModelConfigVersion, ModelCredential } from '../database/entities';
import { createModelCredentialCipherFromEnv, ModelCredentialCipher } from './model-credential-cipher';
import {
  AdminModelsController,
  CustomModelsController,
  ModelsController,
} from './models.controller';
import { ModelsService } from './models.service';

const persistenceEnabled = process.env.NODE_ENV !== 'test' && process.env.DATABASE_ENABLED !== 'false';

@Module({
  imports: persistenceEnabled
    ? [TypeOrmModule.forFeature([ModelConfig, ModelConfigVersion, ModelCredential])]
    : [],
  controllers: [ModelsController, CustomModelsController, AdminModelsController],
  providers: [
    ModelsService,
    ...(persistenceEnabled
      ? [{
          provide: ModelCredentialCipher,
          useFactory: () => createModelCredentialCipherFromEnv(),
        }]
      : []),
  ],
  exports: [ModelsService],
})
export class ModelsModule {}
