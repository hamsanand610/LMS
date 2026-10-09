import { Injectable } from '@nestjs/common';
import type { ContentPageInput, ContentPageRecord, PublicContentPage } from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { ConflictError, NotFoundError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { BUILT_IN_PAGES } from './built-in-pages.js';

/**
 * The institute's own pages — terms, privacy, anything else — shown at `/pages/<slug>`
 * (plan DP-P09, DP-A33). A draft is reachable only by somebody who may manage settings, so a page
 * can be written before anybody is pointed at it. The Privacy Policy and the Terms of Service have
 * a built-in text (built-in-pages.ts), shown until the institute publishes its own page at the same
 * address: the sign-in page and the invitation link to them, so they must never read as missing.
 */
@Injectable()
export class ContentPagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<ContentPageRecord[]> {
    const org = await this.tenant.getOrganization();
    const rows = await this.prisma.contentPage.findMany({
      where: { organizationId: org.id },
      orderBy: { slug: 'asc' },
    });
    return rows.map(toRecord);
  }

  /**
   * What a visitor gets: the institute's published page; else, for privacy and terms, the built-in
   * text; else nothing — a page that is not published reads as missing.
   */
  async publicPage(slug: string): Promise<PublicContentPage> {
    const org = await this.tenant.getOrganization();
    const row = await this.prisma.contentPage.findFirst({
      where: { organizationId: org.id, slug, isPublished: true },
    });
    if (row) {
      return {
        slug: row.slug,
        title: row.title,
        body: row.body,
        updatedAt: row.updatedAt.toISOString(),
      };
    }
    const builtIn = BUILT_IN_PAGES.get(slug);
    if (builtIn) return { slug, ...builtIn };
    throw new NotFoundError('Page');
  }

  async create(input: ContentPageInput, actorId: string): Promise<ContentPageRecord> {
    const org = await this.tenant.getOrganization();
    const existing = await this.prisma.contentPage.findFirst({
      where: { organizationId: org.id, slug: input.slug },
    });
    if (existing) throw new ConflictError('A page with that address already exists', 'slug_taken');

    const row = await this.prisma.contentPage.create({
      data: {
        organizationId: org.id,
        slug: input.slug,
        title: input.title,
        body: input.body,
        isPublished: input.isPublished,
        updatedById: actorId,
      },
    });
    await this.audit.record({
      action: 'content_page.created',
      resourceType: 'content_page',
      resourceId: row.id,
      summary: `${row.slug} — ${row.title}`,
      after: { slug: row.slug, isPublished: row.isPublished },
    });
    return toRecord(row);
  }

  async update(
    id: string,
    input: Partial<Omit<ContentPageInput, 'slug'>>,
    actorId: string,
  ): Promise<ContentPageRecord> {
    const org = await this.tenant.getOrganization();
    const before = await this.prisma.contentPage.findFirst({
      where: { id, organizationId: org.id },
    });
    if (!before) throw new NotFoundError('Page');

    const row = await this.prisma.contentPage.update({
      where: { id },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.body === undefined ? {} : { body: input.body }),
        ...(input.isPublished === undefined ? {} : { isPublished: input.isPublished }),
        updatedById: actorId,
      },
    });
    await this.audit.record({
      action: 'content_page.updated',
      resourceType: 'content_page',
      resourceId: id,
      summary: `${row.slug} — ${row.title}`,
      before: { title: before.title, isPublished: before.isPublished },
      after: { title: row.title, isPublished: row.isPublished },
    });
    return toRecord(row);
  }

  async remove(id: string, actorId: string): Promise<void> {
    const org = await this.tenant.getOrganization();
    const row = await this.prisma.contentPage.findFirst({ where: { id, organizationId: org.id } });
    if (!row) throw new NotFoundError('Page');
    await this.prisma.contentPage.delete({ where: { id } });
    await this.audit.record({
      action: 'content_page.deleted',
      resourceType: 'content_page',
      resourceId: id,
      summary: row.slug,
      actorId,
    });
  }
}

function toRecord(row: {
  id: string;
  slug: string;
  title: string;
  body: string;
  isPublished: boolean;
  updatedAt: Date;
}): ContentPageRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    body: row.body,
    isPublished: row.isPublished,
    updatedAt: row.updatedAt.toISOString(),
  };
}
