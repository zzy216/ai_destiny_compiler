import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentRun, CoachConfig, KnowledgeCard } from '../database/entities';
import { AdminManagementController } from './admin-management.controller';
import { AdminManagementService } from './admin-management.service';
import { DevelopmentAdminGuard } from './development-admin.guard';

const persistenceEnabled = process.env.NODE_ENV !== 'test' && process.env.DATABASE_ENABLED !== 'false';

@Module({
  imports: persistenceEnabled ? [TypeOrmModule.forFeature([CoachConfig, KnowledgeCard, AgentRun])] : [],
  controllers: [AdminManagementController],
  providers: [AdminManagementService, DevelopmentAdminGuard],
  exports: [AdminManagementService],
})
export class AdminManagementModule {}
