import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PageMetaDto } from '../common/api-contract.dto';

export enum ActionCardStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  PartiallyCompleted = 'partially_completed',
  NotCompleted = 'not_completed',
  Abandoned = 'abandoned',
}

export enum ExecutionResult {
  Completed = 'completed',
  PartiallyCompleted = 'partially_completed',
  NotCompleted = 'not_completed',
}

export enum ObstacleType {
  Direction = 'direction',
  Ability = 'ability',
  Execution = 'execution',
  Resource = 'resource',
  Timing = 'timing',
  Emotion = 'emotion',
  Other = 'other',
}

export enum ReviewType {
  Action = 'action',
  Daily = 'daily',
  Stage = 'stage',
}

export enum MemoryCategory {
  Goal = 'goal',
  Preference = 'preference',
  Constraint = 'constraint',
  Pattern = 'pattern',
  Context = 'context',
}

export class ActionPaginationQueryDto {
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

export class ActionCardQueryDto extends ActionPaginationQueryDto {
  @ApiPropertyOptional({ enum: ActionCardStatus })
  @IsOptional()
  @IsEnum(ActionCardStatus)
  declare status?: ActionCardStatus;
}

export class ReviewQueryDto extends ActionPaginationQueryDto {
  @ApiPropertyOptional({ enum: ReviewType })
  @IsOptional()
  @IsEnum(ReviewType)
  declare reviewType?: ReviewType;
}

export class MemoryQueryDto extends ActionPaginationQueryDto {
  @ApiPropertyOptional({ enum: MemoryCategory })
  @IsOptional()
  @IsEnum(MemoryCategory)
  declare category?: MemoryCategory;
}

export class CreateExecutionRecordRequestDto {
  @ApiProperty({ enum: ExecutionResult })
  @IsEnum(ExecutionResult)
  declare result: ExecutionResult;

  @ApiPropertyOptional({ maxLength: 4000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  declare note?: string;

  @ApiPropertyOptional({ enum: ObstacleType, nullable: true })
  @IsOptional()
  @IsEnum(ObstacleType)
  declare obstacleType?: ObstacleType;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  declare evidence?: Record<string, unknown>;
}

export class CreateReviewRequestDto {
  @ApiProperty({ enum: ReviewType })
  @IsEnum(ReviewType)
  declare reviewType: ReviewType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4')
  declare actionCardId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4')
  declare generatedByRunId?: string;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsDateString()
  declare periodStart?: string;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsDateString()
  declare periodEnd?: string;

  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @MaxLength(4000)
  declare summary: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  declare progress?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  declare frictions?: string[];

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  declare nextFocus?: string;
}

export class CreateMemoryRequestDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4')
  declare sourceConversationId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4')
  declare sourceMessageId?: string;

  @ApiProperty({ enum: MemoryCategory })
  @IsEnum(MemoryCategory)
  declare category: MemoryCategory;

  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  declare content: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 1, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  declare confidence?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  declare confirmedByUser?: boolean;
}

export class ActionCardDto {
  @ApiProperty({ format: 'uuid' })
  declare id: string;

  @ApiProperty({ format: 'uuid' })
  declare conversationId: string;

  @ApiProperty({ format: 'uuid' })
  declare agentRunId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  declare goalId: string | null;

  @ApiProperty()
  declare isPrimary: boolean;

  @ApiProperty()
  declare title: string;

  @ApiPropertyOptional({ nullable: true })
  declare durationMinutes: number | null;

  @ApiProperty()
  declare deliverable: string;

  @ApiProperty({ type: [String] })
  declare completionCriteria: string[];

  @ApiProperty({ type: [String] })
  declare stopDoing: string[];

  @ApiProperty({ enum: ActionCardStatus })
  declare status: ActionCardStatus;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  declare dueAt: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  declare completedAt: string | null;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({ format: 'date-time' })
  declare updatedAt: string;
}

export class ExecutionRecordDto {
  @ApiProperty({ format: 'uuid' })
  declare id: string;

  @ApiProperty({ format: 'uuid' })
  declare actionCardId: string;

  @ApiProperty({ enum: ExecutionResult })
  declare result: ExecutionResult;

  @ApiPropertyOptional({ nullable: true })
  declare note: string | null;

  @ApiPropertyOptional({ enum: ObstacleType, nullable: true })
  declare obstacleType: ObstacleType | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare evidence: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  declare submittedAt: string;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
}

export class ExecutionRecordResultDto {
  @ApiProperty({ type: ExecutionRecordDto })
  declare data: ExecutionRecordDto;

  @ApiProperty({ enum: ActionCardStatus })
  declare actionCardStatus: ActionCardStatus;
}

export class ReviewDto {
  @ApiProperty({ format: 'uuid' })
  declare id: string;

  @ApiProperty({ enum: ReviewType })
  declare reviewType: ReviewType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  declare actionCardId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  declare generatedByRunId: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  declare periodStart: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  declare periodEnd: string | null;

  @ApiProperty()
  declare summary: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare progress: Record<string, unknown>;

  @ApiProperty({ type: [String] })
  declare frictions: string[];

  @ApiPropertyOptional({ nullable: true })
  declare nextFocus: string | null;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({ format: 'date-time' })
  declare updatedAt: string;
}

export class MemoryDto {
  @ApiProperty({ format: 'uuid' })
  declare id: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  declare sourceConversationId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  declare sourceMessageId: string | null;

  @ApiProperty({ enum: MemoryCategory })
  declare category: MemoryCategory;

  @ApiProperty()
  declare content: string;

  @ApiPropertyOptional({ nullable: true })
  declare confidence: string | null;

  @ApiProperty()
  declare confirmedByUser: boolean;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  declare lastUsedAt: string | null;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({ format: 'date-time' })
  declare updatedAt: string;
}

export class ActionCardResponseDto {
  @ApiProperty({ type: ActionCardDto })
  declare data: ActionCardDto;
}

export class ActionCardListResponseDto {
  @ApiProperty({ type: [ActionCardDto] })
  declare data: ActionCardDto[];

  @ApiProperty({ type: PageMetaDto })
  declare meta: PageMetaDto;
}

export class ExecutionRecordListResponseDto {
  @ApiProperty({ type: [ExecutionRecordDto] })
  declare data: ExecutionRecordDto[];

  @ApiProperty({ type: PageMetaDto })
  declare meta: PageMetaDto;
}

export class ReviewResponseDto {
  @ApiProperty({ type: ReviewDto })
  declare data: ReviewDto;
}

export class ReviewListResponseDto {
  @ApiProperty({ type: [ReviewDto] })
  declare data: ReviewDto[];

  @ApiProperty({ type: PageMetaDto })
  declare meta: PageMetaDto;
}

export class MemoryResponseDto {
  @ApiProperty({ type: MemoryDto })
  declare data: MemoryDto;
}

export class MemoryListResponseDto {
  @ApiProperty({ type: [MemoryDto] })
  declare data: MemoryDto[];

  @ApiProperty({ type: PageMetaDto })
  declare meta: PageMetaDto;
}
