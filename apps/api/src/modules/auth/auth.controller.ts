import type { Response } from 'express';
import { Body, Controller, Get, Header, HttpCode, Post, Res } from '@nestjs/common';
import { loginSchema } from '@repo/shared';
import type { LoginInput } from '@repo/shared';
import { isProduction } from '../../config/env.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { MePayload } from './auth.service.js';
import { AuthService } from './auth.service.js';
import { CurrentUser, Public } from './auth.decorator.js';
import type { RequestUser } from './auth.decorator.js';
import { AUTH_COOKIE_NAME } from './guards/permission.guard.js';

const COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** Auth endpoints. PDF §3. Cookie is first-party via the Next rewrite. */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Header('Cache-Control', 'no-store')
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MePayload> {
    const { me, token } = await this.auth.login(body.email, body.password);
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction(),
      maxAge: COOKIE_MAX_AGE_MS,
      path: '/',
    });
    return me;
  }

  @Public()
  @Header('Cache-Control', 'no-store')
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response): { ok: boolean } {
    res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @Header('Cache-Control', 'no-store')
  @Get('me')
  me(@CurrentUser() user: RequestUser): Promise<MePayload> {
    return this.auth.requireMe(user.id);
  }
}
