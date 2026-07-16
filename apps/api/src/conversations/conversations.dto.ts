import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PageMetaDto } from '../common/api-contract.dto';
import {
  ModelOwnerType,
  ModelProtocol,
  ModelType,
} from '../models/models.dto';

export enum ConversationStatus {
  Active = 'active',
  Archived = 'archived',
  ModelUnavailable = 'model_unavailable',
}

export enum ModelSource {
  Managed = 'managed',
  Custom = 'custom',
}

export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
}

export enum MessageStatus {
  Streaming = 'streaming',
  Completed = 'completed',
  Failed = 'failed',
}

export class ConversationPaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  declare page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  declare perPage?: number;
}

export class CreateConversationRequestDto {
  @ApiProperty({
    format: 'uuid',
    description: '必须选择当前用户可用且已发布的模型稳定 ID',
  })
  @IsUUID('4')
  declare modelConfigId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4')
  declare goalId?: string;

  @ApiPropertyOptional({ maxLength: 150, example: '职业选择' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  declare title?: string;

  @ApiPropertyOptional({
    maxLength: 4000,
    description: '从旧会话显式继承的脱敏摘要，不复制隐藏 Prompt 或凭据',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  declare inheritedSummary?: string;
}

export class SendMessageRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 20000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  declare content: string;

  @ApiProperty({
    format: 'uuid',
    description: '客户端每次发送生成的 UUID；相同用户和键返回已有 Agent Run',
  })
  @IsUUID('4')
  declare idempotencyKey: string;
}

export class ModelSnapshotDto {
  @ApiProperty()
  declare displayName: string;

  @ApiProperty({ enum: ModelOwnerType })
  declare ownerType: ModelOwnerType;

  @ApiProperty({ enum: ModelType })
  declare modelType: ModelType;

  @ApiProperty({ enum: ModelProtocol })
  declare protocol: ModelProtocol;

  @ApiPropertyOptional({ nullable: true })
  declare provider: string | null;

  @ApiProperty({ format: 'uri' })
  declare baseUrl: string;

  @ApiProperty()
  declare modelName: string;

  @ApiProperty({ minimum: 1 })
  declare version: number;

  @ApiProperty()
  declare supportsStream: boolean;

  @ApiProperty()
  declare supportsStructuredOutput: boolean;
}

export class ConversationDto {
  @ApiProperty({ format: 'uuid' })
  declare id: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  declare goalId: string | null;

  @ApiPropertyOptional({ nullable: true })
  declare title: string | null;

  @ApiProperty({ enum: ConversationStatus })
  declare status: ConversationStatus;

  @ApiProperty({ enum: ModelSource })
  declare modelSource: ModelSource;

  @ApiProperty({ format: 'uuid' })
  declare modelConfigId: string;

  @ApiProperty({ format: 'uuid' })
  declare modelConfigVersionId: string;

  @ApiProperty({ type: ModelSnapshotDto })
  declare modelSnapshot: ModelSnapshotDto;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  declare lastMessageAt: string | null;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
}

export class ConversationResponseDto {
  @ApiProperty({ type: ConversationDto })
  declare data: ConversationDto;
}

export class ConversationListResponseDto {
  @ApiProperty({ type: [ConversationDto] })
  declare data: ConversationDto[];

  @ApiProperty({ type: PageMetaDto })
  declare meta: PageMetaDto;
}

export class MessageDto {
  @ApiProperty({ format: 'uuid' })
  declare id: string;

  @ApiProperty({ minimum: 1 })
  declare sequence: number;

  @ApiProperty({ enum: MessageRole })
  declare role: MessageRole;

  @ApiProperty()
  declare content: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  declare contentJson: Record<string, unknown> | null;

  @ApiProperty({ enum: MessageStatus })
  declare status: MessageStatus;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
}

export class MessageListResponseDto {
  @ApiProperty({ type: [MessageDto] })
  declare data: MessageDto[];

  @ApiProperty({ type: PageMetaDto })
  declare meta: PageMetaDto;
}

export class MessageStreamEventDto {
  @ApiProperty({
    enum: ['run.started', 'message.delta', 'message.completed', 'run.failed'],
  })
  declare event:
    | 'run.started'
    | 'message.delta'
    | 'message.completed'
    | 'run.failed';

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare data: Record<string, unknown>;
}
