import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { AuthenticatedOnly, CurrentUser, ModuleScope } from '../../core/auth/decorators.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';
import { FilesService } from './files.service.js';

const createUploadSchema = z.object({
  context: z.string().min(2).max(40),
  filename: z.string().min(1).max(255),
  mime: z.string().min(3).max(120),
  size: z.number().int().positive(),
});

const idSchema = z.uuid();

/**
 * File endpoints are reachable by any signed-in user; the context's own permission decides
 * who may upload what (checked in the service).
 */
@ApiTags('files')
@Controller('files')
@ModuleScope('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @AuthenticatedOnly()
  @RateLimit({ points: 60, durationSec: 600, keyBy: 'user' })
  @Post('uploads')
  createUpload(
    @Body({ schema: createUploadSchema }) body: z.infer<typeof createUploadSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.files.createUpload(user, body);
  }

  @AuthenticatedOnly()
  @Post('uploads/:id/complete')
  @HttpCode(200)
  complete(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.files.completeUpload(user, id);
  }

  @AuthenticatedOnly()
  @Get(':id')
  get(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.files.get(user, id);
  }

  @AuthenticatedOnly()
  @Get(':id/url')
  url(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.files.getUrl(user, id);
  }

  @AuthenticatedOnly()
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id', { schema: idSchema }) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.files.delete(user, id);
  }
}
