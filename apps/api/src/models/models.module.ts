import { Module } from '@nestjs/common';

import {
  AdminModelsController,
  CustomModelsController,
  ModelsController,
} from './models.controller';

@Module({
  controllers: [ModelsController, CustomModelsController, AdminModelsController],
})
export class ModelsModule {}
