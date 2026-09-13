import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  CUSTOM_FIELD_ENTITIES,
  type CustomFieldEntity,
  customFieldCreateSchema,
  customFieldUpdateSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { CustomFieldsService } from './custom-fields.service.js';

const listQuerySchema = z.object({ entityType: z.enum(CUSTOM_FIELD_ENTITIES) });

@ApiTags('settings')
@Controller('custom-fields')
@ModuleScope('settings')
export class CustomFieldsController {
  constructor(private readonly fields: CustomFieldsService) {}

  @RequirePermission('settings:read')
  @Get()
  list(@Query({ schema: listQuerySchema }) query: { entityType: CustomFieldEntity }) {
    return this.fields.list(query.entityType);
  }

  @RequirePermission('settings:manage')
  @Post()
  create(
    @Body({ schema: customFieldCreateSchema }) body: z.infer<typeof customFieldCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.fields.create(body, user.id);
  }

  @RequirePermission('settings:manage')
  @Patch(':id')
  update(
    @Param('id', { schema: z.uuid() }) id: string,
    @Body({ schema: customFieldUpdateSchema }) body: z.infer<typeof customFieldUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.fields.update(id, body, user.id);
  }

  @RequirePermission('settings:manage')
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id', { schema: z.uuid() }) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.fields.remove(id, user.id);
  }
}
