import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { REASON_CODE_PATTERN } from './listing-state';

export const MAX_BULK_ITEMS = 50;

class ReasonCodesMixin {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(REASON_CODE_PATTERN, {
    each: true,
    message: 'reason codes are lowercase words joined by _',
  })
  reasonCodes?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  ownerMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNote?: string;
}

export class DecisionDto extends ReasonCodesMixin {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsIn(['approve', 'reject', 'request_changes'])
  decision!: 'approve' | 'reject' | 'request_changes';
}

export class VersionedReasonDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class PostReviewDto extends ReasonCodesMixin {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsIn(['confirm', 'reject', 'escalate'])
  outcome!: 'confirm' | 'reject' | 'escalate';
}

export class NoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class BulkItemDto {
  @IsUUID()
  id!: string;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class BulkDecisionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => BulkItemDto)
  items!: BulkItemDto[];

  @IsIn(['approve', 'reject', 'request_changes'])
  decision!: 'approve' | 'reject' | 'request_changes';

  // Bulk moderation always carries a reason (audit §5 hardening).
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @Matches(REASON_CODE_PATTERN, {
    each: true,
    message: 'reason codes are lowercase words joined by _',
  })
  reasonCodes!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  ownerMessage?: string;
}

export class QueueQueryDto {
  @IsOptional()
  @IsIn(['pending', 'held', 'post_review', 'paused'])
  track?: 'pending' | 'held' | 'post_review' | 'paused';

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
