import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  AuthInvitation,
  AuthSession,
  User,
  UserProfile,
} from '../database/entities';
import { AuthController } from './auth.controller';
import { AdminRoleGuard, AuthGuard, FixedWindowRateLimitGuard } from './auth.guards';
import { AUTH_RUNTIME_CONFIG, AuthService, createAuthRuntimeConfig } from './auth.service';

const persistenceEnabled = process.env.NODE_ENV !== 'test' && process.env.DATABASE_ENABLED !== 'false';

@Global()
@Module({
  imports: persistenceEnabled
    ? [TypeOrmModule.forFeature([User, UserProfile, AuthInvitation, AuthSession])]
    : [],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    AdminRoleGuard,
    FixedWindowRateLimitGuard,
    ...(persistenceEnabled
      ? [{ provide: AUTH_RUNTIME_CONFIG, useFactory: () => createAuthRuntimeConfig() }]
      : []),
  ],
  exports: [AuthService, AuthGuard, AdminRoleGuard, FixedWindowRateLimitGuard],
})
export class AuthModule {}
