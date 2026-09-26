import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// Photos are uploaded client-side to Cloudinary (root CLAUDE.md §14.7) — this DTO only
// ever receives the resulting URLs, never a file.
class ListingImageInput {
  // Only our own image host (security review 2026-09-26): an arbitrary URL here let a
  // listing point its photos at any external server — a tracking pixel on every
  // viewer, or content that never passed through our upload path.
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Matches(/^https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\//, {
    message: 'cloudinaryUrl must be a Cloudinary image URL',
  })
  cloudinaryUrl!: string;

  @IsInt()
  @Min(0)
  position!: number;
}

// Size limits (security review 2026-09-26): unbounded strings/arrays let one request
// store megabytes in a listing that every browse page then ships to every client.
export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsIn(['room', 'flat'])
  propertyType!: 'room' | 'flat';

  @IsInt()
  @Min(1)
  @Max(10_000_000)
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
  @MaxLength(100)
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
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ListingImageInput)
  images?: ListingImageInput[];

  // Curated institutions.id list, root CLAUDE.md §2 "Nearby institution tags" — validated
  // against the real table in the service layer, not just UUID-shape here.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  institutionIds?: string[];
}
