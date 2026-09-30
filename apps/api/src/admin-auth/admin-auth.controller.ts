import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import {
  AdminRefreshDto,
  AdminSendOtpDto,
  AdminVerifyOtpDto,
  BreakGlassDto,
  RecoveryCodeDto,
  TotpCodeDto,
} from './admin-auth.dto';
import { AdminOriginGuard } from './admin-api.decorator';
import {
  AdminJwtGuard,
  AdminPreGuard,
  BACKGROUND_HEADER,
} from './admin-jwt.strategy';
import { AuditService } from '../audit/audit.service';
import {
  AdminPreAuth,
  AdminPublic,
  AdminSelfService,
  RequireStepUp,
} from '../permissions/decorators';
import { PermissionGuard } from '../permissions/permission.guard';
import { StepUpGuard } from '../permissions/step-up.guard';
import { RateLimit, RateLimitGuard } from '../rate-limit/rate-limit.guard';
import type { AdminPrePrincipal, AdminPrincipal } from '../auth/principal';

type AdminReq = Request & { user: AdminPrincipal };
type PreReq = Request & { user: AdminPrePrincipal };

// Every admin browser request arrives through the admin BFF (one server IP for all
// admins), so per-IP limits here are coarse ceilings against floods; the fine-grained
// limits are per phone number (OTP) and per admin account (TOTP lockout, 5 → 15 min).
const IP_CEILING = { scope: 'ip' as const, limit: 60, windowSeconds: 15 * 60 };

