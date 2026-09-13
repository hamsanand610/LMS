import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { ReportsController } from './reports.controller.js';

@Module({
  controllers: [ReportsController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class ReportsModule {}
