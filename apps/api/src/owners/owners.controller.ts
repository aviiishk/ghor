import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { OwnersService } from './owners.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Login required like every other read (root CLAUDE.md §7.4).
@Controller('owners')
@UseGuards(JwtAuthGuard)
export class OwnersController {
  constructor(private readonly owners: OwnersService) {}

  @Get(':id')
  getOwner(@Param('id', ParseUUIDPipe) id: string) {
    return this.owners.getOwnerProfile(id);
  }
}
