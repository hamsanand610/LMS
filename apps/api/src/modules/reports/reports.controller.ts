import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  REPORT_NAMES,
  dashboardQuerySchema,
  exportCreateSchema,
  paginationQuerySchema,
  reportFilterSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import {
  AuthenticatedOnly,
  CurrentUser,
  ModuleScope,
  RequirePermission,
} from '../../core/auth/decorators.js';
import { DashboardService } from './dashboard.service.js';
import { ExportsService } from './exports.service.js';
import { ReportsService } from './reports.service.js';
import { TrainerDashboardService } from './trainer-dashboard.service.js';

const reportNameSchema = z.enum(REPORT_NAMES);
const idSchema = z.uuid();

@ApiTags('reports')
@Controller('reports')
@ModuleScope('reports')
export class ReportsController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly reports: ReportsService,
  ) {}

  @RequirePermission('reports:read')
  @Get('dashboard')
  get(
    @Query({ schema: dashboardQuerySchema }) query: z.infer<typeof dashboardQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dashboard.build(user, query);
  }

  /** What can be reported on, including the reports whose module is not in this build. */
  @RequirePermission('reports:read')
  @Get()
  catalogue(@CurrentUser() user: AuthUser) {
    return this.reports.catalogue(user);
  }

  /** One page of one report: summary tiles, a chart, the rows and the definitions. */
  @RequirePermission('reports:read')
  @Get(':name')
  page(
    @Param('name', { schema: reportNameSchema }) name: z.infer<typeof reportNameSchema>,
    @Query({ schema: reportFilterSchema }) query: z.infer<typeof reportFilterSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reports.page(name, query, user);
  }
}

@ApiTags('reports')
@Controller('exports')
@ModuleScope('reports')
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  /** Queues an export of exactly the rows the filters select. Returns at once with an id. */
  @RequirePermission('reports:export')
  @Post()
  create(
    @Body({ schema: exportCreateSchema }) body: z.infer<typeof exportCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.exports.create(body, user);
  }

  @RequirePermission('reports:export')
  @Get()
  list(
    @Query({ schema: paginationQuerySchema }) query: z.infer<typeof paginationQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.exports.list(query, user);
  }

  @RequirePermission('reports:export')
  @Get(':id')
  get(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.exports.get(id, user);
  }

  /** A short-lived link to the file itself. */
  @RequirePermission('reports:export')
  @Get(':id/download')
  download(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.exports.download(id, user);
  }
}

@ApiTags('reports')
@Controller('trainer')
@ModuleScope('reports')
export class TrainerDashboardController {
  constructor(private readonly dashboard: TrainerDashboardService) {}

  /** The trainer home page aggregate, always limited to their own batches. */
  @AuthenticatedOnly()
  @Get('dashboard')
  build(@CurrentUser() user: AuthUser) {
    return this.dashboard.build(user);
  }
}
