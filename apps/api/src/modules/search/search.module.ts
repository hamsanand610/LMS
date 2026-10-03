import { Module } from '@nestjs/common';
import { AssignmentsModule } from '../assignments/index.js';
import { CoursesModule } from '../courses/index.js';
import { PracticeModule } from '../practice/index.js';
import { QuestionsModule } from '../questions/index.js';
import { TestsModule } from '../tests/index.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [CoursesModule, AssignmentsModule, TestsModule, PracticeModule, QuestionsModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
