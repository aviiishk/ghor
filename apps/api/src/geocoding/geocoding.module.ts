import { Module } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';

// One shared instance app-wide — the rate-limit queue and cache only work if every
// caller goes through the same GeocodingService.
@Module({
  providers: [GeocodingService],
  exports: [GeocodingService],
})
export class GeocodingModule {}
