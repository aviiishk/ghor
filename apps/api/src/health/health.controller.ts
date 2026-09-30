import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Liveness + database check for uptime monitors: 200 when the database answers, 503 when
// it doesn't (it used to return 200 with "degraded", which no monitor could alert on).
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected' };
    } catch {
      throw new ServiceUnavailableException({ status: 'degraded', database: 'unreachable', message: 'Database unreachable' });
    }
  }
}
