import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { DomainError } from '@repo/shared';
import { PrismaService } from '../../database/prisma.service.js';
import {
  INVALID_CREDENTIALS_MESSAGE,
  decideLogin,
} from './domain/authenticate.js';

export interface MePayload {
  id: string;
  name: string;
  email: string;
  /** Display only. Never used for logic; nav and guards use permissions. */
  roleName: string;
  permissions: string[];
  landingPath: string;
}

/** Valid bcrypt hash of an unused password; compared when no user is found. */
const DUMMY_HASH = '$2b$10$7Eq1yV1e8Q0x9Z3p5m8vQe9X2vY4w6u8i0o2p4r6t8v0x2z4a6c8e0g2';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Email is lowercased before lookup; unknown email and wrong
   * password fail identically via decideLogin. Returns the
   * session payload plus a signed JWT (user id only, D-02).
   */
  async login(email: string, password: string): Promise<{ me: MePayload; token: string }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.staffUser.findUnique({
      where: { email: normalized },
      include: { role: { include: { permissions: true } } },
    });
    const matches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    decideLogin({
      userFound: user !== null,
      passwordMatches: matches,
      isActive: user?.isActive ?? false,
    });
    if (user === null) {
      // Unreachable: decideLogin throws when userFound is false.
      throw new DomainError({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: INVALID_CREDENTIALS_MESSAGE,
        httpStatus: 401,
      });
    }
    return {
      me: toMe(user),
      token: this.jwt.sign({ sub: user.id }),
    };
  }

  /** Loads the session payload; null when unknown or deactivated (D-02). */
  async validateSession(userId: string): Promise<MePayload | null> {
    const user = await this.prisma.staffUser.findUnique({
      where: { id: userId },
      include: { role: { include: { permissions: true } } },
    });
    if (user === null || !user.isActive) {
      return null;
    }
    return toMe(user);
  }

  /** Same as validateSession but throws AUTH_REQUIRED for controllers. */
  async requireMe(userId: string): Promise<MePayload> {
    const me = await this.validateSession(userId);
    if (me === null) {
      throw new DomainError({
        code: 'AUTH_REQUIRED',
        message: 'Authentication required',
        httpStatus: 401,
      });
    }
    return me;
  }
}

interface UserWithRole {
  id: string;
  name: string;
  email: string;
  role: { name: string; landingPath: string; permissions: Array<{ permission: string }> };
}

function toMe(user: UserWithRole): MePayload {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleName: user.role.name,
    permissions: user.role.permissions.map((row) => row.permission),
    landingPath: user.role.landingPath,
  };
}
