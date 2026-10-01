import { Module } from '@nestjs/common';
import { ExecutionModule } from '../execution/index.js';
import { AdminHealthController, HealthController } from './health.controller.js';

@Module({
  imports: [ExecutionModule],
  controllers: [HealthController, AdminHealthController],
})
export class HealthModule {}
