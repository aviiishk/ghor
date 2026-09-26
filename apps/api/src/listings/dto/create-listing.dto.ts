import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

// Photos are uploaded client-side to Cloudinary (root CLAUDE.md §14.7) — this DTO only
// ever receives the resulting URLs, never a file.
class ListingImageInput {
  @IsString()
  @IsNotEmpty()
  cloudinaryUrl!: string;

  @IsInt()
  @Min(0)
  position!: number;
}

export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['room', 'flat'])
  propertyType!: 'room' | 'flat';

  @IsInt()
  @Min(1)
  rent!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  deposit?: number;

  // Trimmed before validation (so "   " fails IsNotEmpty) — "Jalukbari " and "Jalukbari"
  // must be the same place for similar-listings matching. Inherited by UpdateListingDto.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  locality!: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsISO8601()
  availableFrom?: string;

  // Flexible flags (e.g. { wifi: true, parking: true }) — root CLAUDE.md §6, no fixed shape.
  @IsOptional()
  @IsObject()
  amenities?: Record<string, boolean>;

  // Only accepted on create — editing photos on an existing listing isn't built yet, see
  // apps/api/STATUS.md. Publishing (draft -> pending) enforces a 3-photo minimum against
  // whatever was set here, root CLAUDE.md §2/§6.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListingImageInput)
  images?: ListingImageInput[];

  // Curated institutions.id list, root CLAUDE.md §2 "Nearby institution tags" — validated
  // against the real table in the service layer, not just UUID-shape here.
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  institutionIds?: string[];
}
