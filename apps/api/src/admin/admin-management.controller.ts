import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { ApiProtectedErrorResponses } from '../common/api-error-responses.decorator';
import { DEVELOPMENT_ADMIN_ID } from '../models/models.service';
import {
  AdminPaginationQueryDto,
  CreateCoachConfigRequestDto,
  CreateKnowledgeCardRequestDto,
  UpdateCoachConfigRequestDto,
  UpdateKnowledgeCardRequestDto,
} from './admin-management.dto';
import { AdminManagementService } from './admin-management.service';

@ApiTags('Admin Management')
@ApiBearerAuth('bearer')
@ApiProtectedErrorResponses()
@Controller('v1/admin')
export class AdminManagementController {
  constructor(private readonly admin: AdminManagementService) {}

  @Get('coach-configs')
  @ApiOkResponse({ description: 'Coach config list' })
  listCoachConfigs(@Query() query: AdminPaginationQueryDto) {
    return this.admin.listCoachConfigs(query);
  }

  @Get('coach-configs/:id')
  async getCoachConfig(@Param('id') id: string) {
    return { data: await this.admin.getCoachConfig(id) };
  }

  @Post('coach-configs')
  async createCoachConfig(@Body() input: CreateCoachConfigRequestDto) {
    return { data: await this.admin.createCoachConfig(input, DEVELOPMENT_ADMIN_ID) };
  }

  @Patch('coach-configs/:id')
  async updateCoachConfig(@Param('id') id: string, @Body() input: UpdateCoachConfigRequestDto) {
    return { data: await this.admin.updateCoachConfig(id, input, DEVELOPMENT_ADMIN_ID) };
  }

  @Post('coach-configs/:id/publish')
  async publishCoachConfig(@Param('id') id: string) {
    return { data: await this.admin.publishCoachConfig(id, DEVELOPMENT_ADMIN_ID) };
  }

  @Get('knowledge-cards')
  listKnowledgeCards(@Query() query: AdminPaginationQueryDto) {
    return this.admin.listKnowledgeCards(query);
  }

  @Get('knowledge-cards/:id')
  async getKnowledgeCard(@Param('id') id: string) {
    return { data: await this.admin.getKnowledgeCard(id) };
  }

  @Post('knowledge-cards')
  async createKnowledgeCard(@Body() input: CreateKnowledgeCardRequestDto) {
    return { data: await this.admin.createKnowledgeCard(input, DEVELOPMENT_ADMIN_ID) };
  }

  @Patch('knowledge-cards/:id')
  async updateKnowledgeCard(@Param('id') id: string, @Body() input: UpdateKnowledgeCardRequestDto) {
    return { data: await this.admin.updateKnowledgeCard(id, input, DEVELOPMENT_ADMIN_ID) };
  }

  @Post('knowledge-cards/:id/publish')
  async publishKnowledgeCard(@Param('id') id: string) {
    return { data: await this.admin.publishKnowledgeCard(id, DEVELOPMENT_ADMIN_ID) };
  }

  @Get('agent-runs')
  listAgentRuns(@Query() query: AdminPaginationQueryDto) {
    return this.admin.listAgentRuns(query);
  }

  @Get('agent-runs/:id')
  async getAgentRun(@Param('id') id: string) {
    return { data: await this.admin.getAgentRun(id) };
  }
}
