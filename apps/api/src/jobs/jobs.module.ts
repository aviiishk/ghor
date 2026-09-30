import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module';
import { ModerationModule } from '../moderation/moderation.module';
import { AutoApprovalJob } from './auto-approval.job';
import { OutboxWorker } from './outbox.worker';

// Background jobs. Scheduling is in-process (@nestjs/schedule) but coordination is in
// Postgres (JobRunnerService lease), so any number of API instances is safe. Set
// JOBS_ENABLED=false to run an instance that serves HTTP only.
@Module({
  imports: [PushModule, ModerationModule],
  providers: [AutoApprovalJob, OutboxWorker],
  exports: [AutoApprovalJob, OutboxWorker],
})
export class JobsModule {}
