import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
