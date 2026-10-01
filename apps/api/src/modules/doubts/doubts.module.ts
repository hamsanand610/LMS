import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/index.js';
import { DoubtsController, MeDoubtsController } from './doubts.controller.js';
import { DoubtsService } from './doubts.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [MeDoubtsController, DoubtsController],
  providers: [DoubtsService],
  exports: [DoubtsService],
})
export class DoubtsModule {}
