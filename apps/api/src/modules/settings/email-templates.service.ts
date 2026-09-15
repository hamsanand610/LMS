import { Injectable } from '@nestjs/common';
import {
  EMAIL_TEMPLATES,
  type EmailTemplateKey,
  type EmailTemplateRecord,
  type EmailTemplateUpdateInput,
  renderTemplate,
  unknownVariables,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { EmailService } from '../../core/email/email.service.js';
import { NotFoundError, ValidationError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { BrandingService } from './branding.service.js';

/**
 * The wording of the platform's emails (plan DP-A33). The layout, the button and the footer stay
 * the platform's; the subject line and what the message says are the institute's, because that is
 * what differs between clients. A template may only use the variables it declares — a save that
 * would render `{{whatever}}` into somebody's inbox is refused.
 */
@Injectable()
export class EmailTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly branding: BrandingService,
  ) {}

  async list(): Promise<EmailTemplateRecord[]> {
    const org = await this.tenant.getOrganization();
    const rows = await this.prisma.emailTemplate.findMany({ where: { organizationId: org.id } });
    const byKey = new Map(rows.map((row) => [row.key, row]));

    return EMAIL_TEMPLATES.map((definition) => {
      const stored = byKey.get(definition.key);
      return {
        ...definition,
        subject: stored?.subject ?? definition.defaultSubject,
        body: stored?.bodyText ?? definition.defaultBody,
        isCustomised: stored !== undefined,
        updatedAt: stored?.updatedAt.toISOString() ?? null,
      };
    });
  }

  async update(
    key: EmailTemplateKey,
    input: EmailTemplateUpdateInput,
    actorId: string,
  ): Promise<EmailTemplateRecord[]> {
    const definition = EMAIL_TEMPLATES.find((template) => template.key === key);
    if (!definition) throw new NotFoundError('Template');

    const strays = [
      ...unknownVariables(input.subject, definition.variables),
      ...unknownVariables(input.body, definition.variables),
    ];
    if (strays.length > 0) {
      throw new ValidationError(
        strays.map((name) => ({
          path: 'body',
          message: `This template has no "${name}". It can use: ${definition.variables.join(', ')}`,
        })),
      );
    }

    const org = await this.tenant.getOrganization();
    await this.prisma.emailTemplate.upsert({
      where: { organizationId_key: { organizationId: org.id, key } },
      create: {
        organizationId: org.id,
        key,
        subject: input.subject,
        bodyText: input.body,
        updatedById: actorId,
      },
      update: { subject: input.subject, bodyText: input.body, updatedById: actorId },
    });
    await this.audit.record({
      action: 'email_template.updated',
      resourceType: 'email_template',
      resourceId: key,
      summary: definition.label,
      after: { subject: input.subject },
    });
    return this.list();
  }

  /** Puts the template back to the platform's own wording. */
  async reset(key: EmailTemplateKey, actorId: string): Promise<EmailTemplateRecord[]> {
    const org = await this.tenant.getOrganization();
    await this.prisma.emailTemplate.deleteMany({ where: { organizationId: org.id, key } });
    await this.audit.record({
      action: 'email_template.reset',
      resourceType: 'email_template',
      resourceId: key,
      summary: key,
      actorId,
    });
    return this.list();
  }

  /**
   * What the platform should actually send for one template, with the variables filled in.
   * Every send path asks this rather than using its own wording, so an edit takes effect.
   */
  async resolve(
    key: EmailTemplateKey,
    values: Record<string, string | number>,
  ): Promise<{ subject: string; body: string }> {
    const definition = EMAIL_TEMPLATES.find((template) => template.key === key);
    if (!definition) throw new NotFoundError('Template');
    const org = await this.tenant.getOrganization();
    const stored = await this.prisma.emailTemplate.findUnique({
      where: { organizationId_key: { organizationId: org.id, key } },
    });
    return {
      subject: renderTemplate(stored?.subject ?? definition.defaultSubject, values),
      body: renderTemplate(stored?.bodyText ?? definition.defaultBody, values),
    };
  }

  /** Sends the template to one address with example values, so it can be read before it is used. */
  async test(key: EmailTemplateKey, to: string, actorName: string): Promise<{ sent: true }> {
    const brand = await this.branding.emailBrand();
    const resolved = await this.resolve(key, {
      name: actorName,
      brandName: brand.brandName,
      roles: ' as Student',
      title: 'An example notification',
      expiresInHours: 48,
      expiresInMinutes: 30,
    });
    await this.email.queue({
      to,
      subject: `[Test] ${resolved.subject}`,
      text: `${resolved.body}\n\n— This is a test of the "${key}" template.`,
      html: `<p>${resolved.body.replace(/\n/g, '<br>')}</p><p style="font-size:13px;color:#5b6775">This is a test of the “${key}” template.</p>`,
    });
    await this.audit.record({
      action: 'email_template.tested',
      resourceType: 'email_template',
      resourceId: key,
      summary: `Test sent to ${to}`,
    });
    return { sent: true };
  }
}
