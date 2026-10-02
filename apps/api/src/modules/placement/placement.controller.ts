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
  applicationStatusSchema,
  companyKitSchema,
  companyListQuerySchema,
  companyUpsertSchema,
  driveListQuerySchema,
  driveStatusSchema,
  driveUpsertSchema,
  kitCandidateQuerySchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { CompaniesService } from './companies.service.js';
import { DrivesService } from './drives.service.js';

const idSchema = z.uuid();
/** A company is addressed by its id (staff screens) or its slug (the learner's kit page). */
const companyRefSchema = z.string().trim().min(1).max(80);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ApiTags('placement')
@Controller('companies')
@ModuleScope('placement')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @RequirePermission('placements:read')
  @Get()
  list(
    @Query({ schema: companyListQuerySchema }) query: z.infer<typeof companyListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.companies.list(user, query);
  }

  /** Published practice problems that can go into a kit (declared before `:ref`, which would match it). */
  @RequirePermission('placements:manage')
  @Get('kit-candidates')
  candidates(
    @Query({ schema: kitCandidateQuerySchema }) query: z.infer<typeof kitCandidateQuerySchema>,
  ) {
    return this.companies.candidates(query.q);
  }

  @RequirePermission('placements:read')
  @Get(':ref')
  get(@Param('ref', { schema: companyRefSchema }) ref: string, @CurrentUser() user: AuthUser) {
    return UUID.test(ref) ? this.companies.getById(ref, user) : this.companies.get(ref, user);
  }

  @RequirePermission('placements:manage')
  @Post()
  create(
    @Body({ schema: companyUpsertSchema }) body: z.infer<typeof companyUpsertSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.companies.create(body, user);
  }

  @RequirePermission('placements:manage')
  @Put(':id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: companyUpsertSchema }) body: z.infer<typeof companyUpsertSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.companies.update(id, body, user);
  }

  @RequirePermission('placements:manage')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', { schema: idSchema }) id: string) {
    await this.companies.remove(id);
  }

  /** Replaces the interview-prep kit with the given ordered list of practice problems. */
  @RequirePermission('placements:manage')
  @Put(':id/kit')
  setKit(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: companyKitSchema }) body: z.infer<typeof companyKitSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.companies.setKit(id, body, user);
  }

  @RequirePermission('placements:read')
  @Put(':id/favourite')
  favourite(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.companies.favourite(id, user, true);
  }

  @RequirePermission('placements:read')
  @Delete(':id/favourite')
  unfavourite(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.companies.favourite(id, user, false);
  }
}

@ApiTags('placement')
@Controller('drives')
@ModuleScope('placement')
export class DrivesController {
  constructor(private readonly drives: DrivesService) {}

  /** Staff see every drive; a learner sees published drives with their own eligibility. */
  @RequirePermission('placements:read')
  @Get()
  list(
    @Query({ schema: driveListQuerySchema }) query: z.infer<typeof driveListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.drives.list(user, query);
  }

  @RequirePermission('placements:read')
  @Get(':id')
  get(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.drives.get(id, user);
  }

  @RequirePermission('placements:manage')
  @Post()
  create(
    @Body({ schema: driveUpsertSchema }) body: z.infer<typeof driveUpsertSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.drives.create(body, user);
  }

  @RequirePermission('placements:manage')
  @Put(':id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: driveUpsertSchema }) body: z.infer<typeof driveUpsertSchema>,
  ) {
    return this.drives.update(id, body);
  }

  /** Opens, closes or returns a drive to draft. The first opening tells eligible learners. */
  @RequirePermission('placements:manage')
  @Post(':id/status')
  @HttpCode(200)
  setStatus(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: driveStatusSchema }) body: z.infer<typeof driveStatusSchema>,
  ) {
    return this.drives.setStatus(id, body.status);
  }

  @RequirePermission('placements:manage')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', { schema: idSchema }) id: string) {
    await this.drives.remove(id);
  }

  @RequirePermission('placements:manage')
  @Get(':id/applications')
  applications(@Param('id', { schema: idSchema }) id: string) {
    return this.drives.applicants(id);
  }

  /** Every applicant of a drive as CSV; audited. */
  @RequirePermission('placements:manage')
  @Post(':id/applications/export')
  @HttpCode(200)
  exportApplications(@Param('id', { schema: idSchema }) id: string) {
    return this.drives.exportApplicants(id);
  }

  /** A short link to the résumé an applicant applied with; audited. */
  @RequirePermission('placements:manage')
  @Get(':id/applications/:applicationId/resume')
  applicantResume(
    @Param('id', { schema: idSchema }) id: string,
    @Param('applicationId', { schema: idSchema }) applicationId: string,
  ) {
    return this.drives.applicantResume(id, applicationId);
  }

  @RequirePermission('placements:manage')
  @Patch(':id/applications/:applicationId')
  setApplicationStatus(
    @Param('id', { schema: idSchema }) id: string,
    @Param('applicationId', { schema: idSchema }) applicationId: string,
    @Body({ schema: applicationStatusSchema }) body: z.infer<typeof applicationStatusSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.drives.setApplicationStatus(id, applicationId, body, user);
  }

  @RequirePermission('placements:apply')
  @Post(':id/apply')
  @HttpCode(200)
  apply(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.drives.apply(id, user);
  }

  @RequirePermission('placements:apply')
  @Post(':id/withdraw')
  @HttpCode(200)
  withdraw(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.drives.withdraw(id, user);
  }
}

@ApiTags('placement')
@Controller('me/placement')
@ModuleScope('placement')
export class MePlacementController {
  constructor(private readonly drives: DrivesService) {}

  /** Open drives the learner may apply to, their applications and the next closing date. */
  @RequirePermission('placements:read')
  @Get()
  summary(@CurrentUser() user: AuthUser) {
    return this.drives.summaryFor(user);
  }
}
