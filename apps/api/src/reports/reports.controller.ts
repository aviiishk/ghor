import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { RateLimit, RateLimitGuard } from '../rate-limit/rate-limit.guard';

// Marketplace side only. Admin report handling moved to /admin/reports (console) and
// /legacy-admin/reports (legacy web admin) — Phase 0, 2026-09-29.
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // Any authenticated user can report a listing — reporterId is always the caller,
  // never client-supplied (root CLAUDE.md §6's `reports` authorization rule).
  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'report-create', scope: 'principal', limit: 20, windowSeconds: 60 * 60 })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto) {
    return this.reports.create(user.userId, dto);
  }
}
