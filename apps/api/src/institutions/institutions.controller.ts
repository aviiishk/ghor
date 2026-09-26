import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Curated, admin-managed list — root CLAUDE.md §2 "Nearby institution tags". Read-only
// here: no self-serve create/update/delete at MVP, matches the manual-scale philosophy
// (§11) already used for moderation. The table is currently empty — see
// apps/api/STATUS.md; this endpoint works, there's just nothing in it yet.
@Controller('institutions')
@UseGuards(JwtAuthGuard)
export class InstitutionsController {
  constructor(private readonly prisma: PrismaService) {}

  // ?search= powers the listing form's type-ahead; ?city= scopes the browse-feed filter
  // bar and the type-ahead alike (defaults to Guwahati, the only seeded city at MVP).
  @Get()
  findAll(@Query('search') search?: string, @Query('city') city?: string) {
    return this.prisma.institution.findMany({
      where: {
        city: city ?? 'Guwahati',
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }
}
