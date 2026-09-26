import { IsString, Matches } from 'class-validator';

export class SendOtpDto {
  // E.164-ish: leading +, country code, 7-14 more digits. apps/mobile's sign-in screen
  // already normalizes to this (`+91${cleaned}`) before calling this endpoint.
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phone must be in +<countrycode><number> format',
  })
  phone!: string;
}
