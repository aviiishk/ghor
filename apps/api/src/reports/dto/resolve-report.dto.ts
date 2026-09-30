import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveReportDto {
  // Dismiss (keep the listing as it is) or Confirm (a live or pending listing is held for
  // human re-review; rejected/rented/paused listings are never moved back to pending).
  @IsIn(['dismiss', 'confirm'])
  action!: 'dismiss' | 'confirm';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
