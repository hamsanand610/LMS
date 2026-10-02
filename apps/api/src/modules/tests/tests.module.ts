import { Module } from '@nestjs/common';
import { ExecutionModule } from '../execution/index.js';
import { NotificationsModule } from '../notifications/index.js';
import { QuestionsModule } from '../questions/index.js';
import { AttemptsService } from './attempts.service.js';
import { AttemptsController, MyTestsController, TestsController } from './tests.controller.js';
import { TestsService } from './tests.service.js';
import { WindowRemindersService } from './window-reminders.service.js';

@Module({
  imports: [QuestionsModule, ExecutionModule, NotificationsModule],
  controllers: [TestsController, AttemptsController, MyTestsController],
  providers: [TestsService, AttemptsService, WindowRemindersService],
  exports: [TestsService, AttemptsService],
})
export class TestsModule {}