@Controller('admin/auth')
@UseGuards(AdminOriginGuard)
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('otp/send')
  @HttpCode(200)
  @AdminPublic()
  @UseGuards(RateLimitGuard)
  @RateLimit(
    { name: 'admin-otp-send', ...IP_CEILING },
    {
      name: 'admin-otp-send',
      scope: 'phone',
      limit: 5,
      windowSeconds: 15 * 60,
    },
  )
  sendOtp(@Body() dto: AdminSendOtpDto, @Req() req: Request) {
    return this.auth.sendOtp(dto.phone, AuditService.context(req));
  }

  @Post('otp/verify')
  @HttpCode(200)
  @AdminPublic()
  @UseGuards(RateLimitGuard)
  @RateLimit(
    { name: 'admin-otp-verify', ...IP_CEILING },
    {
      name: 'admin-otp-verify',
      scope: 'phone',
      limit: 10,
      windowSeconds: 15 * 60,
    },
  )
  verifyOtp(@Body() dto: AdminVerifyOtpDto, @Req() req: Request) {
    return this.auth.verifyOtp(dto.phone, dto.code, AuditService.context(req));
  }

  @Post('break-glass')
  @HttpCode(200)
  @AdminPublic()
  @UseGuards(RateLimitGuard)
  @RateLimit({
    name: 'admin-break-glass',
    scope: 'ip',
    limit: 10,
    windowSeconds: 60 * 60,
  })
  breakGlass(@Body() dto: BreakGlassDto, @Req() req: Request) {
    return this.auth.activateBreakGlass(
      dto.breakGlassToken,
      AuditService.context(req),
    );
  }

  @Post('totp/enroll')
  @HttpCode(200)
  @AdminPreAuth()
  @UseGuards(AdminPreGuard, RateLimitGuard)
  @RateLimit({
    name: 'admin-totp-enroll',
    scope: 'principal',
    limit: 10,
    windowSeconds: 15 * 60,
  })
  enroll(@Req() req: PreReq) {
    return this.auth.startEnrollment(
      req.user,
      AuditService.context(req, req.user),
    );
  }

  @Post('totp/enroll/confirm')
  @HttpCode(200)
  @AdminPreAuth()
  @UseGuards(AdminPreGuard, RateLimitGuard)
  @RateLimit({
    name: 'admin-totp',
    scope: 'principal',
    limit: 10,
    windowSeconds: 15 * 60,
  })
  confirmEnrollment(@Body() dto: TotpCodeDto, @Req() req: PreReq) {
    return this.auth.confirmEnrollment(
      req.user,
      dto.code,
      AuditService.context(req, req.user),
    );
  }

  @Post('totp/verify')
  @HttpCode(200)
  @AdminPreAuth()
  @UseGuards(AdminPreGuard, RateLimitGuard)
  @RateLimit({
    name: 'admin-totp',
    scope: 'principal',
    limit: 10,
    windowSeconds: 15 * 60,
  })
  verifyTotp(@Body() dto: TotpCodeDto, @Req() req: PreReq) {
    return this.auth.verifyTotp(
      req.user,
      dto.code,
      AuditService.context(req, req.user),
    );
  }

  @Post('recovery/verify')
  @HttpCode(200)
  @AdminPreAuth()
  @UseGuards(AdminPreGuard, RateLimitGuard)
  @RateLimit({
    name: 'admin-recovery',
    scope: 'principal',
    limit: 5,
    windowSeconds: 15 * 60,
  })
  useRecoveryCode(@Body() dto: RecoveryCodeDto, @Req() req: PreReq) {
    return this.auth.useRecoveryCode(
      req.user,
      dto.recoveryCode,
      AuditService.context(req, req.user),
    );
  }

  @Post('refresh')
  @HttpCode(200)
  @AdminPublic()
  @UseGuards(RateLimitGuard)
  @RateLimit({
    name: 'admin-refresh',
    scope: 'ip',
    limit: 600,
    windowSeconds: 15 * 60,
  })
  refresh(@Body() dto: AdminRefreshDto, @Req() req: Request) {
    return this.auth.refresh(
      dto.refreshToken,
      req.headers[BACKGROUND_HEADER] === '1',
      AuditService.context(req),
    );
  }

  @Post('step-up')
  @HttpCode(200)
  @AdminSelfService()
  @UseGuards(AdminJwtGuard, PermissionGuard, RateLimitGuard)
  @RateLimit({
    name: 'admin-step-up',
    scope: 'principal',
    limit: 10,
    windowSeconds: 15 * 60,
  })
  stepUp(@Body() dto: TotpCodeDto, @Req() req: AdminReq) {
    return this.auth.stepUp(
      req.user,
      dto.code,
      AuditService.context(req, req.user),
    );
  }

  @Post('recovery/regenerate')
  @HttpCode(200)
  @AdminSelfService()
  @RequireStepUp()
  @UseGuards(AdminJwtGuard, PermissionGuard, StepUpGuard, RateLimitGuard)
  @RateLimit({
    name: 'admin-recovery-regen',
    scope: 'principal',
    limit: 5,
    windowSeconds: 60 * 60,
  })
  regenerate(@Req() req: AdminReq) {
    return this.auth.regenerateRecoveryCodes(
      req.user,
      AuditService.context(req, req.user),
    );
  }

  @Post('logout')
  @HttpCode(204)
  @AdminSelfService()
  @UseGuards(AdminJwtGuard, PermissionGuard)
  async logout(@Req() req: AdminReq) {
    await this.auth.logout(req.user, AuditService.context(req, req.user));
  }

  @Get('me')
  @AdminSelfService()
  @UseGuards(AdminJwtGuard, PermissionGuard, RateLimitGuard)
  me(@Req() req: AdminReq) {
    return this.auth.me(req.user);
  }

  @Get('sessions')
  @AdminSelfService()
  @UseGuards(AdminJwtGuard, PermissionGuard, RateLimitGuard)
  sessions(@Req() req: AdminReq) {
    return this.auth.listSessions(req.user);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @AdminSelfService()
  @UseGuards(AdminJwtGuard, PermissionGuard, RateLimitGuard)
  async revokeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AdminReq,
  ) {
    await this.auth.revokeOwnSession(
      req.user,
      id,
      AuditService.context(req, req.user),
    );
  }
}
