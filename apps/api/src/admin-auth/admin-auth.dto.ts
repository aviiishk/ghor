import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class AdminSendOtpDto {
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phone must be in +<countrycode><number> format',
  })
  phone!: string;
}

export class AdminVerifyOtpDto extends AdminSendOtpDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
  code!: string;
}

export class TotpCodeDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
  code!: string;
}

export class RecoveryCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  recoveryCode!: string;
}

export class AdminRefreshDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  refreshToken!: string;
}

export class BreakGlassDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  breakGlassToken!: string;
}
