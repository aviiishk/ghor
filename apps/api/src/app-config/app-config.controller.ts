import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Root CLAUDE.md §6/§14.6: app_config is readable by every authenticated user (clients
// read ad frequency, page size, feature flags at startup); writes stay admin-only via
// PATCH /admin/config/:key. Returned as a flat { key: value } object.
@Controller('config')
@UseGuards(JwtAuthGuard)
export class AppConfigController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getAll(): Promise<Record<string, unknown>> {
    const rows = await this.prisma.appConfig.findMany({ select: { key: true, value: true } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
}
