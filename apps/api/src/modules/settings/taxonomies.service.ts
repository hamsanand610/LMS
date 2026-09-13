import { Injectable } from '@nestjs/common';
import {
  DEFAULT_TERMS,
  TAXONOMY_KEYS,
  type TaxonomyKey,
  type TaxonomyTerm,
  type TermCreateInput,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { MemoryCache } from '../../core/cache/memory-cache.js';
import { ConflictError, DomainRuleError, NotFoundError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';

/**
 * Curated vocabularies (course levels, subjects, topics). Records store the term key, so a client
 * can rename a label at any time without touching the records that use it.
 */
@Injectable()
export class TaxonomiesService {
  private readonly cache = new MemoryCache<TaxonomyTerm[]>(30_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
  ) {}

  /** Creates the starting terms for a new deployment; never overwrites what a client has edited. */
  async seedDefaults(): Promise<number> {
    const org = await this.tenant.getOrganization();
    let created = 0;
    for (const taxonomy of TAXONOMY_KEYS) {
      for (const [index, term] of DEFAULT_TERMS[taxonomy].entries()) {
        const existing = await this.prisma.taxonomyTerm.findUnique({
          where: {
            organizationId_taxonomy_key: { organizationId: org.id, taxonomy, key: term.key },
          },
        });
        if (existing) continue;
        await this.prisma.taxonomyTerm.create({
          data: {
            organizationId: org.id,
            taxonomy,
            key: term.key,
            label: term.label,
            position: index,
          },
        });
        created += 1;
      }
    }
    this.cache.clear();
    return created;
  }

  async list(taxonomy: TaxonomyKey, includeArchived = true): Promise<TaxonomyTerm[]> {
    const cacheKey = `${taxonomy}:${includeArchived}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const org = await this.tenant.getOrganization();
    const rows = await this.prisma.taxonomyTerm.findMany({
      where: {
        organizationId: org.id,
        taxonomy,
        ...(includeArchived ? {} : { archived: false }),
      },
      orderBy: [{ position: 'asc' }, { label: 'asc' }],
    });
    const usage = await this.usageCounts(
      taxonomy,
      rows.map((r) => r.key),
    );
    const terms = rows.map((row) => ({
      id: row.id,
      taxonomy: row.taxonomy as TaxonomyKey,
      key: row.key,
      label: row.label,
      position: row.position,
      archived: row.archived,
      usageCount: usage.get(row.key) ?? 0,
    }));
    this.cache.set(cacheKey, terms);
    return terms;
  }

  async create(
    taxonomy: TaxonomyKey,
    input: TermCreateInput,
    actorId: string | null,
  ): Promise<TaxonomyTerm> {
    const org = await this.tenant.getOrganization();
    const existing = await this.prisma.taxonomyTerm.findUnique({
      where: { organizationId_taxonomy_key: { organizationId: org.id, taxonomy, key: input.key } },
    });
    if (existing)
      throw new ConflictError(`A term with key "${input.key}" already exists`, 'term_taken');
    const row = await this.prisma.taxonomyTerm.create({
      data: {
        organizationId: org.id,
        taxonomy,
        key: input.key,
        label: input.label,
        position: input.position,
      },
    });
    this.cache.clear();
    await this.audit.record({
      action: 'settings.term_created',
      resourceType: 'taxonomy_term',
      resourceId: row.id,
      after: { taxonomy, ...input },
      summary: `Term ${taxonomy}/${input.key} created`,
      actorId,
    });
    return { ...toTerm(row), usageCount: 0 };
  }

  async update(
    id: string,
    patch: { label?: string; position?: number; archived?: boolean },
    actorId: string | null,
  ): Promise<TaxonomyTerm> {
    const org = await this.tenant.getOrganization();
    const before = await this.prisma.taxonomyTerm.findFirst({
      where: { id, organizationId: org.id },
    });
    if (!before) throw new NotFoundError('Term');
    const row = await this.prisma.taxonomyTerm.update({ where: { id }, data: patch });
    this.cache.clear();
    await this.audit.record({
      action: 'settings.term_updated',
      resourceType: 'taxonomy_term',
      resourceId: id,
      before: { label: before.label, position: before.position, archived: before.archived },
      after: patch,
      summary: `Term ${before.taxonomy}/${before.key} updated`,
      actorId,
    });
    const usage = await this.usageCounts(row.taxonomy as TaxonomyKey, [row.key]);
    return { ...toTerm(row), usageCount: usage.get(row.key) ?? 0 };
  }

  /** A term that records still reference is archived instead of deleted. */
  async remove(id: string, actorId: string | null): Promise<void> {
    const org = await this.tenant.getOrganization();
    const row = await this.prisma.taxonomyTerm.findFirst({ where: { id, organizationId: org.id } });
    if (!row) throw new NotFoundError('Term');
    const usage = await this.usageCounts(row.taxonomy as TaxonomyKey, [row.key]);
    if ((usage.get(row.key) ?? 0) > 0) {
      throw new DomainRuleError(
        `${usage.get(row.key)} record(s) still use this term; archive it instead`,
        'term_in_use',
      );
    }
    await this.prisma.taxonomyTerm.delete({ where: { id } });
    this.cache.clear();
    await this.audit.record({
      action: 'settings.term_deleted',
      resourceType: 'taxonomy_term',
      resourceId: id,
      before: toTerm(row),
      summary: `Term ${row.taxonomy}/${row.key} deleted`,
      actorId,
    });
  }

  /** True when the key names a live term, so callers can validate what they store. */
  async isValid(taxonomy: TaxonomyKey, key: string): Promise<boolean> {
    if (key === '') return true;
    const terms = await this.list(taxonomy, false);
    return terms.some((t) => t.key === key);
  }

  private async usageCounts(taxonomy: TaxonomyKey, keys: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (keys.length === 0) return counts;
    if (taxonomy === 'course-level' || taxonomy === 'subject') {
      const field = taxonomy === 'course-level' ? 'level' : 'subject';
      const rows = await this.prisma.course.groupBy({
        by: [field],
        where: { deletedAt: null, [field]: { in: keys } },
        _count: { _all: true },
      });
      for (const row of rows) {
        const value = (row as unknown as Record<string, string>)[field];
        counts.set(value, (row as unknown as { _count: { _all: number } })._count._all);
      }
    }
    // Topics are referenced by questions, which arrive with the assessment modules.
    return counts;
  }
}

function toTerm(row: {
  id: string;
  taxonomy: string;
  key: string;
  label: string;
  position: number;
  archived: boolean;
}): Omit<TaxonomyTerm, 'usageCount'> {
  return {
    id: row.id,
    taxonomy: row.taxonomy as TaxonomyKey,
    key: row.key,
    label: row.label,
    position: row.position,
    archived: row.archived,
  };
}
