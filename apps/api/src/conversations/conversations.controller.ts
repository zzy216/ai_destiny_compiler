import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';

import { ApiProtectedErrorResponses } from '../common/api-error-responses.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/auth-context';
import { AuthGuard, FixedWindowRateLimitGuard } from '../auth/auth.guards';
import {
  ConversationListResponseDto,
  ConversationPaginationQueryDto,
  ConversationResponseDto,
  CreateConversationRequestDto,
  MessageListResponseDto,
  SendMessageRequestDto,
} from './conversations.dto';
import { ConversationsService } from './conversations.service';

@ApiTags('Conversations')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('v1/conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post()
  @ApiOperation({
    summary: '创建会话并固定当前模型发布版本',
    description: '后续模型发布不会改写该会话保存的不含凭据模型快照。',
  })
  @ApiCreatedResponse({ type: ConversationResponseDto })
  @ApiProtectedErrorResponses()
  async create(
    @Body() request: CreateConversationRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConversationResponseDto> {
    return { data: await this.conversations.createConversation(request, user.id) as never };
  }

  @Get()
  @ApiOperation({ summary: '列出当前用户的会话' })
  @ApiOkResponse({ type: ConversationListResponseDto })
  @ApiProtectedErrorResponses()
  async list(
    @Query() query: ConversationPaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConversationListResponseDto> {
    return await this.conversations.listConversations(query, user.id) as never;
  }

  @Get(':id/messages')
  @ApiOperation({ summary: '按序读取当前用户会话的消息' })
  @ApiOkResponse({ type: MessageListResponseDto })
  @ApiProtectedErrorResponses()
  listMessages(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: ConversationPaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageListResponseDto> {
    return this.conversations.listMessages(id, query, user.id) as never;
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.OK)
  @ApiProduces('text/event-stream')
  @ApiOperation({
    summary: '发送消息并以 SSE 返回 Agent 执行事件',
    description:
      '事件类型固定为 run.started、message.delta、message.completed、run.failed。相同 idempotencyKey 不重复创建消息。',
  })
  @ApiOkResponse({
    description: 'SSE 事件流，每个 data 字段为 JSON',
    schema: {
      type: 'string',
      example:
        'event: message.delta\\ndata: {"agentRunId":"...","delta":"先完成一个可验收动作"}\\n\\n',
    },
  })
  @ApiProtectedErrorResponses()
  @UseGuards(AuthGuard, FixedWindowRateLimitGuard)
  async sendMessage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() request: SendMessageRequestDto,
    @Res() response: Response,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    response.status(HttpStatus.OK);
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    for await (const event of this.conversations.streamMessage(id, request, user.id)) {
      response.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
    }
    response.end();
  }
}
