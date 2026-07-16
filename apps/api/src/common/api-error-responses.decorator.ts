import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ApiErrorResponseDto } from './api-contract.dto';

export function ApiValidationErrorResponses(): MethodDecorator {
  return applyDecorators(
    ApiBadRequestResponse({
      description: '请求字段或格式不合法',
      type: ApiErrorResponseDto,
    }),
    ApiTooManyRequestsResponse({
      description: '请求超过限流阈值',
      type: ApiErrorResponseDto,
    }),
  );
}

export function ApiProtectedErrorResponses(): MethodDecorator {
  return applyDecorators(
    ApiValidationErrorResponses(),
    ApiUnauthorizedResponse({
      description: '缺少或使用了无效身份凭据',
      type: ApiErrorResponseDto,
    }),
    ApiForbiddenResponse({
      description: '当前身份无权执行该操作或访问该资源',
      type: ApiErrorResponseDto,
    }),
  );
}
