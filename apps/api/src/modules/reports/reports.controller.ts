import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { dashboardQuerySchema } from '@lms/shared';
import type { z } from 'zod';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('reports')
@Controller('reports')
@ModuleScope('reports')
export class ReportsController {
  constructor(private readonly dashboard: DashboardService) {}

  @RequirePermission('reports:read')
  @Get('dashboard')
  get(
    @Query({ schema: dashboardQuerySchema }) query: z.infer<typeof dashboardQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dashboard.build(user, query);
  }
}
