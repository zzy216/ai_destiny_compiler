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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ApiProtectedErrorResponses } from '../common/api-error-responses.decorator';
import { AdminRoleGuard, AuthGuard } from '../auth/auth.guards';
import { CurrentUser, type AuthenticatedUser } from '../auth/auth-context';
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
import {
  ModelsService,
} from './models.service';

@ApiTags('Models')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('v1/models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  @ApiOperation({ summary: '列出当前用户可用于新会话的模型' })
  @ApiOkResponse({ type: ModelListResponseDto })
  @ApiProtectedErrorResponses()
  list(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ModelListResponseDto> {
    return this.modelsService.listAvailableModels(query, user.id);
  }
}

@ApiTags('Custom Models')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('v1/custom-models')
export class CustomModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  @ApiOperation({ summary: '列出当前用户自己的自定义模型' })
  @ApiOkResponse({ type: ModelListResponseDto })
  @ApiProtectedErrorResponses()
  list(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ModelListResponseDto> {
    return this.modelsService.listCustomModels(query, user.id);
  }

  @Post()
  @ApiOperation({ summary: '创建用户自定义 OpenAI-compatible 模型' })
  @ApiCreatedResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  async create(
    @Body() request: CreateCustomModelRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ModelResponseDto> {
    return { data: await this.modelsService.createCustomModel(request, user.id) };
  }

  @Patch(':id')
  @ApiOperation({ summary: '创建自定义模型的新草稿版本' })
  @ApiOkResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() request: UpdateCustomModelRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ModelResponseDto> {
    return { data: await this.modelsService.updateCustomModel(id, request, user.id) };
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发布自定义模型当前草稿版本' })
  @ApiOkResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  async publish(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ModelResponseDto> {
    return { data: await this.modelsService.publishModel(id, user.id, 'user') };
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '停用自定义模型' })
  @ApiOkResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  async disable(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ModelResponseDto> {
    return { data: await this.modelsService.disableCustomModel(id, user.id) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除自定义模型并立即清除其加密凭据' })
  @ApiOkResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ModelResponseDto> {
    return { data: await this.modelsService.deleteCustomModel(id, user.id) };
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '测试自定义模型连接，不回显凭据或原始错误体' })
  @ApiOkResponse({ type: ModelConnectionTestResponseDto })
  @ApiProtectedErrorResponses()
  async testConnection(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ModelConnectionTestResponseDto> {
    return { data: await this.modelsService.testConnection(id, user.id, 'user') };
  }
}

@ApiTags('Admin Models')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard, AdminRoleGuard)
@Controller('v1/admin/models')
export class AdminModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  @ApiOperation({ summary: '管理员列出系统模型' })
  @ApiOkResponse({ type: ModelListResponseDto })
  @ApiProtectedErrorResponses()
  list(@Query() query: PaginationQueryDto): Promise<ModelListResponseDto> {
    return this.modelsService.listAdminModels(query);
  }

  @Post()
  @ApiOperation({ summary: '管理员创建系统模型草稿' })
  @ApiCreatedResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  async create(
    @Body() request: CreateAdminModelRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ModelResponseDto> {
    return { data: await this.modelsService.createAdminModel(request, user.id) };
  }

  @Get(':id')
  @ApiOperation({ summary: '管理员查看系统模型详情，不返回明文凭据' })
  @ApiOkResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  async get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ModelResponseDto> {
    return { data: await this.modelsService.getAdminModel(id) };
  }

  @Patch(':id')
  @ApiOperation({ summary: '管理员创建或修改系统模型草稿版本' })
  @ApiOkResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() request: UpdateAdminModelRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ModelResponseDto> {
    return { data: await this.modelsService.updateAdminModel(id, request, user.id) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除未发布且未被引用的草稿模型' })
  @ApiOkResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ModelResponseDto> {
    return { data: await this.modelsService.deleteAdminModel(id, user.id) };
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发布模型当前草稿版本，仅影响新建会话' })
  @ApiOkResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  async publish(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ModelResponseDto> {
    return { data: await this.modelsService.publishModel(id, user.id) };
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '停用系统模型，不影响历史会话' })
  @ApiOkResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  async disable(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ModelResponseDto> {
    return { data: await this.modelsService.disableModel(id, user.id, 'system') };
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '管理员测试系统模型连接' })
  @ApiOkResponse({ type: ModelConnectionTestResponseDto })
  @ApiProtectedErrorResponses()
  async testConnection(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() _user: AuthenticatedUser,
  ): Promise<ModelConnectionTestResponseDto> {
    return { data: await this.modelsService.testConnection(id, undefined, 'system') };
  }

  @Post(':id/set-default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '将已发布系统模型设为新会话默认模型' })
  @ApiOkResponse({ type: ModelResponseDto })
  @ApiProtectedErrorResponses()
  async setDefault(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ModelResponseDto> {
    return { data: await this.modelsService.setDefaultModel(id, user.id) };
  }
}
