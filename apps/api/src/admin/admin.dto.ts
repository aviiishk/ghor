import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsDefined,
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
} from 'class-validator';

class ReasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class RequiredReasonDto extends ReasonDto {}

export class CreateAdminUserDto extends ReasonDto {
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phone must be in +<countrycode><number> format',
  })
  phone!: string;

  @IsIn(['admin', 'senior_reviewer', 'super_admin'])
  role!: 'admin' | 'senior_reviewer' | 'super_admin';
}

export class ChangeAdminRoleDto extends ReasonDto {
  @IsIn(['admin', 'senior_reviewer', 'super_admin'])
  role!: 'admin' | 'senior_reviewer' | 'super_admin';
}

export class SeniorCapabilityDto extends ReasonDto {
  @IsBoolean()
  enabled!: boolean;
}

export class AdminStatusDto extends ReasonDto {
  @IsIn(['active', 'disabled'])
  status!: 'active' | 'disabled';
}

const toBool = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class PageQueryDto {
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

export class UsersQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsIn(['seeker', 'owner', 'admin'])
  role?: 'seeker' | 'owner' | 'admin';

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  banned?: boolean;
}

export class ReportsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(['pending', 'reviewed', 'dismissed'])
  status?: 'pending' | 'reviewed' | 'dismissed';

  @IsOptional()
  @IsIn(['spam', 'fake', 'inappropriate', 'other'])
  category?: string;
}

export class AdminResolveReportDto {
  @IsIn(['dismiss', 'confirm'])
  action!: 'dismiss' | 'confirm';

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  note!: string;
}

export class SetConfigValueDto extends ReasonDto {
  // Per-key validation happens against the config registry in AppSettingsService.
  @IsDefined()
  value!: unknown;

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class AuditQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  targetType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetId?: string;

  @IsOptional()
  @IsIn(['admin_action', 'security', 'data_access', 'system', 'user_action'])
  category?:
    'admin_action' | 'security' | 'data_access' | 'system' | 'user_action';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class AuditExportDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsIn(['admin_action', 'security', 'data_access', 'system', 'user_action'])
  category?:
    'admin_action' | 'security' | 'data_access' | 'system' | 'user_action';

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class AckAlertDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RangeQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class TrendsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(90)
  days?: number;
}
