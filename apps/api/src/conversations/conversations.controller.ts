import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';

import { ApiProtectedErrorResponses } from '../common/api-error-responses.decorator';
import { contractNotImplemented } from '../common/contract-not-implemented';
import {
  ConversationListResponseDto,
  ConversationPaginationQueryDto,
  ConversationResponseDto,
  CreateConversationRequestDto,
  MessageListResponseDto,
  SendMessageRequestDto,
} from './conversations.dto';

@ApiTags('Conversations')
@ApiBearerAuth('bearer')
@Controller('v1/conversations')
export class ConversationsController {
  @Post()
  @ApiOperation({
    summary: '创建会话并固定当前模型发布版本',
    description: '后续模型发布不会改写该会话保存的不含凭据模型快照。',
  })
  @ApiCreatedResponse({ type: ConversationResponseDto })
  @ApiProtectedErrorResponses()
  create(@Body() _request: CreateConversationRequestDto): never {
    return contractNotImplemented();
  }

  @Get()
  @ApiOperation({ summary: '列出当前用户的会话' })
  @ApiOkResponse({ type: ConversationListResponseDto })
  @ApiProtectedErrorResponses()
  list(@Query() _query: ConversationPaginationQueryDto): never {
    return contractNotImplemented();
  }

  @Get(':id/messages')
  @ApiOperation({ summary: '按序读取当前用户会话的消息' })
  @ApiOkResponse({ type: MessageListResponseDto })
  @ApiProtectedErrorResponses()
  listMessages(
    @Param('id', new ParseUUIDPipe({ version: '4' })) _id: string,
    @Query() _query: ConversationPaginationQueryDto,
  ): never {
    return contractNotImplemented();
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
  sendMessage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) _id: string,
    @Body() _request: SendMessageRequestDto,
  ): never {
    return contractNotImplemented();
  }
}
