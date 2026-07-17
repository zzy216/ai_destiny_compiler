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
import { DEVELOPMENT_USER_ID } from '../models/models.service';
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
  async create(@Body() request: CreateConversationRequestDto): Promise<ConversationResponseDto> {
    return { data: await this.conversations.createConversation(request, DEVELOPMENT_USER_ID) as never };
  }

  @Get()
  @ApiOperation({ summary: '列出当前用户的会话' })
  @ApiOkResponse({ type: ConversationListResponseDto })
  @ApiProtectedErrorResponses()
  async list(@Query() query: ConversationPaginationQueryDto): Promise<ConversationListResponseDto> {
    return await this.conversations.listConversations(query, DEVELOPMENT_USER_ID) as never;
  }

  @Get(':id/messages')
  @ApiOperation({ summary: '按序读取当前用户会话的消息' })
  @ApiOkResponse({ type: MessageListResponseDto })
  @ApiProtectedErrorResponses()
  listMessages(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: ConversationPaginationQueryDto,
  ): Promise<MessageListResponseDto> {
    return this.conversations.listMessages(id, query, DEVELOPMENT_USER_ID) as never;
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
  async sendMessage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() request: SendMessageRequestDto,
    @Res() response: Response,
  ): Promise<void> {
    response.status(HttpStatus.OK);
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    for await (const event of this.conversations.streamMessage(id, request, DEVELOPMENT_USER_ID)) {
      response.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
    }
    response.end();
  }
}
