import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  // One single-use signature per photo. Signed-in users only; 429 past the hourly limit,
  // 503 when the server has no Cloudinary credentials (the client shows a config notice).
  @Post('signature')
  @HttpCode(200)
  signature(@CurrentUser() user: AuthenticatedUser) {
    return this.uploads.sign(user.userId);
  }
}
