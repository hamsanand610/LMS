import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { certificateCodeSchema } from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, Public, RequirePermission } from '../../core/auth/decorators.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';
import { CertificatesService } from './certificates.service.js';

const idSchema = z.uuid();

/** A learner's own certificates (ADR-0022). */
@ApiTags('certificates')
@Controller('me/certificates')
@ModuleScope('certificates')
export class MeCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @RequirePermission('certificates:read')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.certificates.mine(user);
  }

  @RequirePermission('certificates:read')
  @RateLimit({ points: 30, durationSec: 300, keyBy: 'user' })
  @Get(':id/download')
  download(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.certificates.download(id, user);
  }
}

/**
 * The public check behind the code printed on a certificate (AC-10.2). Rate-limited by address,
 * so codes cannot be walked through; it shows only what confirms the certificate.
 */
@ApiTags('certificates')
@Controller('public/certificates')
@ModuleScope('certificates')
export class PublicCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Public()
  @RateLimit({ points: 30, durationSec: 300, keyBy: 'ip' })
  @Get(':code')
  verify(@Param('code', { schema: certificateCodeSchema }) code: string) {
    return this.certificates.verify(code);
  }
}
