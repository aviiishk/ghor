import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppSettingsService } from './app-settings.service';

// Client-readable tunables (ad frequency, page size, feature flags). Only keys marked
// `public` in config-registry.ts are ever returned — server-only settings (auto-approval
// switches, claim TTLs, anything added later) never reach renters or owners (audit T-21).
// Writes: PATCH /admin/config/:key (configuration.manage + step-up).
@Controller('config')
@UseGuards(JwtAuthGuard)
export class AppConfigController {
  constructor(private readonly settings: AppSettingsService) {}

  @Get()
  getAll(): Promise<Record<string, unknown>> {
    return this.settings.publicValues();
  }
}
