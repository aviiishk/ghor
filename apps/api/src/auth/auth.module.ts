import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { OtpService } from './otp.service';
import { DevLogSmsSender, SMS_SENDER } from './sms-sender';

@Module({
  imports: [
    PassportModule,
    // No global secret/expiry here — issueTokens() passes access/refresh secrets and
    // expiries per-call (two different secrets, two different lifetimes), so a single
    // module-wide JwtModule.register() config wouldn't fit both.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, OtpService, { provide: SMS_SENDER, useClass: DevLogSmsSender }],
  exports: [AuthService, OtpService],
})
export class AuthModule {}
