import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/index.js';
import { FeedbackFormsController, MyFeedbackController } from './feedback.controller.js';
import { FeedbackService } from './feedback.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [FeedbackFormsController, MyFeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
