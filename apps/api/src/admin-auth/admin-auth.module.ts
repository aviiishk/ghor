import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthConfig } from './admin-auth.config';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtStrategy, AdminPreStrategy } from './admin-jwt.strategy';
import { AdminSessionsService } from './admin-sessions.service';
import { RecoveryCodesService } from './recovery-codes.service';
import { TotpService } from './totp.service';

@Module({
  imports: [PassportModule, JwtModule.register({}), AuthModule],
  controllers: [AdminAuthController],
  providers: [
    AdminAuthConfig,
    AdminAuthService,
    AdminSessionsService,
    AdminJwtStrategy,
    AdminPreStrategy,
    RecoveryCodesService,
    TotpService,
  ],
  exports: [AdminAuthConfig, AdminSessionsService, RecoveryCodesService],
})
export class AdminAuthModule {}
