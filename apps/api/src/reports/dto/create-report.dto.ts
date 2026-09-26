import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const REASON_CATEGORIES = ['spam', 'fake', 'inappropriate', 'other'] as const;

export class CreateReportDto {
  @IsUUID()
  listingId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;

  @IsIn(REASON_CATEGORIES)
  reasonCategory!: (typeof REASON_CATEGORIES)[number];
}
