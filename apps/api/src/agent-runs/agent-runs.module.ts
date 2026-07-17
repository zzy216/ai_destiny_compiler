import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentRun } from '../database/entities';
import { AgentRunsService } from './agent-runs.service';

const persistenceEnabled = process.env.NODE_ENV !== 'test' && process.env.DATABASE_ENABLED !== 'false';

@Module({
  imports: persistenceEnabled ? [TypeOrmModule.forFeature([AgentRun])] : [],
  providers: [AgentRunsService],
  exports: [AgentRunsService],
})
export class AgentRunsModule {}
