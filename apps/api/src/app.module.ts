import { Module } from '@nestjs/common';

import { ActionsModule } from './actions/actions.module';
import { AuthModule } from './auth/auth.module';
import { AdminManagementModule } from './admin/admin-management.module';
import { AgentRunsModule } from './agent-runs/agent-runs.module';
import { ConversationsModule } from './conversations/conversations.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { ModelsModule } from './models/models.module';

@Module({
  imports: [
    DatabaseModule.forRoot(),
    HealthModule,
    AuthModule,
    AgentRunsModule,
    ModelsModule,
    ConversationsModule,
    ActionsModule,
    AdminManagementModule,
  ],
})
export class AppModule {}
