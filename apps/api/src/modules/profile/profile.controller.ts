import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  PROFILE_SECTIONS,
  documentCreateSchema,
  profilePhotoSchema,
  profileUpdateSchema,
  resumeCreateSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, RequirePermission } from '../../core/auth/decorators.js';
import { DocumentsService } from '../students/index.js';
import { ProfileService } from './profile.service.js';
import { ResumesService } from './resumes.service.js';

const idSchema = z.uuid();
const sectionSchema = z.enum(PROFILE_SECTIONS);

@ApiTags('profile')
@Controller('me')
@ModuleScope('profile')
export class ProfileController {
  constructor(
    private readonly profile: ProfileService,
    private readonly resumes: ResumesService,
    private readonly documents: DocumentsService,
  ) {}

  @RequirePermission('profile:read')
  @Get('profile')
  get(@CurrentUser() user: AuthUser) {
    return this.profile.get(user);
  }

  /** Saves one section. A body that strays outside it is refused rather than written. */
  @RequirePermission('profile:update')
  @Patch('profile/:section')
  update(
    @Param('section', { schema: sectionSchema }) section: z.infer<typeof sectionSchema>,
    @Body({ schema: profileUpdateSchema }) body: z.infer<typeof profileUpdateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.profile.updateSection(section, body, user);
  }

  /** Sets or clears the photo; the file is uploaded first through the `avatar` context. */
  @RequirePermission('profile:update')
  @Put('profile/photo')
  setPhoto(
    @Body({ schema: profilePhotoSchema }) body: z.infer<typeof profilePhotoSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.profile.setPhoto(body.fileId, user);
  }

  // ───────────────────────── resumes ─────────────────────────

  @RequirePermission('profile:read')
  @Get('resumes')
  listResumes(@CurrentUser() user: AuthUser) {
    return this.resumes.list(user);
  }

  @RequirePermission('profile:update')
  @Post('resumes')
  addResume(
    @Body({ schema: resumeCreateSchema }) body: z.infer<typeof resumeCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.resumes.add(body, user);
  }

  @RequirePermission('profile:update')
  @Post('resumes/:id/default')
  setDefaultResume(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.resumes.setDefault(id, user);
  }

  @RequirePermission('profile:update')
  @Delete('resumes/:id')
  removeResume(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.resumes.remove(id, user);
  }

  @RequirePermission('profile:read')
  @Get('resumes/:id/download')
  downloadResume(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.resumes.downloadUrl(id, user);
  }

  // ───────────────────────── documents ─────────────────────────

  @RequirePermission('profile:read')
  @Get('documents')
  async listDocuments(@CurrentUser() user: AuthUser) {
    const studentId = await this.profile.requireOwnStudentId(user);
    return this.documents.listOwn(studentId);
  }

  @RequirePermission('profile:update')
  @Post('documents')
  async addDocument(
    @Body({ schema: documentCreateSchema }) body: z.infer<typeof documentCreateSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    const studentId = await this.profile.requireOwnStudentId(user);
    return this.documents.addOwn(studentId, body, user);
  }

  /** A short-lived link to one of the learner's own documents; anyone else's is not found. */
  @RequirePermission('profile:read')
  @Get('documents/:id/download')
  async downloadDocument(
    @Param('id', { schema: idSchema }) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const studentId = await this.profile.requireOwnStudentId(user);
    return this.documents.downloadOwn(studentId, id);
  }
}
