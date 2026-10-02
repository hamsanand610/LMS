import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  batchCreateSchema,
  batchListQuerySchema,
  batchMemberRemoveSchema,
  batchMembersAddSchema,
  batchStatusSchema,
  batchTrainersSchema,
  batchTransferSchema,
  batchUpdateSchema,
  paginationQuerySchema,
  programCreateSchema,
  programUpdateSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { BatchesService } from './batches.service.js';
import { ProgramsService } from './programs.service.js';

const idSchema = z.uuid();
const memberQuerySchema = paginationQuerySchema.extend({
  includeInactive: z.stringbool().optional(),
});

@ApiTags('batches')
@Controller('programs')
@ModuleScope('batches')
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @RequirePermission('batches:read')
  @Get()
  list(@Query({ schema: paginationQuerySchema }) query: z.infer<typeof paginationQuerySchema>) {
    return this.programs.list(query);
  }

  @RequirePermission('programs:manage')
  @Post()
  create(
    @Body({ schema: programCreateSchema }) body: z.infer<typeof programCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.programs.create(body, user);
  }

  @RequirePermission('programs:manage')
  @Patch(':id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: programUpdateSchema }) body: z.infer<typeof programUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.programs.update(id, body, user);
  }
}

@ApiTags('batches')
@Controller('batches')
@ModuleScope('batches')
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

  @RequirePermission('batches:read')
  @Get()
  list(
    @Query({ schema: batchListQuerySchema }) query: z.infer<typeof batchListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batches.list(query, user);
  }

  @RequirePermission('batches:manage')
  @Post()
  create(
    @Body({ schema: batchCreateSchema }) body: z.infer<typeof batchCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batches.create(body, user);
  }

  @RequirePermission('batches:read')
  @Get(':id')
  get(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.batches.get(id, user);
  }

  @RequirePermission('batches:manage')
  @Patch(':id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: batchUpdateSchema }) body: z.infer<typeof batchUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batches.update(id, body, user);
  }

  @RequirePermission('batches:manage')
  @Post(':id/status')
  setStatus(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: batchStatusSchema }) body: z.infer<typeof batchStatusSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batches.setStatus(id, body.status, body.reason, user);
  }

  @RequirePermission('batches:read')
  @Get(':id/members')
  members(
    @Param('id', { schema: idSchema }) id: string,
    @Query({ schema: memberQuerySchema }) query: z.infer<typeof memberQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batches.members(id, query, user);
  }

  @RequirePermission('batches:manage')
  @Post(':id/members')
  addMembers(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: batchMembersAddSchema }) body: z.infer<typeof batchMembersAddSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batches.addMembers(id, body.studentIds, user);
  }

  /** Students who could be added, for the roster dialog. */
  @RequirePermission('batches:manage')
  @Get(':id/members/candidates')
  candidates(
    @Param('id', { schema: idSchema }) id: string,
    @Query({ schema: z.object({ q: z.string().max(100).optional() }) }) query: { q?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.batches.candidates(id, query.q, user);
  }

  @RequirePermission('batches:manage')
  @Post(':id/members/transfer')
  @HttpCode(204)
  async transfer(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: batchTransferSchema }) body: z.infer<typeof batchTransferSchema>,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.batches.transferMember(id, body, user);
  }

  @RequirePermission('batches:manage')
  @Delete(':id/members/:studentId')
  @HttpCode(204)
  async removeMember(
    @Param('id', { schema: idSchema }) id: string,
    @Param('studentId', { schema: idSchema }) studentId: string,
    @Query({ schema: batchMemberRemoveSchema }) query: z.infer<typeof batchMemberRemoveSchema>,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.batches.removeMember(id, studentId, query.reason, user);
  }

  @RequirePermission('batches:manage')
  @Put(':id/trainers')
  setTrainers(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: batchTrainersSchema }) body: z.infer<typeof batchTrainersSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batches.setTrainers(id, body.assignments, user);
  }
}
