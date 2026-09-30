import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AdminListReviewsDto {
  // Omitted = all reviews; "true"/"false" filters. Query params arrive as strings.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  hidden?: boolean;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// Legacy web admin: reason optional (its UI has no reason field).
export class SetReviewHiddenDto {
  @IsBoolean()
  hidden!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// Admin console: every hide/unhide carries a reason.
export class AdminSetReviewHiddenDto {
  @IsBoolean()
  hidden!: boolean;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
