import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum UserRole {
  User = 'user',
  Admin = 'admin',
}

export class LoginRequestDto {
  @ApiProperty({
    description: '邮箱或用户名。错误响应不会暴露账号是否存在。',
    example: 'user@example.com',
    maxLength: 254,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  declare identifier: string;

  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  declare password: string;

  @ApiPropertyOptional({ maxLength: 100, example: 'iPhone 17' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  declare deviceName?: string;
}

export class RegisterRequestDto {
  @ApiProperty({ writeOnly: true, minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  declare invitationCode: string;

  @ApiPropertyOptional({ example: 'user@example.com', maxLength: 254 })
  @ValidateIf((value: RegisterRequestDto) =>
    Boolean(value.email !== undefined || !value.username),
  )
  @IsEmail()
  @MaxLength(254)
  declare email?: string;

  @ApiPropertyOptional({ example: 'destiny_user', minLength: 3, maxLength: 50 })
  @ValidateIf((value: RegisterRequestDto) =>
    Boolean(value.username !== undefined || !value.email),
  )
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  declare username?: string;

  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  declare password: string;

  @ApiPropertyOptional({ maxLength: 80, example: '小明' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  declare displayName?: string;

  @ApiPropertyOptional({ maxLength: 100, example: 'iPhone 17' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  declare deviceName?: string;
}

export class RefreshTokenRequestDto {
  @ApiProperty({ writeOnly: true, minLength: 32, maxLength: 2048 })
  @IsString()
  @Length(32, 2048)
  declare refreshToken: string;
}

export class LogoutRequestDto extends RefreshTokenRequestDto {}

export class ChangePasswordRequestDto {
  @ApiProperty({ writeOnly: true, minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  declare currentPassword: string;

  @ApiProperty({ writeOnly: true, minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  declare newPassword: string;
}

export class PublicUserDto {
  @ApiProperty({ format: 'uuid' })
  declare id: string;

  @ApiPropertyOptional({ nullable: true, example: 'user@example.com' })
  declare email: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'destiny_user' })
  declare username: string | null;

  @ApiProperty({ enum: UserRole })
  declare role: UserRole;

  @ApiProperty({ enum: ['active', 'disabled', 'locked'] })
  declare status: 'active' | 'disabled' | 'locked';
}

export class AuthSessionDto {
  @ApiProperty({ description: '短期 Access Token', writeOnly: true })
  declare accessToken: string;

  @ApiProperty({ description: '轮换使用的 Refresh Token', writeOnly: true })
  declare refreshToken: string;

  @ApiProperty({ example: 900 })
  declare expiresInSeconds: number;

  @ApiProperty({ type: PublicUserDto })
  declare user: PublicUserDto;
}

export class AuthSessionResponseDto {
  @ApiProperty({ type: AuthSessionDto })
  declare data: AuthSessionDto;
}

export class EmptyDataDto {
  @ApiProperty({ example: true })
  declare success: boolean;
}

export class EmptyResponseDto {
  @ApiProperty({ type: EmptyDataDto })
  declare data: EmptyDataDto;
}
