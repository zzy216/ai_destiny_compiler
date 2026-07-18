import { ForbiddenException } from '@nestjs/common';

import { DevelopmentAdminGuard } from '../src/admin/development-admin.guard';

describe('DevelopmentAdminGuard', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('allows development and test environments', () => {
    const guard = new DevelopmentAdminGuard();
    process.env.NODE_ENV = 'test';
    expect(guard.canActivate({} as never)).toBe(true);
  });

  it('blocks accidental production exposure before real auth is implemented', () => {
    const guard = new DevelopmentAdminGuard();
    process.env.NODE_ENV = 'production';
    expect(() => guard.canActivate({} as never)).toThrow(ForbiddenException);
  });
});
