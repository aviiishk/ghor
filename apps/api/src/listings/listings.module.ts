import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { PushModule } from '../push/push.module';
import { GeocodingModule } from '../geocoding/geocoding.module';

@Module({
  imports: [PushModule, GeocodingModule],
  controllers: [ListingsController],
  providers: [ListingsService],
})
export class ListingsModule {}
