import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/index.js';
import { SettingsModule } from '../settings/settings.module.js';
import { BatchesController, ProgramsController } from './batches.controller.js';
import { BatchesService } from './batches.service.js';
import { ProgramsService } from './programs.service.js';

@Module({
  imports: [NotificationsModule, SettingsModule],
  controllers: [ProgramsController, BatchesController],
  providers: [ProgramsService, BatchesService],
  exports: [BatchesService, ProgramsService],
})
export class BatchesModule {}
