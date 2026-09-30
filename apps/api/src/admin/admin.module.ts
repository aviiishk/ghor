import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { ReportsModule } from '../reports/reports.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { ListingsModule } from '../listings/listings.module';
import { ModerationModule } from '../moderation/moderation.module';
import { AdminAccountsService } from './admin-accounts.service';
import { UsersAdminService } from './users-admin.service';
import { AdminReadService } from './admin-read.service';
import {
  AdminAuditController,
  AdminConfigController,
  AdminDashboardController,
  AdminMarketplaceUsersController,
  AdminReportsController,
  AdminReviewsController,
  AdminSystemController,
  AdminTrustController,
  AdminUsersController,
} from './admin-console.controllers';
import { LegacyAdminController } from './legacy-admin.controller';

// The admin console API (/admin/*, admin-audience tokens only) plus the hardened legacy
// endpoints (/legacy-admin/*) the old apps/web admin uses until retirement (D-46).
@Module({
  imports: [AdminAuthModule, ReportsModule, ReviewsModule, ListingsModule, ModerationModule],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminMarketplaceUsersController,
    AdminReportsController,
    AdminReviewsController,
    AdminConfigController,
    AdminAuditController,
    AdminSystemController,
    AdminTrustController,
    LegacyAdminController,
  ],
  providers: [AdminAccountsService, UsersAdminService, AdminReadService],
})
export class AdminModule {}
