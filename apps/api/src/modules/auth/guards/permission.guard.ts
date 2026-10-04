import { Reflector } from '@nestjs/core';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, SetMetadata } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { PermissionKey } from '@repo/shared';
import { DomainError } from '@repo/shared';
import { PrismaService } from '../../../database/prisma.service.js';

export const AUTH_COOKIE_NAME = 'fnl_session';
const AUTH_METADATA_KEY = 'permission';
const PUBLIC_METADATA_KEY = 'isPublic';

export interface RequestUser {
  id: string;
  permissions: string[];
}

export type AuthRequest = Request & { user?: RequestUser };

/** Marks a route as public (login, logout, health). */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(PUBLIC_METADATA_KEY, true);

/** Requires one permission key on top of authentication. */
export const RequirePermission = (
  permission: PermissionKey,
): MethodDecorator & ClassDecorator => SetMetadata(AUTH_METADATA_KEY, permission);

/**
 * Authenticates every request from the httpOnly JWT cookie.
 * PDF §3 / D-02 / D-03.
 *
 * Algorithm:
 *   1. Public routes pass through.
 *   2. Missing/invalid cookie -> 401 AUTH_REQUIRED.
 *   3. JWT holds only the user id; user + role + permissions load
 *      from the DB on every request (deactivation and role changes
 *      apply immediately).
 *   4. Missing/inactive user -> 401. Required key absent -> 403.
 *   5. Attaches `{ id, permissions }` to the request.
 * Ownership (driver 404s) lives inside later queries, not here.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[AUTH_COOKIE_NAME];
    if (typeof token !== 'string' || token === '') {
      throw required();
    }
    let userId: string;
    try {
      const payload = this.jwt.verify<{ sub: string }>(token);
      userId = payload.sub;
    } catch {
      throw required();
    }
    const user = await this.prisma.staffUser.findUnique({
      where: { id: userId },
      include: { role: { include: { permissions: true } } },
    });
    if (user === null || !user.isActive) {
      throw required();
    }
    const permissions = user.role.permissions.map((row) => row.permission);
    const needed = this.reflector.get<PermissionKey | undefined>(
      AUTH_METADATA_KEY,
      context.getHandler(),
    );
    if (needed !== undefined && !permissions.includes(needed)) {
      throw new DomainError({
        code: 'PERMISSION_DENIED',
        message: 'Permission denied',
        httpStatus: 403,
      });
    }
    request.user = { id: user.id, permissions };
    return true;
  }
}

function required(): DomainError {
  return new DomainError({
    code: 'AUTH_REQUIRED',
    message: 'Authentication required',
    httpStatus: 401,
  });
}
