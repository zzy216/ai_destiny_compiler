import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
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
import { contractNotImplemented } from '../common/contract-not-implemented';
import {
  AuthSessionResponseDto,
  ChangePasswordRequestDto,
  EmptyResponseDto,
  LoginRequestDto,
  LogoutRequestDto,
  RefreshTokenRequestDto,
  RegisterRequestDto,
} from './auth.dto';

@ApiTags('Auth')
@Controller('v1/auth')
export class AuthController {
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '使用邮箱或用户名登录' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiValidationErrorResponses()
  login(@Body() _request: LoginRequestDto): never {
    return contractNotImplemented();
  }

  @Post('register')
  @ApiOperation({ summary: '使用一次性邀请码注册' })
  @ApiCreatedResponse({ type: AuthSessionResponseDto })
  @ApiValidationErrorResponses()
  register(@Body() _request: RegisterRequestDto): never {
    return contractNotImplemented();
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '轮换 Refresh Token 并签发新会话凭据' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiValidationErrorResponses()
  refresh(@Body() _request: RefreshTokenRequestDto): never {
    return contractNotImplemented();
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '撤销当前设备会话' })
  @ApiOkResponse({ type: EmptyResponseDto })
  @ApiValidationErrorResponses()
  logout(@Body() _request: LogoutRequestDto): never {
    return contractNotImplemented();
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '修改密码并使既有会话失效' })
  @ApiOkResponse({ type: EmptyResponseDto })
  @ApiProtectedErrorResponses()
  changePassword(@Body() _request: ChangePasswordRequestDto): never {
    return contractNotImplemented();
  }
}
