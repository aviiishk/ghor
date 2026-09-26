import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // Any authenticated user can report a listing — reporterId is always the caller,
  // never client-supplied (root CLAUDE.md §6's `reports` authorization rule).
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto) {
    return this.reports.create(user.userId, dto);
  }

  @Get()
  @UseGuards(AdminGuard)
  findOpen() {
    return this.reports.findOpen();
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  resolve(@Param('id') id: string, @Body() dto: ResolveReportDto) {
    return this.reports.resolve(id, dto.action);
  }
}
