import { Module } from '@nestjs/common';
import { BrandingService } from './branding.service.js';
import { CustomFieldsController } from './custom-fields.controller.js';
import { CustomFieldsService } from './custom-fields.service.js';
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
  controllers: [
    SettingsController,
    BrandingController,
    FlagsController,
    NavigationController,
    CustomFieldsController,
  ],
  providers: [
    SettingsService,
    BrandingService,
    FlagsService,
    NavigationService,
    CustomFieldsService,
  ],
  exports: [SettingsService, BrandingService, FlagsService, NavigationService, CustomFieldsService],
})
export class SettingsModule {}
