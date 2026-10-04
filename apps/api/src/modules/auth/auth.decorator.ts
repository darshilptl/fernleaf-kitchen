import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthRequest, RequestUser } from './guards/permission.guard.js';

export { Public, RequirePermission } from './guards/permission.guard.js';
export type { RequestUser } from './guards/permission.guard.js';

/** Reads the `{ id, permissions }` attached by PermissionGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestUser => {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = request.user;
    if (user === undefined) {
      throw new Error('CurrentUser used without PermissionGuard');
    }
    return user;
  },
);
