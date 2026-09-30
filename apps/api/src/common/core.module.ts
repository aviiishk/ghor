import { Global, Module } from '@nestjs/common';
import { Clock } from './clock';
import { AuditService } from '../audit/audit.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { OutboxService } from '../outbox/outbox.service';
import { AlertsService } from '../alerts/alerts.service';
import { JobRunnerService } from '../jobs/job-runner.service';
import { AppSettingsService } from '../app-config/app-settings.service';
import { PermissionGuard } from '../permissions/permission.guard';
import { StepUpGuard } from '../permissions/step-up.guard';

// Cross-cutting services every feature module needs (audit, rate limits, outbox, alerts,
// settings, clock) plus the authorization guards — global so modules don't each have to
// import them, and so there is exactly one instance of each.
const SHARED = [
  Clock,
  AuditService,
  RateLimitService,
  RateLimitGuard,
  OutboxService,
  AlertsService,
  JobRunnerService,
  AppSettingsService,
  PermissionGuard,
  StepUpGuard,
];

@Global()
@Module({ providers: SHARED, exports: SHARED })
export class CoreModule {}
