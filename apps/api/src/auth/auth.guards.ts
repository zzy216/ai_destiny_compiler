import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';

import type { AuthenticatedRequest } from './auth-context';
import { AuthService } from './auth.service';

type RateLimitOptions = {
  max: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : '';
    if (!token) throw new UnauthorizedException('Missing access token');
    request.user = await this.auth.verifyAccessToken(token);
    return true;
  }
}

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException('Missing authenticated user');
    if (request.user.role !== 'admin') throw new ForbiddenException('Admin role is required');
    return true;
  }
}

@Injectable()
export class FixedWindowRateLimitGuard implements CanActivate {
  private readonly max: number;
  private readonly windowMs: number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(@Optional() @Inject('RATE_LIMIT_OPTIONS') options?: RateLimitOptions) {
    this.max = options?.max ?? 30;
    this.windowMs = options?.windowMs ?? 60_000;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const now = Date.now();
    const route = request.route?.path ?? request.url ?? 'unknown';
    const actor = request.user?.id ?? request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const key = `${request.method}:${route}:${actor}`;
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    bucket.count += 1;
    if (bucket.count > this.max) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
