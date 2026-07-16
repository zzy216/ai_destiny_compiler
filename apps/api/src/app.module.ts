import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { ConversationsModule } from './conversations/conversations.module';
import { DatabaseModule } from './database/database.module';
import { ModelsModule } from './models/models.module';

@Module({
  imports: [
    DatabaseModule.forRoot(),
    AuthModule,
    ModelsModule,
    ConversationsModule,
  ],
})
export class AppModule {}
