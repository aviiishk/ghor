import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class BrowseListingsDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsIn(['room', 'flat'])
  propertyType?: 'room' | 'flat';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rentMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rentMax?: number;

  // Comma-separated amenity keys, all required present-and-true (AND semantics) —
  // e.g. ?amenities=wifi,parking
  @IsOptional()
  @IsString()
  amenities?: string;

  // Comma-separated institutions.id values (OR semantics — "near any of these").
  @IsOptional()
  @IsString()
  institutionIds?: string;

  @IsOptional()
  @IsIn(['newest', 'price_asc', 'price_desc'])
  sort?: 'newest' | 'price_asc' | 'price_desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  // Opaque: the previous page's last listing id. Root CLAUDE.md §14.3/§14.4 — cursor
  // pagination from day one, never OFFSET.
  @IsOptional()
  @IsString()
  cursor?: string;
}
