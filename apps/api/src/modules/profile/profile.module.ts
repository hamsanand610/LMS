import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/index.js';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';
import { ResumesService } from './resumes.service.js';

@Module({
  imports: [StudentsModule],
  controllers: [ProfileController],
  providers: [ProfileService, ResumesService],
  exports: [ProfileService],
})
export class ProfileModule {}
