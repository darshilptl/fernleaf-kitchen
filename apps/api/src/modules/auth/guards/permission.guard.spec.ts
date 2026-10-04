import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DomainError } from '@repo/shared';
import { PrismaService } from '../../../database/prisma.service.js';
import { requireTestDatabaseUrl, truncateAll } from '../../../../test/db.js';
import { ensureBaseData } from '../base-data.js';
import { PermissionGuard } from './permission.guard.js';

const TEST_JWT_SECRET = 'guard-test-secret';

function contextFor(
  handler: () => void,
  cookies: unknown,
): { context: ExecutionContext; request: { cookies: unknown; user?: unknown } } {
  const request: { cookies: unknown; user?: unknown } = { cookies };
  const context = {
    getHandler: () => handler,
    getClass: () => PermissionGuard,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('PermissionGuard', () => {
  const prisma = new PrismaService(requireTestDatabaseUrl());
  const jwt = new JwtService({ secret: TEST_JWT_SECRET });
  const guard = new PermissionGuard(jwt, prisma, new Reflector());

  beforeEach(async () => {
    await truncateAll(prisma);
    await ensureBaseData(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects a missing cookie with AUTH_REQUIRED', async () => {
    const handler = (): void => {};
    const { context } = contextFor(handler, {});
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    });
  });

  it('rejects an invalid token with AUTH_REQUIRED', async () => {
    const handler = (): void => {};
    const { context } = contextFor(handler, { fnl_session: 'not-a-token' });
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    });
  });

  it('denies a missing permission key with PERMISSION_DENIED and attaches the user when allowed', async () => {
    const driver = await prisma.staffUser.findUniqueOrThrow({
      where: { email: 'driver@test.com' },
    });
    const token = jwt.sign({ sub: driver.id });

    const deniedHandler = (): void => {};
    Reflect.defineMetadata('permission', 'billing.manage', deniedHandler);
    const denied = contextFor(deniedHandler, { fnl_session: token });
    let failure: unknown;
    try {
      await guard.canActivate(denied.context);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(DomainError);
    expect((failure as DomainError).code).toBe('PERMISSION_DENIED');

    const allowedHandler = (): void => {};
    Reflect.defineMetadata('permission', 'deliveries.read_own', allowedHandler);
    const allowed = contextFor(allowedHandler, { fnl_session: token });
    await expect(guard.canActivate(allowed.context)).resolves.toBe(true);
    expect(allowed.request.user).toMatchObject({ id: driver.id });
  });
});
