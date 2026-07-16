import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
} from '@nestjs/swagger';

import { PageMetaDto } from '../common/api-contract.dto';

export enum ModelOwnerType {
  System = 'system',
  User = 'user',
}

export enum ModelType {
  Api = 'api',
  Local = 'local',
}

export enum ModelProtocol {
  OpenAiCompatible = 'openai_compatible',
  Ollama = 'ollama',
  ProviderSpecific = 'provider_specific',
}

export enum ModelStatus {
  Draft = 'draft',
  Published = 'published',
  Disabled = 'disabled',
  Deleted = 'deleted',
}

export class PaginationQueryDto {
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

export class ModelVersionDto {
  @ApiProperty({ format: 'uuid' })
  declare id: string;

  @ApiProperty({ minimum: 1, example: 3 })
  declare version: number;

  @ApiPropertyOptional({ nullable: true, example: 'openai' })
  declare provider: string | null;

  @ApiProperty({ format: 'uri', example: 'https://api.example.com/v1' })
  declare baseUrl: string;

  @ApiProperty({ example: 'example-model' })
  declare modelName: string;

  @ApiProperty({ minimum: 1000, maximum: 300000, example: 60000 })
  declare timeoutMs: number;

  @ApiProperty({ minimum: 1, maximum: 100000, example: 4096 })
  declare maxOutputTokens: number;

  @ApiProperty()
  declare supportsStream: boolean;

  @ApiProperty()
  declare supportsStructuredOutput: boolean;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare capabilities: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: '不含 api_key、authorization、token、secret 等敏感键',
  })
  declare requestOptions: Record<string, unknown>;
}

export class ModelSummaryDto {
  @ApiProperty({ format: 'uuid' })
  declare id: string;

  @ApiProperty({ enum: ModelOwnerType })
  declare ownerType: ModelOwnerType;

  @ApiProperty({ example: 'GPT 示例模型' })
  declare displayName: string;

  @ApiProperty({ enum: ModelType })
  declare modelType: ModelType;

  @ApiProperty({ enum: ModelProtocol })
  declare protocol: ModelProtocol;

  @ApiProperty({ enum: ModelStatus })
  declare status: ModelStatus;

  @ApiProperty()
  declare isDefault: boolean;

  @ApiProperty()
  declare isSelectable: boolean;

  @ApiProperty({
    description: '仅表示服务端已保存凭据，不返回凭据内容',
  })
  declare hasCredential: boolean;

  @ApiPropertyOptional({
    nullable: true,
    example: '…A1B2',
    description: '可选的脱敏末尾提示',
  })
  declare secretHint: string | null;
}

export class ModelDetailDto extends ModelSummaryDto {
  @ApiPropertyOptional({ type: ModelVersionDto, nullable: true })
  declare currentVersion: ModelVersionDto | null;
}

export class ModelListResponseDto {
  @ApiProperty({ type: [ModelSummaryDto] })
  declare data: ModelSummaryDto[];

  @ApiProperty({ type: PageMetaDto })
  declare meta: PageMetaDto;
}

export class ModelResponseDto {
  @ApiProperty({ type: ModelDetailDto })
  declare data: ModelDetailDto;
}

export class CreateCustomModelRequestDto {
  @ApiProperty({ maxLength: 100, example: '我的 API 模型' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  declare displayName: string;

  @ApiProperty({
    enum: [ModelProtocol.OpenAiCompatible],
    example: ModelProtocol.OpenAiCompatible,
  })
  @IsIn([ModelProtocol.OpenAiCompatible])
  declare protocol: ModelProtocol.OpenAiCompatible;

  @ApiProperty({
    format: 'uri',
    maxLength: 500,
    example: 'https://api.example.com/v1',
    description: '用户自定义模型首版只接受公网 HTTPS；SSRF 校验由 Service 再执行',
  })
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true })
  @MaxLength(500)
  declare baseUrl: string;

  @ApiProperty({ maxLength: 120, example: 'example-model' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  declare modelName: string;

  @ApiPropertyOptional({ maxLength: 50, example: 'openai' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  declare provider?: string;

  @ApiPropertyOptional({ writeOnly: true, maxLength: 4096 })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  declare apiKey?: string;

  @ApiPropertyOptional({ default: 60000, minimum: 1000, maximum: 300000 })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(300000)
  declare timeoutMs?: number;

  @ApiPropertyOptional({ default: 4096, minimum: 1, maximum: 100000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  declare maxOutputTokens?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  declare supportsStream?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  declare supportsStructuredOutput?: boolean;
}

export class UpdateCustomModelRequestDto extends PartialType(
  CreateCustomModelRequestDto,
) {}

export class CreateAdminModelRequestDto {
  @ApiProperty({ maxLength: 80, example: 'primary-model' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  declare slug: string;

  @ApiProperty({ maxLength: 100, example: '主模型' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  declare displayName: string;

  @ApiProperty({ enum: ModelType })
  @IsEnum(ModelType)
  declare modelType: ModelType;

  @ApiProperty({ enum: ModelProtocol })
  @IsEnum(ModelProtocol)
  declare protocol: ModelProtocol;

  @ApiProperty({ format: 'uri', maxLength: 500 })
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  @MaxLength(500)
  declare baseUrl: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  declare modelName: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  declare provider?: string;

  @ApiPropertyOptional({ writeOnly: true, maxLength: 4096 })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  declare apiKey?: string;

  @ApiPropertyOptional({ default: 60000, minimum: 1000, maximum: 300000 })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(300000)
  declare timeoutMs?: number;

  @ApiPropertyOptional({ default: 4096, minimum: 1, maximum: 100000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  declare maxOutputTokens?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  declare supportsStream?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  declare supportsStructuredOutput?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  declare isSelectable?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  declare capabilities?: Record<string, unknown>;
}

export class UpdateAdminModelRequestDto extends PartialType(
  CreateAdminModelRequestDto,
) {}

export class ModelConnectionTestDto {
  @ApiProperty({ example: true })
  declare reachable: boolean;

  @ApiProperty({ example: 238 })
  declare latencyMs: number;

  @ApiPropertyOptional({ nullable: true, example: null })
  declare errorCode: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: '脱敏错误摘要，不包含供应商原始错误体或请求头',
  })
  declare errorMessage: string | null;
}

export class ModelConnectionTestResponseDto {
  @ApiProperty({ type: ModelConnectionTestDto })
  declare data: ModelConnectionTestDto;
}
