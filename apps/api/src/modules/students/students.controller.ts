import { Body, Controller, Get, Header, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  documentCreateSchema,
  documentDecisionSchema,
  studentCreateSchema,
  studentImportSchema,
  studentListQuerySchema,
  studentNoteSchema,
  studentStatusSchema,
  studentUpdateSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';
import { DocumentsService } from './documents.service.js';
import { StudentImportService } from './import.service.js';
import { StudentsService } from './students.service.js';

const idSchema = z.uuid();

@ApiTags('students')
@Controller('students')
@ModuleScope('students')
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly documents: DocumentsService,
    private readonly imports: StudentImportService,
  ) {}

  @RequirePermission('students:read')
  @Get()
  list(
    @Query({ schema: studentListQuerySchema }) query: z.infer<typeof studentListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.list(query, user);
  }

  @RequirePermission('students:manage')
  @Post()
  create(
    @Body({ schema: studentCreateSchema }) body: z.infer<typeof studentCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.create(body, user);
  }

  /** The sheet a client starts from; kept next to the importer so the columns cannot drift. */
  @RequirePermission('users:import')
  @Get('import/template')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="student-import-template.csv"')
  template(): string {
    return StudentImportService.template();
  }

  @RequirePermission('users:import')
  @Get('import')
  recentImports() {
    return this.imports.recent();
  }

  @RequirePermission('users:import')
  @RateLimit({ points: 10, durationSec: 600, keyBy: 'user' })
  @Post('import')
  startImport(
    @Body({ schema: studentImportSchema }) body: z.infer<typeof studentImportSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.imports.start(body, user);
  }

  @RequirePermission('users:import')
  @Get('import/:jobId')
  importStatus(@Param('jobId', { schema: idSchema }) jobId: string) {
    return this.imports.status(jobId);
  }

  @RequirePermission('students:read')
  @Get(':id')
  get(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.students.get(id, user);
  }

  @RequirePermission('students:manage')
  @Patch(':id')
  update(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: studentUpdateSchema }) body: z.infer<typeof studentUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.update(id, body, user);
  }

  @RequirePermission('students:manage')
  @Post(':id/status')
  setStatus(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: studentStatusSchema }) body: z.infer<typeof studentStatusSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.setStatus(id, body.status, body.reason, user);
  }

  @RequirePermission('students:read')
  @Get(':id/batches')
  batches(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.students.listBatches(id, user);
  }

  @RequirePermission('students:read')
  @Get(':id/notes')
  notes(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.students.listNotes(id, user);
  }

  @RequirePermission('students:read')
  @Post(':id/notes')
  addNote(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: studentNoteSchema }) body: z.infer<typeof studentNoteSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.addNote(id, body.text, user);
  }

  @RequirePermission('students:read_sensitive')
  @Get(':id/documents')
  documentList(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.documents.list(id, user);
  }

  @RequirePermission('students:manage')
  @Post(':id/documents')
  addDocument(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: documentCreateSchema }) body: z.infer<typeof documentCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.add(id, body, user);
  }

  @RequirePermission('students:read_sensitive')
  @Get(':id/documents/:documentId/url')
  documentUrl(
    @Param('id', { schema: idSchema }) id: string,
    @Param('documentId', { schema: idSchema }) documentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.downloadUrl(id, documentId, user);
  }

  @RequirePermission('students:verify_documents')
  @Post(':id/documents/:documentId/verify')
  decideDocument(
    @Param('id', { schema: idSchema }) id: string,
    @Param('documentId', { schema: idSchema }) documentId: string,
    @Body({ schema: documentDecisionSchema }) body: z.infer<typeof documentDecisionSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.decide(id, documentId, body.decision, body.reason, user);
  }
}
