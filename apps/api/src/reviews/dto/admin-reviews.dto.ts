import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class AdminListReviewsDto {
  // Omitted = all reviews; "true"/"false" filters. Query params arrive as strings.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  hidden?: boolean;
}

export class SetReviewHiddenDto {
  @IsBoolean()
  hidden!: boolean;
}
