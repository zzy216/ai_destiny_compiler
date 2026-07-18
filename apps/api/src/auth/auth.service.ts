import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import type { ObjectLiteral, Repository } from 'typeorm';

import {
  AuthInvitation,
  AuthSession,
  User,
  UserProfile,
} from '../database/entities';
import type {
  AuthSessionDto,
  ChangePasswordRequestDto,
  LoginRequestDto,
  PublicUserDto,
  RefreshTokenRequestDto,
  RegisterRequestDto,
} from './auth.dto';
import type { AuthenticatedUser } from './auth-context';

export const AUTH_RUNTIME_CONFIG = Symbol('AUTH_RUNTIME_CONFIG');

export type AuthRuntimeConfig = {
  accessTokenSecret: Buffer;
  tokenHashKey: Buffer;
  accessTokenTtlSeconds: number;
  refreshTokenTtlMs: number;
};

type AccessTokenPayload = {
  sub: string;
  role: 'user' | 'admin';
  iat: number;
  exp: number;
};

const GENERIC_AUTH_ERROR = 'Invalid credentials';
const DEFAULT_ACCESS_TTL_SECONDS = 900;
const DEFAULT_REFRESH_TTL_DAYS = 30;

function parseBase64Key(value: string | undefined, name: string): Buffer {
  if (!value && process.env.NODE_ENV === 'test') {
    return Buffer.alloc(32, name === 'TOKEN_HASH_KEY' ? 22 : 21);
  }
  if (!value) throw new Error(`${name} is required`);
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length !== 32 || decoded.toString('base64') !== value) {
    throw new Error(`${name} must be a canonical base64-encoded 32-byte key`);
  }
  return decoded;
}

function parsePositiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlJson(value: unknown): string {
  return base64UrlEncode(JSON.stringify(value));
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAuthRuntimeConfig(env: NodeJS.ProcessEnv = process.env): AuthRuntimeConfig {
  return {
    accessTokenSecret: parseBase64Key(env.AUTH_ACCESS_TOKEN_SECRET, 'AUTH_ACCESS_TOKEN_SECRET'),
    tokenHashKey: parseBase64Key(env.TOKEN_HASH_KEY, 'TOKEN_HASH_KEY'),
    accessTokenTtlSeconds: parsePositiveInteger(
      env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
      DEFAULT_ACCESS_TTL_SECONDS,
      'AUTH_ACCESS_TOKEN_TTL_SECONDS',
    ),
    refreshTokenTtlMs:
      parsePositiveInteger(env.AUTH_REFRESH_TOKEN_TTL_DAYS, DEFAULT_REFRESH_TTL_DAYS, 'AUTH_REFRESH_TOKEN_TTL_DAYS') *
      24 *
      60 *
      60 *
      1000,
  };
}

export function hashSecret(secret: string, key: Buffer): string {
  return createHmac('sha256', key).update(secret).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    @Optional() @InjectRepository(User) private readonly users?: Repository<User>,
    @Optional() @InjectRepository(UserProfile) private readonly profiles?: Repository<UserProfile>,
    @Optional() @InjectRepository(AuthInvitation) private readonly invitations?: Repository<AuthInvitation>,
    @Optional() @InjectRepository(AuthSession) private readonly sessions?: Repository<AuthSession>,
    @Optional() @Inject(AUTH_RUNTIME_CONFIG) private readonly config: AuthRuntimeConfig = createAuthRuntimeConfig(),
  ) {}

  async login(input: LoginRequestDto): Promise<AuthSessionDto> {
    const identifier = input.identifier.trim().toLocaleLowerCase();
    const user = await this.userRepository().findOne({
      where: identifier.includes('@') ? { email: identifier } : { username: identifier },
    });
    if (!user) throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    await this.assertCanAuthenticate(user);
    const passwordMatches = await argon2.verify(user.passwordHash, input.password).catch(() => false);
    if (!passwordMatches) {
      await this.userRepository().update(user.id, {
        failedLoginCount: user.failedLoginCount + 1,
        lastFailedLoginAt: new Date(),
      });
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }
    await this.userRepository().update(user.id, {
      failedLoginCount: 0,
      lastFailedLoginAt: null,
      lockedUntil: null,
      lastLoginAt: new Date(),
    });
    return this.createSession(user, input.deviceName);
  }

  async register(input: RegisterRequestDto): Promise<AuthSessionDto> {
    const email = input.email?.trim().toLocaleLowerCase() ?? null;
    const username = input.username?.trim().toLocaleLowerCase() ?? null;
    if (!email && !username) throw new BadRequestException('email or username is required');

    const invitation = await this.invitationRepository().findOne({
      where: { codeHash: hashSecret(input.invitationCode, this.config.tokenHashKey) },
    });
    const now = new Date();
    if (!invitation || invitation.usedAt || invitation.revokedAt || invitation.expiresAt <= now) {
      throw new UnauthorizedException('Invalid invitation');
    }
    if (email && await this.userRepository().findOne({ where: { email } })) {
      throw new BadRequestException('email is already registered');
    }
    if (username && await this.userRepository().findOne({ where: { username } })) {
      throw new BadRequestException('username is already registered');
    }

    const user = this.createEntity(this.userRepository(), {
      id: randomUUID(),
      email,
      username,
      passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }),
      role: invitation.targetRole,
      status: 'active',
      passwordChangedAt: now,
      failedLoginCount: 0,
      lastFailedLoginAt: null,
      lockedUntil: null,
      lastLoginAt: now,
      createdBy: invitation.createdBy,
      createdAt: now,
      updatedAt: now,
    } as User);
    const savedUser = await this.userRepository().save(user);
    await this.profileRepository().save(this.createEntity(this.profileRepository(), {
      userId: savedUser.id,
      displayName: input.displayName ?? null,
      timezone: 'Asia/Shanghai',
      locale: 'zh-CN',
      onboardingCompleted: false,
      preferences: {},
      createdAt: now,
      updatedAt: now,
    } as UserProfile));
    await this.invitationRepository().update(invitation.id, {
      usedBy: savedUser.id,
      usedAt: now,
    });
    return this.createSession(savedUser, input.deviceName);
  }

  async refresh(input: RefreshTokenRequestDto): Promise<AuthSessionDto> {
    const tokenHash = hashSecret(input.refreshToken, this.config.tokenHashKey);
    const existing = await this.sessionRepository().findOne({ where: { refreshTokenHash: tokenHash } });
    if (!existing) throw new UnauthorizedException('Invalid refresh token');
    if (existing.revokedAt) {
      if (existing.replacedBySessionId) {
        await this.sessionRepository().update(
          { tokenFamilyId: existing.tokenFamilyId, revokedAt: null } as never,
          { revokedAt: new Date(), revokeReason: 'reuse_detected' },
        );
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (existing.expiresAt <= new Date()) throw new UnauthorizedException('Invalid refresh token');

    const user = await this.userRepository().findOne({ where: { id: existing.userId } });
    if (!user) throw new UnauthorizedException('Invalid refresh token');
    await this.assertCanAuthenticate(user);
    const rotated = await this.createSession(user, existing.deviceName ?? undefined, existing.tokenFamilyId);
    await this.sessionRepository().update(existing.id, {
      revokedAt: new Date(),
      revokeReason: 'rotated',
      replacedBySessionId: this.lastCreatedSessionId,
      lastUsedAt: new Date(),
    });
    return rotated;
  }

  async logout(input: RefreshTokenRequestDto): Promise<{ success: true }> {
    await this.sessionRepository().update(
      { refreshTokenHash: hashSecret(input.refreshToken, this.config.tokenHashKey), revokedAt: null } as never,
      { revokedAt: new Date(), revokeReason: 'logout' },
    );
    return { success: true };
  }

  async changePassword(userId: string, input: ChangePasswordRequestDto): Promise<{ success: true }> {
    const user = await this.userRepository().findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    await this.assertCanAuthenticate(user);
    const passwordMatches = await argon2.verify(user.passwordHash, input.currentPassword).catch(() => false);
    if (!passwordMatches) throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    const now = new Date();
    await this.userRepository().update(user.id, {
      passwordHash: await argon2.hash(input.newPassword, { type: argon2.argon2id }),
      passwordChangedAt: now,
      failedLoginCount: 0,
      lastFailedLoginAt: null,
      lockedUntil: null,
    });
    await this.sessionRepository().update(
      { userId: user.id, revokedAt: null } as never,
      { revokedAt: now, revokeReason: 'password_changed' },
    );
    return { success: true };
  }

  signAccessToken(input: { id: string; role: 'user' | 'admin'; issuedAt?: Date }): string {
    const issuedAt = Math.floor((input.issuedAt?.getTime() ?? Date.now()) / 1000);
    const payload: AccessTokenPayload = {
      sub: input.id,
      role: input.role,
      iat: issuedAt,
      exp: issuedAt + this.config.accessTokenTtlSeconds,
    };
    const header = base64UrlJson({ alg: 'HS256', typ: 'JWT' });
    const body = base64UrlJson(payload);
    const signature = this.sign(`${header}.${body}`);
    return `${header}.${body}.${signature}`;
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    const parts = token.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Invalid access token');
    const [header, body, signature] = parts as [string, string, string];
    if (!safeEqual(signature, this.sign(`${header}.${body}`))) {
      throw new UnauthorizedException('Invalid access token');
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<AccessTokenPayload>;
    if (!payload.sub || (payload.role !== 'user' && payload.role !== 'admin') || !payload.iat || !payload.exp) {
      throw new UnauthorizedException('Invalid access token');
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) throw new UnauthorizedException('Access token expired');
    const user = await this.userRepository().findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Invalid access token');
    if (user.status !== 'active') throw new ForbiddenException('User is not active');
    if (Math.floor(user.passwordChangedAt.getTime() / 1000) > payload.iat) {
      throw new UnauthorizedException('Access token expired');
    }
    return { id: user.id, role: user.role as 'user' | 'admin' };
  }

  private lastCreatedSessionId: string | null = null;

  private async createSession(user: User, deviceName?: string, tokenFamilyId: string = randomUUID()): Promise<AuthSessionDto> {
    const refreshToken = base64UrlEncode(randomBytes(48));
    const sessionId = randomUUID();
    this.lastCreatedSessionId = sessionId;
    await this.sessionRepository().save(this.createEntity(this.sessionRepository(), {
      id: sessionId,
      userId: user.id,
      tokenFamilyId,
      refreshTokenHash: hashSecret(refreshToken, this.config.tokenHashKey),
      replacedBySessionId: null,
      deviceName: deviceName ?? null,
      userAgent: null,
      ipAddress: null,
      expiresAt: new Date(Date.now() + this.config.refreshTokenTtlMs),
      lastUsedAt: null,
      revokedAt: null,
      revokeReason: null,
      createdAt: new Date(),
    } as AuthSession));
    return {
      accessToken: this.signAccessToken({ id: user.id, role: user.role as 'user' | 'admin' }),
      refreshToken,
      expiresInSeconds: this.config.accessTokenTtlSeconds,
      user: this.publicUser(user),
    };
  }

  private async assertCanAuthenticate(user: User): Promise<void> {
    if (user.status === 'disabled') throw new ForbiddenException('User is disabled');
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new ForbiddenException('User is temporarily locked');
  }

  private publicUser(user: User): PublicUserDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role as PublicUserDto['role'],
      status: user.status as PublicUserDto['status'],
    };
  }

  private sign(value: string): string {
    return createHmac('sha256', this.config.accessTokenSecret).update(value).digest('base64url');
  }

  private createEntity<T extends ObjectLiteral>(repository: Repository<T>, value: T): T {
    return typeof repository.create === 'function' ? repository.create(value) : value;
  }

  private userRepository(): Repository<User> {
    if (!this.users) throw new Error('User repository is not configured');
    return this.users;
  }

  private profileRepository(): Repository<UserProfile> {
    if (!this.profiles) throw new Error('UserProfile repository is not configured');
    return this.profiles;
  }

  private invitationRepository(): Repository<AuthInvitation> {
    if (!this.invitations) throw new Error('AuthInvitation repository is not configured');
    return this.invitations;
  }

  private sessionRepository(): Repository<AuthSession> {
    if (!this.sessions) throw new Error('AuthSession repository is not configured');
    return this.sessions;
  }
}
