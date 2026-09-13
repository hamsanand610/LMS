import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../core/config/env.js';
import { EmailService } from '../../core/email/email.service.js';
import { invitationEmail } from '../../core/email/templates.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { BrandingService } from '../settings/branding.service.js';
import { generateOpaqueToken, hashToken } from './password.js';

export const INVITATION_TTL_HOURS = 72;

/** Creates and emails single-use invitation links. Used by user creation and "resend". */
@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly branding: BrandingService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async issue(
    userId: string,
    createdById: string | null,
  ): Promise<{ url: string; expiresAt: Date }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    // Only one live invitation per user: expire earlier ones.
    await this.prisma.invitation.updateMany({
      where: { userId, acceptedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });
    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);
    await this.prisma.invitation.create({
      data: { userId, tokenHash: hashToken(token), expiresAt, createdById },
    });
    const url = `${this.config.WEB_BASE_URL}/invite/${token}`;
    const brand = await this.branding.emailBrand();
    const message = invitationEmail(brand, {
      name: user.name,
      url,
      expiresInHours: INVITATION_TTL_HOURS,
      roleNames: user.roles.map((r) => r.role.name),
    });
    await this.email.queue({ to: user.email, ...message });
    return { url, expiresAt };
  }
}
