import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  brandingUpdateSchema,
  featureFlagUpdateSchema,
  navigationConfigSchema,
  PORTALS,
  settingsUpdateSchema,
  type BrandingUpdate,
  type FeatureFlagUpdate,
  type SettingsUpdate,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, Public, RequirePermission } from '../../core/auth/decorators.js';
import { BrandingService } from './branding.service.js';
import { FlagsService } from './flags.service.js';
import { NavigationService } from './navigation.service.js';
import { SettingsService } from './settings.service.js';

@ApiTags('settings')
@Controller('settings')
@ModuleScope('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @RequirePermission('settings:read')
  @Get()
  getAll() {
    return this.settings.getAll();
  }

  @RequirePermission('settings:manage')
  @Patch()
  update(
    @Body({ schema: settingsUpdateSchema }) body: SettingsUpdate,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settings.update(body, user.id);
  }
}

@ApiTags('settings')
@Controller('branding')
@ModuleScope('settings')
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  /** Public: the web app needs branding before anyone signs in. Cached with an ETag per version. */
  @Public()
  @Get('public')
  @Header('Cache-Control', 'public, max-age=60')
  async getPublic(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const branding = await this.branding.getPublic();
    const etag = `"branding-v${branding.version}"`;
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      res.status(304);
      return undefined;
    }
    return branding;
  }

  @RequirePermission('branding:manage')
  @Get()
  async get() {
    const { seeds, tokens, version } = await this.branding.current();
    return { seeds, tokens, version };
  }

  @RequirePermission('branding:manage')
  @Patch()
  update(
    @Body({ schema: brandingUpdateSchema }) body: BrandingUpdate,
    @CurrentUser() user: AuthUser,
  ) {
    return this.branding.update(body, user.id);
  }

  @RequirePermission('branding:manage')
  @Post('preview')
  @HttpCode(200)
  async preview(@Body({ schema: brandingUpdateSchema }) body: BrandingUpdate) {
    const { seeds } = await this.branding.current();
    return this.branding.preview(body, seeds);
  }
}

@ApiTags('settings')
@Controller('flags')
@ModuleScope('settings')
export class FlagsController {
  constructor(private readonly flags: FlagsService) {}

  @RequirePermission('flags:manage')
  @Get()
  list() {
    return this.flags.list();
  }

  @RequirePermission('flags:manage')
  @Patch(':key')
  update(
    @Param('key', { schema: z.string().min(3).max(80) }) key: string,
    @Body({ schema: featureFlagUpdateSchema }) body: FeatureFlagUpdate,
    @CurrentUser() user: AuthUser,
  ) {
    return this.flags.update(key, body, user.id);
  }
}

@ApiTags('settings')
@Controller('navigation')
@ModuleScope('settings')
export class NavigationController {
  constructor(private readonly navigation: NavigationService) {}

  @RequirePermission('settings:manage')
  @Get(':portal')
  get(@Param('portal', { schema: z.enum(PORTALS) }) portal: (typeof PORTALS)[number]) {
    return this.navigation.getConfig(portal);
  }

  @RequirePermission('settings:manage')
  @Patch(':portal')
  async update(
    @Param('portal', { schema: z.enum(PORTALS) }) portal: (typeof PORTALS)[number],
    @Body({ schema: navigationConfigSchema.shape.items })
    items: z.infer<typeof navigationConfigSchema.shape.items>,
    @CurrentUser() user: AuthUser,
  ) {
    await this.navigation.updateConfig({ portal, items }, user.id);
    return this.navigation.getConfig(portal);
  }
}
