import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ApiProtectedErrorResponses } from '../common/api-error-responses.decorator';
import { contractNotImplemented } from '../common/contract-not-implemented';
import {
  CreateAdminModelRequestDto,
  CreateCustomModelRequestDto,
  ModelConnectionTestResponseDto,
  ModelListResponseDto,
  ModelResponseDto,
  PaginationQueryDto,
  UpdateAdminModelRequestDto,
  UpdateCustomModelRequestDto,
} from './models.dto';

@ApiTags('Models')
@ApiBearerAuth('bearer')
@Controller('v1/models')
export class ModelsController {
  @Get()
  @ApiOperation({ summary: '列出当前用户可用于新会话的模型' })
  @ApiOkResponse({ type: ModelListResponseDto })
  @ApiProtectedErrorResponses()
  listAvailable(@Query() _query: PaginationQueryDto): never {
    return contractNotImplemented();
  }
}

@ApiTags('Custom Models')
@ApiBearerAuth('bearer')
@Controller('v1/custom-models')
export class CustomModelsController {
  @Get()
  @ApiOperation({ summary: '列出当前用户自己的自定义模型' })
  @ApiOkResponse({ type: ModelListResponseDto })
  @ApiProtectedErrorResponses()
  list(@Query() _query: PaginationQueryDto): never {
    return contractNotImplemented();
  }

  @Post()
  @ApiOperation({ summary: '创建用户自定义 OpenAI-compatible 模型' })
  @ApiCreatedResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  create(@Body() _request: CreateCustomModelRequestDto): never {
    return contractNotImplemented();
  }

  @Patch(':id')
  @ApiOperation({ summary: '创建自定义模型的新草稿版本' })
  @ApiOkResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) _id: string,
    @Body() _request: UpdateCustomModelRequestDto,
  ): never {
    return contractNotImplemented();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除自定义模型并立即清除其加密凭据' })
  @ApiOkResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) _id: string,
  ): never {
    return contractNotImplemented();
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '测试自定义模型连接，不回显凭据或原始错误体' })
  @ApiOkResponse({ type: ModelConnectionTestResponseDto })
  @ApiProtectedErrorResponses()
  testConnection(
    @Param('id', new ParseUUIDPipe({ version: '4' })) _id: string,
  ): never {
    return contractNotImplemented();
  }
}

@ApiTags('Admin Models')
@ApiBearerAuth('bearer')
@Controller('v1/admin/models')
export class AdminModelsController {
  @Get()
  @ApiOperation({ summary: '管理员列出系统模型' })
  @ApiOkResponse({ type: ModelListResponseDto })
  @ApiProtectedErrorResponses()
  list(@Query() _query: PaginationQueryDto): never {
    return contractNotImplemented();
  }

  @Post()
  @ApiOperation({ summary: '管理员创建系统模型草稿' })
  @ApiCreatedResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  create(@Body() _request: CreateAdminModelRequestDto): never {
    return contractNotImplemented();
  }

  @Get(':id')
  @ApiOperation({ summary: '管理员查看系统模型详情，不返回明文凭据' })
  @ApiOkResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) _id: string,
  ): never {
    return contractNotImplemented();
  }

  @Patch(':id')
  @ApiOperation({ summary: '管理员创建或修改系统模型草稿版本' })
  @ApiOkResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) _id: string,
    @Body() _request: UpdateAdminModelRequestDto,
  ): never {
    return contractNotImplemented();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除未发布且未被引用的草稿模型' })
  @ApiOkResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) _id: string,
  ): never {
    return contractNotImplemented();
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发布模型当前草稿版本，仅影响新建会话' })
  @ApiOkResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  publish(
    @Param('id', new ParseUUIDPipe({ version: '4' })) _id: string,
  ): never {
    return contractNotImplemented();
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '管理员测试系统模型连接' })
  @ApiOkResponse({ type: ModelConnectionTestResponseDto })
  @ApiProtectedErrorResponses()
  testConnection(
    @Param('id', new ParseUUIDPipe({ version: '4' })) _id: string,
  ): never {
    return contractNotImplemented();
  }

  @Post(':id/set-default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '将已发布系统模型设为新会话默认模型' })
  @ApiOkResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  setDefault(
    @Param('id', new ParseUUIDPipe({ version: '4' })) _id: string,
  ): never {
    return contractNotImplemented();
  }
}
