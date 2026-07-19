import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  ActionCard,
  ExecutionRecord,
  Memory,
  Review,
} from '../database/entities';
import { ActionsController } from './actions.controller';
import { ActionsService } from './actions.service';

const persistenceEnabled = process.env.NODE_ENV !== 'test' && process.env.DATABASE_ENABLED !== 'false';

@Module({
  imports: [
    ...(persistenceEnabled ? [TypeOrmModule.forFeature([ActionCard, ExecutionRecord, Review, Memory])] : []),
  ],
  controllers: [ActionsController],
  providers: [ActionsService],
  exports: [ActionsService],
})
export class ActionsModule {}
