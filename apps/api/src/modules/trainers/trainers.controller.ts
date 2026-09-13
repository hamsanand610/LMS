import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { trainerCreateSchema, trainerListQuerySchema, trainerUpdateSchema } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { TrainersService } from './trainers.service.js';

const idSchema = z.uuid();

@ApiTags('trainers')
@Controller('trainers')
@ModuleScope('trainers')
export class TrainersController {
  constructor(private readonly trainers: TrainersService) {}

  @RequirePermission('trainers:read')
  @Get()
  list(
    @Query({ schema: trainerListQuerySchema }) query: z.infer<typeof trainerListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.trainers.list(query, user);
  }

  @RequirePermission('trainers:manage')
  @Post()
  create(
    @Body({ schema: trainerCreateSchema }) body: z.infer<typeof trainerCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.trainers.create(body, user);
  }

  /** Distinct subjects, for filters and the batch assignment dialog. */
  @RequirePermission('trainers:read')
  @Get('subjects')
  subjects() {
    return this.trainers.subjects();
  }

  @RequirePermission('trainers:read')
  @Get(':id')
  get(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.trainers.get(id, user);
  }

  @RequirePermission('trainers:manage')
  @Patch(':id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: trainerUpdateSchema }) body: z.infer<typeof trainerUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.trainers.update(id, body, user);
  }
}
