import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentRunsModule } from '../agent-runs/agent-runs.module';
import { ActionCard, CoachConfig, Conversation, KnowledgeCard, Message } from '../database/entities';
import { ModelsModule } from '../models/models.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

const persistenceEnabled = process.env.NODE_ENV !== 'test' && process.env.DATABASE_ENABLED !== 'false';

@Module({
  imports: [
    ...(persistenceEnabled ? [TypeOrmModule.forFeature([Conversation, Message, ActionCard, CoachConfig, KnowledgeCard])] : []),
    ModelsModule,
    AgentRunsModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
