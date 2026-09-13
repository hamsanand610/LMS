import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { TAXONOMY_KEYS, type TaxonomyKey, termCreateSchema, termUpdateSchema } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import {
  AuthenticatedOnly,
  CurrentUser,
  ModuleScope,
  RequirePermission,
} from '../../core/auth/decorators.js';
import { TaxonomiesService } from './taxonomies.service.js';

const taxonomyParam = z.enum(TAXONOMY_KEYS);
const idSchema = z.uuid();

@ApiTags('settings')
@Controller('taxonomies')
@ModuleScope('settings')
export class TaxonomiesController {
  constructor(private readonly taxonomies: TaxonomiesService) {}

  /** Any signed-in user may read the vocabularies: forms and filters everywhere need the labels. */
  @AuthenticatedOnly()
  @Get(':taxonomy/terms')
  list(@Param('taxonomy', { schema: taxonomyParam }) taxonomy: TaxonomyKey) {
    return this.taxonomies.list(taxonomy);
  }

  @RequirePermission('settings:manage')
  @Post(':taxonomy/terms')
  create(
    @Param('taxonomy', { schema: taxonomyParam }) taxonomy: TaxonomyKey,
    @Body({ schema: termCreateSchema }) body: z.infer<typeof termCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.taxonomies.create(taxonomy, body, user.id);
  }

  @RequirePermission('settings:manage')
  @Patch(':taxonomy/terms/:id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: termUpdateSchema }) body: z.infer<typeof termUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.taxonomies.update(id, body, user.id);
  }

  @RequirePermission('settings:manage')
  @Delete(':taxonomy/terms/:id')
  @HttpCode(204)
  async remove(
    @Param('id', { schema: idSchema }) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.taxonomies.remove(id, user.id);
  }
}
