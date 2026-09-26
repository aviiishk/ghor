import { IsDefined } from 'class-validator';

export class SetConfigDto {
  // app_config.value is jsonb — genuinely heterogeneous across keys (a number for
  // report_threshold, a boolean for a feature flag, etc.), so this deliberately isn't
  // typed narrower than "present." @IsDefined() (not a type-specific validator) is what
  // keeps this property from being stripped by the global ValidationPipe's
  // `whitelist: true` while still accepting any JSON-serializable value.
  @IsDefined()
  value!: unknown;
}
