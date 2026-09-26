import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsIn, IsOptional } from 'class-validator';
import { CreateListingDto } from './create-listing.dto';

// `images` isn't editable through this endpoint — see CreateListingDto's comment.
// Content fields are all optional here (a PATCH, not a full replace).
export class UpdateListingDto extends PartialType(
  OmitType(CreateListingDto, ['images'] as const),
) {
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
