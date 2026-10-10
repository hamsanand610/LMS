import { Inject, Injectable } from '@nestjs/common';
import {
  slugify,
  type CompanyCard,
  type CompanyDetail,
  type CompanyKitInput,
  type CompanyListQuery,
  type CompanyUpsertInput,
  type KitCandidate,
  type KitItemStatus,
  type KitItemView,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, scopeFor } from '../../core/auth/auth-user.js';
import { DomainRuleError, NotFoundError, ValidationError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { ACCEPTED_PRACTICE_RUN } from '../execution/index.js';

type CompanyRow = {
  id: string;
  slug: string;
  name: string;
  industry: string;
  website: string;
  description: string;
  logoFileId: string | null;
  technologies: string[];
  _count: { kitItems: number };
};

/**
 * What a learner may see of the companies: one with an interview-prep kit, or with a drive that has
 * been announced (open, or closed since). A company entered for a drive still in draft stays with
 * staff, so an opportunity being prepared is not shown, by its employer's name, before it is
 * verified and opened (Step 4, genuine placement data).
 */
const LEARNER_VISIBLE = {
  OR: [
    { kitItems: { some: {} } },
    { drives: { some: { deletedAt: null, status: { not: 'draft' as const } } } },
  ],
};

/**
 * Companies and their interview-prep kits (ADR-0014). A kit is an ordered list of practice
 * problems, so a learner solves a kit question in the practice workspace and it counts exactly as
 * practice does: the same runs, the same verdicts, the same points.
 */
@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  async list(user: AuthUser, query: CompanyListQuery): Promise<CompanyCard[]> {
    const org = await this.tenant.getOrganization();
    const person = await this.scope.personFor(user.id);
    const contains = query.q ? { contains: query.q, mode: 'insensitive' as const } : undefined;
    const rows = await this.prisma.company.findMany({
      where: {
        organizationId: org.id,
        deletedAt: null,
        ...(contains ? { OR: [{ name: contains }, { industry: contains }] } : {}),
        ...(query.technology ? { technologies: { has: query.technology } } : {}),
        ...(query.view === 'favourites' ? { favourites: { some: { userId: user.id } } } : {}),
        AND: visibleTo(user),
      },
      include: { _count: { select: { kitItems: true } } },
      orderBy: { name: 'asc' },
    });

    const cards = await this.toCards(rows, user.id, Boolean(person.studentId));
    if (query.view === 'in_progress') {
      return cards.filter((c) => c.solved > 0 && c.solved < c.kitSize);
    }
    if (query.view === 'completed')
      return cards.filter((c) => c.kitSize > 0 && c.solved >= c.kitSize);
    return cards;
  }

  async get(slug: string, user: AuthUser): Promise<CompanyDetail> {
    const org = await this.tenant.getOrganization();
    const row = await this.prisma.company.findFirst({
      where: { organizationId: org.id, slug, deletedAt: null, AND: visibleTo(user) },
      include: { _count: { select: { kitItems: true } } },
    });
    if (!row) throw new NotFoundError('Company');
    return this.detail(row, user);
  }

  async getById(id: string, user: AuthUser): Promise<CompanyDetail> {
    const row = await this.findOrThrow(id, user);
    return this.detail(row, user);
  }

  async create(input: CompanyUpsertInput, user: AuthUser): Promise<CompanyDetail> {
    const org = await this.tenant.getOrganization();
    const slug = await this.uniqueSlug(org.id, input.name);
    await this.assertLogo(input.logoFileId);
    const row = await this.prisma.company.create({
      data: { ...input, organizationId: org.id, slug, createdById: user.id },
      include: { _count: { select: { kitItems: true } } },
    });
    await this.audit.record({
      action: 'company.created',
      resourceType: 'company',
      resourceId: row.id,
      summary: row.name,
      after: { name: row.name },
    });
    return this.detail(row, user);
  }

  async update(id: string, input: CompanyUpsertInput, user: AuthUser): Promise<CompanyDetail> {
    const before = await this.findOrThrow(id);
    await this.assertLogo(input.logoFileId);
    const row = await this.prisma.company.update({
      where: { id },
      data: input,
      include: { _count: { select: { kitItems: true } } },
    });
    await this.audit.record({
      action: 'company.updated',
      resourceType: 'company',
      resourceId: id,
      summary: row.name,
      before: { name: before.name },
      after: { name: row.name },
    });
    return this.detail(row, user);
  }

  /** Retires a company. One with an open drive is refused: close the drive first. */
  async remove(id: string): Promise<void> {
    const row = await this.findOrThrow(id);
    const open = await this.prisma.placementDrive.count({
      where: { companyId: id, status: 'open', deletedAt: null },
    });
    if (open > 0) {
      throw new DomainRuleError(
        'This company has an open drive. Close it before removing the company.',
        'company_has_open_drive',
      );
    }
    await this.prisma.company.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({
      action: 'company.removed',
      resourceType: 'company',
      resourceId: id,
      summary: row.name,
    });
  }

  /** Replaces the kit. Every item must be a published practice problem of this institute. */
  async setKit(id: string, input: CompanyKitInput, user: AuthUser): Promise<CompanyDetail> {
    const company = await this.findOrThrow(id);
    const org = await this.tenant.getOrganization();
    const ids = input.items.map((i) => i.questionId);
    if (new Set(ids).size !== ids.length) {
      throw new ValidationError([
        { path: 'items', message: 'A question appears twice in the kit' },
      ]);
    }
    const usable = await this.prisma.question.findMany({
      where: {
        id: { in: ids },
        organizationId: org.id,
        deletedAt: null,
        inPractice: true,
        status: 'published',
        type: 'coding',
      },
      select: { id: true },
    });
    const ok = new Set(usable.map((q) => q.id));
    const bad = input.items.findIndex((i) => !ok.has(i.questionId));
    if (bad !== -1) {
      throw new ValidationError([
        {
          path: `items.${bad}.questionId`,
          message: 'Only published practice problems can go in a kit',
        },
      ]);
    }
    await this.prisma.$transaction([
      this.prisma.companyKitItem.deleteMany({ where: { companyId: id } }),
      this.prisma.companyKitItem.createMany({
        data: input.items.map((item, position) => ({
          companyId: id,
          questionId: item.questionId,
          topic: item.topic,
          position,
        })),
      }),
    ]);
    await this.audit.record({
      action: 'company.kit_updated',
      resourceType: 'company',
      resourceId: id,
      summary: `${company.name}: ${input.items.length} questions`,
      after: { questions: input.items.length },
    });
    return this.getById(id, user);
  }

  /** Published practice problems a kit may use, for the kit editor's search. */
  async candidates(q: string | undefined): Promise<KitCandidate[]> {
    const org = await this.tenant.getOrganization();
    const rows = await this.prisma.question.findMany({
      where: {
        organizationId: org.id,
        deletedAt: null,
        inPractice: true,
        status: 'published',
        type: 'coding',
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' as const } },
                { topic: { contains: q, mode: 'insensitive' as const } },
                { subject: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        subject: true,
        topic: true,
        difficulty: true,
        practicePoints: true,
      },
      orderBy: [{ subject: 'asc' }, { title: 'asc' }],
      take: 50,
    });
    return rows.map((row) => ({
      questionId: row.id,
      slug: row.slug,
      title: row.title,
      subject: row.subject,
      topic: row.topic,
      difficulty: row.difficulty,
      points: row.practicePoints,
    }));
  }

  async favourite(id: string, user: AuthUser, on: boolean): Promise<{ isFavourite: boolean }> {
    await this.findOrThrow(id, user);
    if (on) {
      await this.prisma.companyFavourite.upsert({
        where: { userId_companyId: { userId: user.id, companyId: id } },
        create: { userId: user.id, companyId: id },
        update: {},
      });
    } else {
      await this.prisma.companyFavourite.deleteMany({ where: { userId: user.id, companyId: id } });
    }
    return { isFavourite: on };
  }

  async logoUrl(fileId: string | null): Promise<string | null> {
    if (!fileId) return null;
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.status !== 'ready' || file.visibility !== 'public') return null;
    return this.storage.publicUrl(file.key);
  }

  // ───────────────────────── internals ─────────────────────────

  /** A company by id; for a learner, only one they may see (`LEARNER_VISIBLE`). */
  private async findOrThrow(id: string, user?: AuthUser): Promise<CompanyRow> {
    const org = await this.tenant.getOrganization();
    const row = await this.prisma.company.findFirst({
      where: { id, organizationId: org.id, deletedAt: null, AND: user ? visibleTo(user) : [] },
      include: { _count: { select: { kitItems: true } } },
    });
    if (!row) throw new NotFoundError('Company');
    return row;
  }

  private async detail(row: CompanyRow, user: AuthUser): Promise<CompanyDetail> {
    const person = await this.scope.personFor(user.id);
    const items = await this.prisma.companyKitItem.findMany({
      where: { companyId: row.id, question: { deletedAt: null, status: 'published' } },
      include: {
        question: {
          select: { id: true, slug: true, title: true, difficulty: true, practicePoints: true },
        },
      },
      orderBy: { position: 'asc' },
    });
    const stats = person.studentId
      ? await this.runStats(
          user.id,
          items.map((i) => i.questionId),
        )
      : new Map<string, { attempts: number; accepted: number }>();
    const kit: KitItemView[] = items.map((item) => {
      const s = stats.get(item.questionId);
      const status: KitItemStatus = !s ? 'not_started' : s.accepted > 0 ? 'solved' : 'attempted';
      return {
        questionId: item.questionId,
        slug: item.question.slug,
        title: item.question.title,
        topic: item.topic,
        difficulty: item.question.difficulty,
        points: item.question.practicePoints,
        status,
        attempts: s?.attempts ?? 0,
      };
    });
    const [card] = await this.toCards([row], user.id, Boolean(person.studentId));
    return {
      ...card!,
      kitSize: kit.length,
      solved: kit.filter((k) => k.status === 'solved').length,
      website: row.website,
      description: row.description,
      logoFileId: row.logoFileId,
      kit,
    };
  }

  private async toCards(
    rows: CompanyRow[],
    userId: string,
    learner: boolean,
  ): Promise<CompanyCard[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const [favourites, drives, kitItems] = await Promise.all([
      this.prisma.companyFavourite.findMany({
        where: { userId, companyId: { in: ids } },
        select: { companyId: true },
      }),
      this.prisma.placementDrive.groupBy({
        by: ['companyId'],
        where: {
          companyId: { in: ids },
          status: 'open',
          deletedAt: null,
          applyBy: { gt: new Date() },
        },
        _count: { _all: true },
      }),
      learner
        ? this.prisma.companyKitItem.findMany({
            where: { companyId: { in: ids } },
            select: { companyId: true, questionId: true },
          })
        : Promise.resolve([]),
    ]);
    const solvedIds = learner
      ? await this.solvedQuestionIds(
          userId,
          kitItems.map((k) => k.questionId),
        )
      : new Set<string>();
    const fav = new Set(favourites.map((f) => f.companyId));
    const openBy = new Map(drives.map((d) => [d.companyId, d._count._all]));
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        industry: row.industry,
        logoUrl: await this.logoUrl(row.logoFileId),
        technologies: row.technologies,
        kitSize: row._count.kitItems,
        solved: kitItems.filter((k) => k.companyId === row.id && solvedIds.has(k.questionId))
          .length,
        isFavourite: fav.has(row.id),
        openDrives: openBy.get(row.id) ?? 0,
      })),
    );
  }

  private async runStats(
    userId: string,
    questionIds: string[],
  ): Promise<Map<string, { attempts: number; accepted: number }>> {
    if (questionIds.length === 0) return new Map();
    const rows = await this.prisma.executionRun.groupBy({
      by: ['questionId', 'verdict', 'trust'],
      where: { userId, context: 'practice', questionId: { in: questionIds } },
      _count: { _all: true },
    });
    const out = new Map<string, { attempts: number; accepted: number }>();
    for (const row of rows) {
      if (!row.questionId) continue;
      const current = out.get(row.questionId) ?? { attempts: 0, accepted: 0 };
      current.attempts += row._count._all;
      if (
        row.verdict === ACCEPTED_PRACTICE_RUN.verdict &&
        row.trust === ACCEPTED_PRACTICE_RUN.trust
      ) {
        current.accepted += row._count._all;
      }
      out.set(row.questionId, current);
    }
    return out;
  }

  private async solvedQuestionIds(userId: string, questionIds: string[]): Promise<Set<string>> {
    if (questionIds.length === 0) return new Set();
    const rows = await this.prisma.executionRun.findMany({
      where: {
        userId,
        ...ACCEPTED_PRACTICE_RUN,
        questionId: { in: [...new Set(questionIds)] },
      },
      select: { questionId: true },
      distinct: ['questionId'],
    });
    return new Set(rows.map((r) => r.questionId).filter((id): id is string => Boolean(id)));
  }

  private async uniqueSlug(organizationId: string, name: string): Promise<string> {
    const base = slugify(name) || 'company';
    let slug = base;
    for (
      let n = 2;
      await this.prisma.company.findUnique({
        where: { organizationId_slug: { organizationId, slug } },
      });
      n += 1
    ) {
      slug = `${base}-${n}`;
    }
    return slug;
  }

  private async assertLogo(fileId: string | null): Promise<void> {
    if (!fileId) return;
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.ownerType !== 'company-logo' || file.status !== 'ready') {
      throw new ValidationError([{ path: 'logoFileId', message: 'Upload the logo first' }]);
    }
  }
}

/** The visibility rule a query adds for this person: none for staff, `LEARNER_VISIBLE` for learners. */
function visibleTo(user: AuthUser): (typeof LEARNER_VISIBLE)[] {
  return scopeFor(user, 'placements:read') === 'own' ? [LEARNER_VISIBLE] : [];
}
