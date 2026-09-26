import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Self-service profile edit — fullName only. Phone changes need OTP re-verification (a
// different flow, not built), and role/banned/trust fields are admin- or system-set per
// root CLAUDE.md §6, so none of them are reachable from this DTO at all.
export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  fullName!: string;
}
