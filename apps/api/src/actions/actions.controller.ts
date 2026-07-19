import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser, type AuthenticatedUser } from '../auth/auth-context';
import { AuthGuard } from '../auth/auth.guards';
import { ApiProtectedErrorResponses } from '../common/api-error-responses.decorator';
import {
  ActionCardListResponseDto,
  ActionCardQueryDto,
  ActionCardResponseDto,
  ActionPaginationQueryDto,
  CreateExecutionRecordRequestDto,
  CreateMemoryRequestDto,
  CreateReviewRequestDto,
  ExecutionRecordListResponseDto,
  ExecutionRecordResultDto,
  MemoryListResponseDto,
  MemoryQueryDto,
  MemoryResponseDto,
  ReviewListResponseDto,
  ReviewQueryDto,
  ReviewResponseDto,
} from './actions.dto';
import { ActionsService } from './actions.service';

@ApiTags('Actions')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('v1')
export class ActionsController {
  constructor(private readonly actions: ActionsService) {}

  @Get('action-cards')
  @ApiOperation({ summary: '列出当前用户的行动卡' })
  @ApiOkResponse({ type: ActionCardListResponseDto })
  @ApiProtectedErrorResponses()
  async listActionCards(
    @Query() query: ActionCardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ActionCardListResponseDto> {
    return this.actions.listActionCards(query, user.id) as never;
  }

  @Get('action-cards/:id')
  @ApiOperation({ summary: '读取当前用户的行动卡详情' })
  @ApiOkResponse({ type: ActionCardResponseDto })
  @ApiProtectedErrorResponses()
  async getActionCard(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ActionCardResponseDto> {
    return { data: await this.actions.getActionCard(id, user.id) as never };
  }

  @Get('action-cards/:id/execution-records')
  @ApiOperation({ summary: '列出当前用户行动卡的执行反馈' })
  @ApiOkResponse({ type: ExecutionRecordListResponseDto })
  @ApiProtectedErrorResponses()
  async listExecutionRecords(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: ActionPaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExecutionRecordListResponseDto> {
    return this.actions.listExecutionRecords(id, query, user.id) as never;
  }

  @Post('action-cards/:id/execution-records')
  @ApiOperation({
    summary: '提交行动执行反馈',
    description: '写入反馈记录，并同步更新行动卡当前状态。',
  })
  @ApiCreatedResponse({ type: ExecutionRecordResultDto })
  @ApiProtectedErrorResponses()
  async submitExecutionRecord(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() request: CreateExecutionRecordRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExecutionRecordResultDto> {
    return this.actions.submitExecutionRecord(id, request, user.id);
  }

  @Get('reviews')
  @ApiOperation({ summary: '列出当前用户的复盘' })
  @ApiOkResponse({ type: ReviewListResponseDto })
  @ApiProtectedErrorResponses()
  async listReviews(
    @Query() query: ReviewQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReviewListResponseDto> {
    return this.actions.listReviews(query, user.id) as never;
  }

  @Post('reviews')
  @ApiOperation({ summary: '创建当前用户的复盘' })
  @ApiCreatedResponse({ type: ReviewResponseDto })
  @ApiProtectedErrorResponses()
  async createReview(
    @Body() request: CreateReviewRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReviewResponseDto> {
    return { data: await this.actions.createReview(request, user.id) as never };
  }

  @Get('memories')
  @ApiOperation({ summary: '列出当前用户记忆' })
  @ApiOkResponse({ type: MemoryListResponseDto })
  @ApiProtectedErrorResponses()
  async listMemories(
    @Query() query: MemoryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MemoryListResponseDto> {
    return this.actions.listMemories(query, user.id) as never;
  }

  @Post('memories')
  @ApiOperation({ summary: '创建当前用户记忆' })
  @ApiCreatedResponse({ type: MemoryResponseDto })
  @ApiProtectedErrorResponses()
  async createMemory(
    @Body() request: CreateMemoryRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MemoryResponseDto> {
    return { data: await this.actions.createMemory(request, user.id) as never };
  }

  @Delete('memories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除当前用户记忆' })
  @ApiNoContentResponse()
  @ApiProtectedErrorResponses()
  async deleteMemory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.actions.deleteMemory(id, user.id);
  }
}
