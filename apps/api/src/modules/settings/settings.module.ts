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
import { TaxonomiesController } from './taxonomies.controller.js';
import { TaxonomiesService } from './taxonomies.service.js';
import { ContentPagesService } from './content-pages.service.js';
import { EmailTemplatesService } from './email-templates.service.js';
import { IntegrationsService } from './integrations.service.js';
import {
  ContentPagesController,
  EmailTemplatesController,
  IntegrationsController,
  PublicContentController,
} from './content.controller.js';

@Module({
  controllers: [
    SettingsController,
    BrandingController,
    FlagsController,
    NavigationController,
    CustomFieldsController,
    TaxonomiesController,
    ContentPagesController,
    PublicContentController,
    EmailTemplatesController,
    IntegrationsController,
  ],
  providers: [
    SettingsService,
    BrandingService,
    FlagsService,
    NavigationService,
    CustomFieldsService,
    TaxonomiesService,
    ContentPagesService,
    EmailTemplatesService,
    IntegrationsService,
  ],
  exports: [
    SettingsService,
    BrandingService,
    FlagsService,
    NavigationService,
    CustomFieldsService,
    TaxonomiesService,
    ContentPagesService,
    EmailTemplatesService,
    IntegrationsService,
  ],
})
export class SettingsModule {}
