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
  Max,
  MaxLength,
  Min,
  ValidateBy,
  ValidateNested,
  type ValidationOptions,
} from 'class-validator';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A listing photo must be an image in GHOR's own Cloudinary account, inside the ghor/
// folder that signed uploads write to (pre-commit review 2026-09-28). Accepting any
// res.cloudinary.com URL let an owner attach an image hosted on *their own* Cloudinary
// account, get the listing approved, then swap the file behind the same URL — bypassing
// moderation. Read at validation time so it follows the running server's config; without
// Cloudinary credentials (a dev setup where uploads can't happen anyway) it falls back to
// "any Cloudinary image URL".
export function isOwnCloudinaryImage(url: string): boolean {
  const cloud = (process.env.CLOUDINARY_CLOUD_NAME ?? '').trim();
  const configured = !!cloud && !/^your[-_]|placeholder|changeme/i.test(cloud);
  const re = configured
    ? new RegExp(
        `^https://res\\.cloudinary\\.com/${escapeRe(cloud)}/image/upload/(v\\d+/)?ghor/[\\w./-]+$`,
      )
    : /^https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\//;
  return re.test(url);
}

function IsOwnCloudinaryImage(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isOwnCloudinaryImage',
      validator: {
        validate: (v) => typeof v === 'string' && isOwnCloudinaryImage(v),
      },
    },
    options,
  );
}

// Photos are uploaded client-side to Cloudinary (root CLAUDE.md §14.7) — this DTO only
// ever receives the resulting URLs, never a file.
class ListingImageInput {
  // Only our own image host (security review 2026-09-26): an arbitrary URL here let a
  // listing point its photos at any external server — a tracking pixel on every
  // viewer, or content that never passed through our upload path.
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @IsOwnCloudinaryImage({
    message: 'cloudinaryUrl must be a photo uploaded through GHOR',
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

  // Also accepted on update (replace-all, see UpdateListingDto). Publishing
  // (draft -> pending) enforces a 3-photo minimum, root CLAUDE.md §2/§6.
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
