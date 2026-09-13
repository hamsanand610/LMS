import { Module } from '@nestjs/common';
import { AdminHealthController, HealthController } from './health.controller.js';

@Module({
  controllers: [HealthController, AdminHealthController],
})
export class HealthModule {}
