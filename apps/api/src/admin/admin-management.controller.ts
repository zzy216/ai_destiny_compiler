import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type AuthenticatedUser } from '../auth/auth-context';
import { AdminRoleGuard, AuthGuard } from '../auth/auth.guards';
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
@UseGuards(AuthGuard, AdminRoleGuard)
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
  async createCoachConfig(
    @Body() input: CreateCoachConfigRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.admin.createCoachConfig(input, user.id) };
  }

  @Patch('coach-configs/:id')
  async updateCoachConfig(
    @Param('id') id: string,
    @Body() input: UpdateCoachConfigRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.admin.updateCoachConfig(id, input, user.id) };
  }

  @Post('coach-configs/:id/publish')
  async publishCoachConfig(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.admin.publishCoachConfig(id, user.id) };
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
  async createKnowledgeCard(
    @Body() input: CreateKnowledgeCardRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.admin.createKnowledgeCard(input, user.id) };
  }

  @Patch('knowledge-cards/:id')
  async updateKnowledgeCard(
    @Param('id') id: string,
    @Body() input: UpdateKnowledgeCardRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.admin.updateKnowledgeCard(id, input, user.id) };
  }

  @Post('knowledge-cards/:id/publish')
  async publishKnowledgeCard(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.admin.publishKnowledgeCard(id, user.id) };
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
