import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';

import { PageMetaDto } from '../common/api-contract.dto';

export enum AdminContentStatus {
  Draft = 'draft',
  Published = 'published',
  Disabled = 'disabled',
}

export enum AdminAgentRunStatus {
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Timeout = 'timeout',
  Cancelled = 'cancelled',
}

export class AdminPaginationQueryDto {
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

  @ApiPropertyOptional({ enum: AdminContentStatus })
  @IsOptional()
  @IsEnum(AdminContentStatus)
  declare status?: AdminContentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  declare category?: string;
}

export class AdminAgentRunQueryDto extends OmitType(AdminPaginationQueryDto, ['status', 'category'] as const) {
  @ApiPropertyOptional({ enum: AdminAgentRunStatus })
  @IsOptional()
  @IsEnum(AdminAgentRunStatus)
  declare status?: AdminAgentRunStatus;
}

export class CreateCoachConfigRequestDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  declare name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  declare roleDefinition: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  declare productGoal: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  declare systemPrompt: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  declare conversationRules: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  declare actionRules: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  declare prohibitedContent: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  declare safetyRules: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  declare outputSchema: Record<string, unknown>;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  declare defaultModelConfigId?: string | null;
}

export class UpdateCoachConfigRequestDto extends PartialType(CreateCoachConfigRequestDto) {}

export class CreateKnowledgeCardRequestDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  declare cardKey: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  declare name: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  declare category: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  declare tags: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  declare problemSignals: string[];

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  declare variables: Record<string, unknown>;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  declare diagnosticQuestions: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  declare candidateActions: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  declare stopDoing: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  declare reviewQuestions: string[];
}

export class UpdateKnowledgeCardRequestDto extends PartialType(CreateKnowledgeCardRequestDto) {}

export class AdminPageMetaDto extends PageMetaDto {}
