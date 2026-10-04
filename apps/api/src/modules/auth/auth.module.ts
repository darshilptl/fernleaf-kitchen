import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service.js';
import { getEnv } from '../../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PermissionGuard } from './guards/permission.guard.js';

@Module({
  imports: [
    JwtModule.register({
      secret: getEnv().JWT_SECRET,
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, PermissionGuard],
  exports: [PermissionGuard, JwtModule],
})
export class AuthModule {}
