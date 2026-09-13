import { Module } from '@nestjs/common';
import { BrandingService } from './branding.service.js';
import { FlagsService } from './flags.service.js';
import { NavigationService } from './navigation.service.js';
import {
  BrandingController,
  FlagsController,
  NavigationController,
  SettingsController,
} from './settings.controller.js';
import { SettingsService } from './settings.service.js';

@Module({
  controllers: [SettingsController, BrandingController, FlagsController, NavigationController],
  providers: [SettingsService, BrandingService, FlagsService, NavigationService],
  exports: [SettingsService, BrandingService, FlagsService, NavigationService],
})
export class SettingsModule {}
