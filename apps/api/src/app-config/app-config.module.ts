import { Module } from '@nestjs/common';
import { AppConfigController } from './app-config.controller';

// AppSettingsService itself is provided globally by CoreModule.
@Module({ controllers: [AppConfigController] })
export class AppConfigModule {}
