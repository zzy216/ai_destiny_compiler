import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { ConversationsModule } from './conversations/conversations.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { ModelsModule } from './models/models.module';

@Module({
  imports: [
    DatabaseModule.forRoot(),
    HealthModule,
    AuthModule,
    ModelsModule,
    ConversationsModule,
  ],
})
export class AppModule {}
