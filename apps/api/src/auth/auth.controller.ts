import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  ApiProtectedErrorResponses,
  ApiValidationErrorResponses,
} from '../common/api-error-responses.decorator';
import { CurrentUser, type AuthenticatedUser } from './auth-context';
import { AuthGuard, FixedWindowRateLimitGuard } from './auth.guards';
import {
  AuthSessionResponseDto,
  ChangePasswordRequestDto,
  EmptyResponseDto,
  LoginRequestDto,
  LogoutRequestDto,
  RefreshTokenRequestDto,
  RegisterRequestDto,
} from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(FixedWindowRateLimitGuard)
  @ApiOperation({ summary: '使用邮箱或用户名登录' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiValidationErrorResponses()
  async login(@Body() request: LoginRequestDto): Promise<AuthSessionResponseDto> {
    return { data: await this.auth.login(request) };
  }

  @Post('register')
  @UseGuards(FixedWindowRateLimitGuard)
  @ApiOperation({ summary: '使用一次性邀请码注册' })
  @ApiCreatedResponse({ type: AuthSessionResponseDto })
  @ApiValidationErrorResponses()
  async register(@Body() request: RegisterRequestDto): Promise<AuthSessionResponseDto> {
    return { data: await this.auth.register(request) };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(FixedWindowRateLimitGuard)
  @ApiOperation({ summary: '轮换 Refresh Token 并签发新会话凭据' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiValidationErrorResponses()
  async refresh(@Body() request: RefreshTokenRequestDto): Promise<AuthSessionResponseDto> {
    return { data: await this.auth.refresh(request) };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '撤销当前设备会话' })
  @ApiOkResponse({ type: EmptyResponseDto })
  @ApiValidationErrorResponses()
  async logout(@Body() request: LogoutRequestDto): Promise<EmptyResponseDto> {
    return { data: await this.auth.logout(request) };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(FixedWindowRateLimitGuard, AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '修改密码并使既有会话失效' })
  @ApiOkResponse({ type: EmptyResponseDto })
  @ApiProtectedErrorResponses()
  async changePassword(
    @Body() request: ChangePasswordRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmptyResponseDto> {
    return { data: await this.auth.changePassword(user.id, request) };
  }
}
