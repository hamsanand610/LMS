import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/index.js';
import { NotificationsModule } from '../notifications/index.js';
import { CompaniesService } from './companies.service.js';
import { DrivesService } from './drives.service.js';
import {
  CompaniesController,
  DrivesController,
  MePlacementController,
} from './placement.controller.js';

@Module({
  imports: [AttendanceModule, NotificationsModule],
  controllers: [CompaniesController, DrivesController, MePlacementController],
  providers: [CompaniesService, DrivesService],
  exports: [CompaniesService, DrivesService],
})
export class PlacementModule {}
