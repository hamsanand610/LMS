import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TrainersController } from './trainers.controller.js';
import { TrainersService } from './trainers.service.js';

@Module({
  imports: [AuthModule],
  controllers: [TrainersController],
  providers: [TrainersService],
  exports: [TrainersService],
})
export class TrainersModule {}
