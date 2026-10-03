import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  certificateCodeSchema,
  certificateListQuerySchema,
  certificateReasonSchema,
} from '@lms/shared';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { CurrentUser, ModuleScope, Public, RequirePermission } from '../../core/auth/decorators.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';
import { CertificatesService } from './certificates.service.js';
import { ReadsNotices } from '../notifications/index.js';

const idSchema = z.uuid();

/** A learner's own certificates (ADR-0022). */
@ApiTags('certificates')
@Controller('me/certificates')
@ModuleScope('certificates')
export class MeCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @RequirePermission('certificates:read')
  @ReadsNotices('/certificates')
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

/** Certificates for staff (D9): read by scope; revoked, reinstated and redrawn by administrators. */
@ApiTags('certificates')
@Controller('certificates')
@ModuleScope('certificates')
export class StaffCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @RequirePermission('certificates:read', { minScope: 'batch' })
  @Get()
  list(
    @Query({ schema: certificateListQuerySchema })
    query: z.infer<typeof certificateListQuerySchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.certificates.list(query, user);
  }

  @RequirePermission('certificates:manage')
  @Post(':id/revoke')
  @HttpCode(200)
  revoke(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: certificateReasonSchema }) body: z.infer<typeof certificateReasonSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.certificates.revoke(id, body.reason, user);
  }

  @RequirePermission('certificates:manage')
  @Post(':id/reinstate')
  @HttpCode(200)
  reinstate(
    @Param('id', { schema: idSchema }) id: string,
    @Body({ schema: certificateReasonSchema }) body: z.infer<typeof certificateReasonSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.certificates.reinstate(id, body.reason, user);
  }

  @RequirePermission('certificates:manage')
  @Post(':id/redraw')
  @HttpCode(200)
  redraw(@Param('id', { schema: idSchema }) id: string, @CurrentUser() user: AuthUser) {
    return this.certificates.redraw(id, user);
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
