import { Injectable } from '@nestjs/common';
import {
  type CustomFieldDefinition,
  type CustomFieldEntity,
  type CustomFieldRecord,
  customFieldDefinitionSchema,
  customValuesSchema,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { MemoryCache } from '../../core/cache/memory-cache.js';
import { ConflictError, NotFoundError, ValidationError } from '../../core/http/errors.js';
import { issuesToFieldIssues } from '../../core/http/validation.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';

/**
 * Fields a client adds to students or batches without a code change. Definitions live here;
 * the values live in the owning record's `custom` JSON column and are validated on write.
 */
@Injectable()
export class CustomFieldsService {
  private readonly cache = new MemoryCache<CustomFieldRecord[]>(30_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
  ) {}

  async list(entityType: CustomFieldEntity, includeArchived = true): Promise<CustomFieldRecord[]> {
    const cacheKey = `${entityType}:${includeArchived}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const org = await this.tenant.getOrganization();
    const rows = await this.prisma.customFieldDefinition.findMany({
      where: {
        organizationId: org.id,
        entityType,
        ...(includeArchived ? {} : { archived: false }),
      },
      orderBy: [{ position: 'asc' }, { label: 'asc' }],
    });
    const records = rows.map(toRecord);
    this.cache.set(cacheKey, records);
    return records;
  }

  async create(input: CustomFieldDefinition, actorId: string | null): Promise<CustomFieldRecord> {
    const org = await this.tenant.getOrganization();
    const existing = await this.prisma.customFieldDefinition.findUnique({
      where: {
        organizationId_entityType_key: {
          organizationId: org.id,
          entityType: input.entityType,
          key: input.key,
        },
      },
    });
    if (existing)
      throw new ConflictError(`A field with key "${input.key}" already exists`, 'field_taken');
    const row = await this.prisma.customFieldDefinition.create({
      data: {
        organizationId: org.id,
        entityType: input.entityType,
        key: input.key,
        label: input.label,
        type: input.type,
        helpText: input.helpText,
        options: input.options,
        required: input.required,
        visibility: input.visibility,
        position: input.position,
        archived: input.archived,
      },
    });
    this.cache.clear();
    await this.audit.record({
      action: 'settings.custom_field_created',
      resourceType: 'custom_field',
      resourceId: row.id,
      after: input,
      summary: `Custom field ${input.entityType}.${input.key} created`,
      actorId,
    });
    return toRecord(row);
  }

  async update(
    id: string,
    patch: Partial<CustomFieldDefinition>,
    actorId: string | null,
  ): Promise<CustomFieldRecord> {
    const org = await this.tenant.getOrganization();
    const before = await this.prisma.customFieldDefinition.findFirst({
      where: { id, organizationId: org.id },
    });
    if (!before) throw new NotFoundError('Custom field');
    const merged = customFieldDefinitionSchema.safeParse({ ...toRecord(before), ...patch });
    if (!merged.success) throw new ValidationError(issuesToFieldIssues(merged.error.issues));
    const row = await this.prisma.customFieldDefinition.update({
      where: { id },
      data: {
        label: merged.data.label,
        helpText: merged.data.helpText,
        options: merged.data.options,
        required: merged.data.required,
        visibility: merged.data.visibility,
        position: merged.data.position,
        archived: merged.data.archived,
      },
    });
    this.cache.clear();
    await this.audit.record({
      action: 'settings.custom_field_updated',
      resourceType: 'custom_field',
      resourceId: id,
      before: toRecord(before),
      after: toRecord(row),
      summary: `Custom field ${row.entityType}.${row.key} updated`,
      actorId,
    });
    return toRecord(row);
  }

  async remove(id: string, actorId: string | null): Promise<void> {
    const org = await this.tenant.getOrganization();
    const row = await this.prisma.customFieldDefinition.findFirst({
      where: { id, organizationId: org.id },
    });
    if (!row) throw new NotFoundError('Custom field');
    // Values already stored in records are left untouched; archiving keeps them readable.
    await this.prisma.customFieldDefinition.delete({ where: { id } });
    this.cache.clear();
    await this.audit.record({
      action: 'settings.custom_field_deleted',
      resourceType: 'custom_field',
      resourceId: id,
      before: toRecord(row),
      summary: `Custom field ${row.entityType}.${row.key} deleted`,
      actorId,
    });
  }

  /**
   * Validates a `custom` object against the active definitions of an entity.
   * Values for archived or unknown fields are rejected rather than silently stored.
   */
  async validateValues(
    entityType: CustomFieldEntity,
    values: Record<string, unknown>,
    path = 'custom',
  ): Promise<Record<string, unknown>> {
    const definitions = await this.list(entityType, false);
    if (definitions.length === 0 && Object.keys(values).length === 0) return {};
    const result = customValuesSchema(definitions).safeParse(values);
    if (!result.success) {
      throw new ValidationError(
        result.error.issues.map((issue) => ({
          path: [path, ...issue.path.map(String)].join('.'),
          message: issue.message,
          code: issue.code,
        })),
      );
    }
    return result.data as Record<string, unknown>;
  }

  invalidate(): void {
    this.cache.clear();
  }
}

function toRecord(row: {
  id: string;
  entityType: string;
  key: string;
  label: string;
  type: string;
  helpText: string;
  options: unknown;
  required: boolean;
  visibility: string;
  position: number;
  archived: boolean;
}): CustomFieldRecord {
  return {
    id: row.id,
    entityType: row.entityType as CustomFieldEntity,
    key: row.key,
    label: row.label,
    type: row.type as CustomFieldRecord['type'],
    helpText: row.helpText,
    options: (row.options as CustomFieldRecord['options']) ?? [],
    required: row.required,
    visibility: row.visibility as CustomFieldRecord['visibility'],
    position: row.position,
    archived: row.archived,
  };
}
