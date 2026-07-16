import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidationErrorDetailDto {
  @ApiProperty({ example: 'modelConfigId' })
  declare field: string;

  @ApiProperty({ example: 'modelConfigId must be a UUID' })
  declare message: string;

  @ApiProperty({ example: 'invalid_uuid' })
  declare code: string;
}

export class ApiErrorDto {
  @ApiProperty({ example: 'validation_error' })
  declare code: string;

  @ApiProperty({ example: 'Request validation failed' })
  declare message: string;

  @ApiPropertyOptional({ type: [ValidationErrorDetailDto] })
  declare details?: ValidationErrorDetailDto[];
}

export class ApiErrorResponseDto {
  @ApiProperty({ type: ApiErrorDto })
  declare error: ApiErrorDto;
}

export class PageMetaDto {
  @ApiProperty({ example: 1, minimum: 1 })
  declare page: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  declare perPage: number;

  @ApiProperty({ example: 42, minimum: 0 })
  declare total: number;

  @ApiProperty({ example: 3, minimum: 0 })
  declare totalPages: number;
}
