import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsOptional } from 'class-validator';
import { CreateListingDto } from './create-listing.dto';

// Content fields are all optional here (a PATCH). `images`, when present, is the complete
// ordered photo list and REPLACES the listing's photos (position = array order) — that's
// how an owner adds, removes, reorders or re-covers photos from the Edit page
// (2026-09-27). Omit it to leave photos untouched.
export class UpdateListingDto extends PartialType(CreateListingDto) {
  // Deliberately NOT the full ListingStatus enum — `approved`/`rejected` and
  // `propertyVerified` are admin-only and not exposed here at all (root CLAUDE.md §6).
  // The two non-admin transitions this DTO allows — draft->pending (publish) and
  // approved<->rented (mark rented / mark available again) — are validated against the
  // listing's *current* status in ListingsService.update(), not just this type shape.
  // An admin caller (checked in the service, not here) may additionally pass
  // 'approved' | 'rejected'.
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected', 'rented'])
  status?: 'pending' | 'approved' | 'rejected' | 'rented';
}
