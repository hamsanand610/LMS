import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  EMAIL_TEMPLATE_KEYS,
  INTEGRATION_PROVIDERS,
  contentPageSchema,
  contentPageUpdateSchema,
  emailTemplateTestSchema,
  emailTemplateUpdateSchema,
  integrationUpdateSchema,
  slugSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, Public, RequirePermission } from '../../core/auth/decorators.js';
import { ContentPagesService } from './content-pages.service.js';
import { EmailTemplatesService } from './email-templates.service.js';
import { IntegrationsService } from './integrations.service.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';

const idSchema = z.uuid();
const templateKeySchema = z.enum(EMAIL_TEMPLATE_KEYS);
const providerSchema = z.enum(INTEGRATION_PROVIDERS);

@ApiTags('settings')
@Controller('content-pages')
@ModuleScope('settings')
export class ContentPagesController {
  constructor(private readonly pages: ContentPagesService) {}

  @RequirePermission('settings:manage')
  @Get()
  list() {
    return this.pages.list();
  }

  @RequirePermission('settings:manage')
  @Post()
  create(
    @Body({ schema: contentPageSchema }) body: z.infer<typeof contentPageSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pages.create(body, user.id);
  }

  @RequirePermission('settings:manage')
  @Patch(':id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: contentPageUpdateSchema }) body: z.infer<typeof contentPageUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pages.update(id, body, user.id);
  }

  @RequirePermission('settings:manage')
  @Delete(':id')
  async remove(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    await this.pages.remove(id, user.id);
    return { removed: true };
  }
}

/** The public half: a visitor reads a published page without signing in. */
@ApiTags('settings')
@Controller('pages')
@ModuleScope('settings')
export class PublicContentController {
  constructor(private readonly pages: ContentPagesService) {}

  @Public()
  @Get(':slug')
  get(@Param('slug', { schema: slugSchema }) slug: string) {
    return this.pages.publicPage(slug);
  }
}

@ApiTags('settings')
@Controller('templates')
@ModuleScope('settings')
export class EmailTemplatesController {
  constructor(private readonly templates: EmailTemplatesService) {}

  @RequirePermission('settings:manage')
  @Get()
  list() {
    return this.templates.list();
  }

  @RequirePermission('settings:manage')
  @Patch(':key')
  update(
    @Param('key', { schema: templateKeySchema }) key: z.infer<typeof templateKeySchema>,
    @Body({ schema: emailTemplateUpdateSchema }) body: z.infer<typeof emailTemplateUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.templates.update(key, body, user.id);
  }

  /** Puts one template back to the platform's own wording. */
  @RequirePermission('settings:manage')
  @Delete(':key')
  reset(
    @Param('key', { schema: templateKeySchema }) key: z.infer<typeof templateKeySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.templates.reset(key, user.id);
  }

  /** Sends an e-mail to an address of the caller's choosing: a few an hour (Phase 6). */
  @RequirePermission('settings:manage')
  @RateLimit({ points: 10, durationSec: 3600, keyBy: 'user' })
  @Post(':key/test')
  test(
    @Param('key', { schema: templateKeySchema }) key: z.infer<typeof templateKeySchema>,
    @Body({ schema: emailTemplateTestSchema }) body: z.infer<typeof emailTemplateTestSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.templates.test(key, body.to, user.name);
  }
}

@ApiTags('settings')
@Controller('integrations')
@ModuleScope('settings')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @RequirePermission('settings:manage')
  @Get()
  list() {
    return this.integrations.list();
  }

  @RequirePermission('settings:manage')
  @Patch(':provider')
  update(
    @Param('provider', { schema: providerSchema }) provider: z.infer<typeof providerSchema>,
    @Body({ schema: integrationUpdateSchema }) body: z.infer<typeof integrationUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.integrations.update(provider, body, user.id);
  }

  @RequirePermission('settings:manage')
  @Post(':provider/test')
  test(@Param('provider', { schema: providerSchema }) provider: z.infer<typeof providerSchema>) {
    return this.integrations.test(provider);
  }
}
