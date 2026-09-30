import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { ListingsModule } from './listings/listings.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { ChatModule } from './chat/chat.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PushModule } from './push/push.module';
import { PushTokensModule } from './push-tokens/push-tokens.module';
import { ReviewsModule } from './reviews/reviews.module';
import { OwnersModule } from './owners/owners.module';
import { EventsModule } from './events/events.module';
import { AppConfigModule } from './app-config/app-config.module';
import { UploadsModule } from './uploads/uploads.module';
import { CoreModule } from './common/core.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { ModerationModule } from './moderation/moderation.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    // Tests supply their whole environment explicitly and must never pick up the local
    // .env (which points at the shared dev database).
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: process.env.NODE_ENV === 'test' }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CoreModule,
    AuthModule,
    ListingsModule,
    InstitutionsModule,
    ChatModule,
    ReportsModule,
    AdminModule,
    NotificationsModule,
    PushModule,
    PushTokensModule,
    ReviewsModule,
    OwnersModule,
    EventsModule,
    AppConfigModule,
    UploadsModule,
    AdminAuthModule,
    ModerationModule,
    JobsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
