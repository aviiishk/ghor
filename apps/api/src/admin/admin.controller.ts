import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { BanUserDto } from './dto/ban-user.dto';
import { SetConfigDto } from './dto/set-config.dto';
import { SetRoleDto } from './dto/set-role.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

// Everything here is founder-only (root CLAUDE.md §14.10) — the cross-cutting admin
// surface that doesn't belong to listings or reports (both of which own their own
// admin-guarded routes instead, see ListingsController's admin/* routes and
// ReportsController).
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  users() {
    return this.admin.listUsers();
  }

  @Patch('users/:id/ban')
  ban(@Param('id') id: string, @Body() dto: BanUserDto) {
    return this.admin.setBanned(id, dto.banned);
  }

  @Patch('users/:id/role')
  setRole(
    @CurrentUser() caller: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetRoleDto,
  ) {
    return this.admin.setRole(caller.userId, id, dto.role);
  }

  @Get('config')
  config() {
    return this.admin.listConfig();
  }

  @Patch('config/:key')
  setConfig(@Param('key') key: string, @Body() dto: SetConfigDto) {
    return this.admin.setConfig(key, dto.value);
  }

  @Get('analytics')
  analytics() {
    return this.admin.analytics();
  }
}
