import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { DocumentsService } from './documents.service.js';
import { StudentImportService } from './import.service.js';
import { StudentsController } from './students.controller.js';
import { StudentsService } from './students.service.js';

@Module({
  imports: [AuthModule, SettingsModule],
  controllers: [StudentsController],
  providers: [StudentsService, DocumentsService, StudentImportService],
  exports: [StudentsService, DocumentsService],
})
export class StudentsModule {}
