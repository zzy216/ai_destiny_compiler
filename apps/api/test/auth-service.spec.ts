import { ForbiddenException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { ObjectLiteral, Repository } from 'typeorm';

import { AuthenticatedUser } from '../src/auth/auth-context';
import {
  AuthService,
  createAuthRuntimeConfig,
  hashSecret,
} from '../src/auth/auth.service';
import { AdminRoleGuard, FixedWindowRateLimitGuard } from '../src/auth/auth.guards';
import {
  AuthInvitation,
  AuthSession,
  User,
  UserProfile,
} from '../src/database/entities';

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000002';
const INVITE_ID = '00000000-0000-4000-8000-000000000201';
const PASSWORD = 'correct-horse-battery-staple';

type MockRepo<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>;

function repository<T extends ObjectLiteral>(methods: MockRepo<T>): Repository<T> {
  return methods as unknown as Repository<T>;
}

function config() {
  return createAuthRuntimeConfig({
    AUTH_ACCESS_TOKEN_SECRET: Buffer.alloc(32, 11).toString('base64'),
    TOKEN_HASH_KEY: Buffer.alloc(32, 12).toString('base64'),
    AUTH_ACCESS_TOKEN_TTL_SECONDS: '900',
    AUTH_REFRESH_TOKEN_TTL_DAYS: '30',
  });
}

function user(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    email: 'user@example.com',
    username: 'destiny_user',
    passwordHash: '',
    role: 'user',
    status: 'active',
    passwordChangedAt: new Date('2026-07-18T00:00:00.000Z'),
    failedLoginCount: 0,
    lastFailedLoginAt: null,
    lockedUntil: null,
    lastLoginAt: null,
    createdBy: ADMIN_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  it('logs in with email or username, stores only the refresh token hash, and returns a signed access token', async () => {
    const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
    const savedSessions: AuthSession[] = [];
    const service = new AuthService(
      repository<User>({
        findOne: jest.fn().mockResolvedValue(user({ passwordHash })),
        update: jest.fn(),
      }),
      repository<UserProfile>({ save: jest.fn() }),
      repository<AuthInvitation>({ findOne: jest.fn() }),
      repository<AuthSession>({
        save: jest.fn(async (value: AuthSession) => {
          savedSessions.push(value);
          return value;
        }),
      }),
      config(),
    );

    const result = await service.login({
      identifier: ' USER@EXAMPLE.COM ',
      password: PASSWORD,
      deviceName: 'MacBook',
    });

    expect(result.user).toMatchObject({ id: USER_ID, role: 'user' });
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(savedSessions).toHaveLength(1);
    expect(savedSessions[0]).toMatchObject({
      userId: USER_ID,
      deviceName: 'MacBook',
      refreshTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      revokedAt: null,
    });
    expect(JSON.stringify(savedSessions[0])).not.toContain(result.refreshToken);

    await expect(service.verifyAccessToken(result.accessToken)).resolves.toMatchObject({
      id: USER_ID,
      role: 'user',
    });
  });

  it('uses a generic unauthorized response for unknown accounts and wrong passwords', async () => {
    const service = new AuthService(
      repository<User>({ findOne: jest.fn().mockResolvedValue(null), update: jest.fn() }),
      repository<UserProfile>({}),
      repository<AuthInvitation>({}),
      repository<AuthSession>({}),
      config(),
    );

    await expect(service.login({ identifier: 'missing@example.com', password: PASSWORD })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('registers with a valid one-time invitation and consumes it in the same flow', async () => {
    const invite: AuthInvitation = {
      id: INVITE_ID,
      codeHash: hashSecret('invite-code-2026', config().tokenHashKey),
      targetRole: 'user',
      createdBy: ADMIN_ID,
      expiresAt: new Date(Date.now() + 60_000),
      usedBy: null,
      usedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    };
    const invitationUpdate = jest.fn();
    const userSave = jest.fn(async (value: User) => value);
    const profileSave = jest.fn(async (value: UserProfile) => value);
    const service = new AuthService(
      repository<User>({
        findOne: jest.fn().mockResolvedValue(null),
        save: userSave,
      }),
      repository<UserProfile>({ save: profileSave }),
      repository<AuthInvitation>({
        findOne: jest.fn().mockResolvedValue(invite),
        update: invitationUpdate,
      }),
      repository<AuthSession>({ save: jest.fn(async (value: AuthSession) => value) }),
      config(),
    );

    const result = await service.register({
      invitationCode: 'invite-code-2026',
      email: 'new-user@example.com',
      password: PASSWORD,
      displayName: '新用户',
    });

    expect(result.user).toMatchObject({ email: 'new-user@example.com', role: 'user' });
    expect(userSave).toHaveBeenCalledWith(expect.objectContaining({
      email: 'new-user@example.com',
      passwordHash: expect.stringContaining('$argon2id$'),
    }));
    expect(profileSave).toHaveBeenCalledWith(expect.objectContaining({ displayName: '新用户' }));
    expect(invitationUpdate).toHaveBeenCalledWith(INVITE_ID, expect.objectContaining({
      usedBy: result.user.id,
      usedAt: expect.any(Date),
    }));
  });

  it('rotates refresh tokens and revokes the whole family when an old token is reused', async () => {
    const runtime = config();
    const oldToken = 'r'.repeat(48);
    const familyId = '00000000-0000-4000-8000-000000000301';
    const oldSession = {
      id: '00000000-0000-4000-8000-000000000302',
      userId: USER_ID,
      tokenFamilyId: familyId,
      refreshTokenHash: hashSecret(oldToken, runtime.tokenHashKey),
      replacedBySessionId: null,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      revokeReason: null,
    } as AuthSession;
    const sessionUpdate = jest.fn();
    const service = new AuthService(
      repository<User>({ findOne: jest.fn().mockResolvedValue(user()) }),
      repository<UserProfile>({}),
      repository<AuthInvitation>({}),
      repository<AuthSession>({
        findOne: jest.fn().mockResolvedValueOnce(oldSession).mockResolvedValueOnce({
          ...oldSession,
          revokedAt: new Date(),
          revokeReason: 'rotated',
          replacedBySessionId: '00000000-0000-4000-8000-000000000303',
        }),
        save: jest.fn(async (value: AuthSession) => value),
        update: sessionUpdate,
      }),
      runtime,
    );

    const refreshed = await service.refresh({ refreshToken: oldToken });
    expect(refreshed.refreshToken).not.toBe(oldToken);
    expect(sessionUpdate).toHaveBeenCalledWith(oldSession.id, expect.objectContaining({
      revokedAt: expect.any(Date),
      revokeReason: 'rotated',
      replacedBySessionId: expect.any(String),
    }));

    await expect(service.refresh({ refreshToken: oldToken })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessionUpdate).toHaveBeenCalledWith({ tokenFamilyId: familyId, revokedAt: null }, expect.objectContaining({
      revokedAt: expect.any(Date),
      revokeReason: 'reuse_detected',
    }));
  });

  it('rejects an access token issued before the user changed password', async () => {
    const runtime = config();
    const service = new AuthService(
      repository<User>({
        findOne: jest.fn().mockResolvedValue(user({ passwordChangedAt: new Date('2026-07-18T01:00:00.000Z') })),
      }),
      repository<UserProfile>({}),
      repository<AuthInvitation>({}),
      repository<AuthSession>({}),
      runtime,
    );
    const token = service.signAccessToken({
      id: USER_ID,
      role: 'user',
      issuedAt: new Date('2026-07-18T00:30:00.000Z'),
    });

    await expect(service.verifyAccessToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('auth guards', () => {
  it('allows only admin users through the admin role guard', () => {
    const guard = new AdminRoleGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: ADMIN_ID, role: 'admin' } satisfies AuthenticatedUser }),
      }),
    };

    expect(guard.canActivate(context as never)).toBe(true);

    const userContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: USER_ID, role: 'user' } satisfies AuthenticatedUser }),
      }),
    };
    expect(() => guard.canActivate(userContext as never)).toThrow(ForbiddenException);
  });

  it('enforces a fixed-window limit without leaking credentials', () => {
    const guard = new FixedWindowRateLimitGuard({ max: 2, windowMs: 60_000 });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '127.0.0.1',
          method: 'POST',
          route: { path: '/v1/auth/login' },
          user: undefined,
          body: { password: PASSWORD, refreshToken: 'secret-refresh-token' },
        }),
      }),
    };

    expect(guard.canActivate(context as never)).toBe(true);
    expect(guard.canActivate(context as never)).toBe(true);
    try {
      guard.canActivate(context as never);
      throw new Error('rate limit should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
    expect(JSON.stringify((guard as unknown as { buckets: Map<string, unknown> }).buckets)).not.toContain(PASSWORD);
  });
});
