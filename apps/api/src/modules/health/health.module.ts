import { Module } from '@nestjs/common';
import { ExecutionModule } from '../execution/index.js';
import { SettingsModule } from '../settings/settings.module.js';
import { AdminHealthController, HealthController } from './health.controller.js';
import { RetentionService } from './retention.service.js';

@Module({
  imports: [ExecutionModule, SettingsModule],
  controllers: [HealthController, AdminHealthController],
  providers: [RetentionService],
})
export class HealthModule {}
