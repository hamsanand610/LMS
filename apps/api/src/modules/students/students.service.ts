import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  type Paginated,
  SENSITIVE_PERSONAL_FIELDS,
  STUDENT_STATUS_TRANSITIONS,
  SYSTEM_ROLES,
  type StudentCreateInput,
  type StudentDetail,
  type StudentEducation,
  type StudentListQuery,
  type StudentPersonal,
  type StudentStatus,
  type StudentSummary,
  type StudentUpdateInput,
  studentEducationSchema,
  studentPersonalSchema,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, hasPermission } from '../../core/auth/auth-user.js';
import {
  ConflictError,
  DomainRuleError,
  NotFoundError,
  ValidationError,
} from '../../core/http/errors.js';
import { paginate, parseSort, skipTake } from '../../core/http/pagination.js';
import { asJson } from '../../core/prisma/json.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { InvitationService } from '../auth/invitation.service.js';
import { BatchesService } from '../batches/index.js';
import { CustomFieldsService } from '../settings/custom-fields.service.js';
import { formatStudentCode } from './student-code.js';

const SORT_FIELDS = ['createdAt', 'studentCode', 'status'] as const;

/** Sections that count towards the completeness score shown to staff and to the student. */
const COMPLETENESS_CHECKS: { key: string; label: string; weight: number }[] = [
  { key: 'mobile', label: 'A mobile number', weight: 20 },
  { key: 'personal', label: 'At least two personal details', weight: 25 },
  { key: 'education', label: 'One qualification', weight: 25 },
  { key: 'summary', label: 'A short summary', weight: 10 },
  { key: 'skills', label: 'Three skills', weight: 20 },
];

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly scope: ScopeService,
    private readonly invitations: InvitationService,
    private readonly customFields: CustomFieldsService,
    private readonly batches: BatchesService,
  ) {}

  async list(query: StudentListQuery, user: AuthUser): Promise<Paginated<StudentSummary>> {
    const org = await this.tenant.getOrganization();
    const batchIds = await this.scope.visibleBatchIds(user, 'students:read');
    // A batch-scoped caller with no batches sees nothing rather than everything.
    const membershipFilter =
      batchIds === null
        ? query.batchId
          ? { members: { some: { batchId: query.batchId, isActive: true } } }
          : {}
        : {
            members: {
              some: {
                batchId: {
                  in: query.batchId
                    ? [query.batchId].filter((id) => batchIds.includes(id))
                    : batchIds,
                },
                isActive: true,
              },
            },
          };

    // Every membership condition applies together: `unassigned` narrows a batch-scoped caller's
    // list (to nothing, as an unassigned learner is in none of their batches); it never replaces it.
    const memberConditions = [
      membershipFilter,
      ...(query.programId
        ? [{ members: { some: { isActive: true, batch: { programId: query.programId } } } }]
        : []),
      ...(query.unassigned ? [{ members: { none: { isActive: true } } }] : []),
    ].filter((condition) => Object.keys(condition).length > 0);
    const where = {
      user: { organizationId: org.id, deletedAt: null },
      ...(query.status ? { status: query.status } : {}),
      ...(query.verification ? { verificationStatus: query.verification } : {}),
      ...(memberConditions.length > 0 ? { AND: memberConditions } : {}),
      ...(query.q
        ? {
            OR: [
              { studentCode: { contains: query.q, mode: 'insensitive' as const } },
              { user: { name: { contains: query.q, mode: 'insensitive' as const } } },
              { user: { email: { contains: query.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const orderBy = parseSort(query.sort, SORT_FIELDS, {
      field: 'createdAt',
      direction: 'desc',
    }).map((s) => ({ [s.field]: s.direction }));

    const [rows, total] = await Promise.all([
      this.prisma.studentProfile.findMany({
        where,
        orderBy,
        ...skipTake(query),
        include: {
          user: true,
          members: { where: { isActive: true }, include: { batch: true } },
        },
      }),
      this.prisma.studentProfile.count({ where }),
    ]);
    return paginate(rows.map(toSummary), total, query);
  }

  async get(id: string, user: AuthUser): Promise<StudentDetail> {
    const student = await this.find(id, user);
    const sensitiveVisible = hasPermission(user, 'students:read_sensitive');
    const personal = (student.personal ?? {}) as Partial<StudentPersonal>;
    return {
      ...toSummary(student),
      personal: sensitiveVisible ? personal : stripSensitive(personal),
      education: (student.education as StudentEducation[]) ?? [],
      summary: student.summary,
      skills: student.skills,
      custom: (student.custom as Record<string, unknown>) ?? {},
      sensitiveVisible,
    };
  }

  /** J-01: creates the account, the student record, an optional batch membership and the invitation. */
  async create(input: StudentCreateInput, actor: AuthUser): Promise<StudentSummary> {
    const org = await this.tenant.getOrganization();
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findFirst({ where: { email } });
    if (existing)
      throw new ConflictError('An account with this email already exists', 'email_taken');
    if (input.mobile) await this.assertMobileFree(input.mobile, null);
    const custom = await this.customFields.validateValues('student', input.custom);

    const role = await this.prisma.role.findUnique({
      where: { organizationId_key: { organizationId: org.id, key: SYSTEM_ROLES.STUDENT } },
    });
    if (!role)
      throw new DomainRuleError('The student role is missing; run the base seed', 'role_missing');

    const batch = input.batchId
      ? await this.prisma.batch.findFirst({ where: { id: input.batchId, deletedAt: null } })
      : null;
    if (input.batchId && !batch) {
      throw new ValidationError([{ path: 'batchId', message: 'That batch does not exist' }]);
    }
    // Joining a batch follows the batch's own rules (open, room left) and brings its enrolments.

    const insert = (studentCode: string) =>
      this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            organizationId: org.id,
            email,
            mobile: input.mobile || null,
            name: input.name.trim(),
            status: 'invited',
            createdById: actor.id,
            roles: { create: [{ roleId: role.id, grantedById: actor.id }] },
          },
        });
        const profile = await tx.studentProfile.create({
          data: {
            userId: created.id,
            studentCode,
            status: input.status,
            custom: asJson(custom),
            createdById: actor.id,
          },
        });
        if (batch) await this.batches.insertMembers(tx, batch, [profile.id], actor.id);
        return tx.studentProfile.findUniqueOrThrow({
          where: { id: profile.id },
          include: { user: true, members: { where: { isActive: true }, include: { batch: true } } },
        });
      });
    const student = await this.withFreshCode(insert);

    if (batch) await this.batches.membersJoined(batch, [student.id]);
    if (input.sendInvitation) await this.invitations.issue(student.userId, actor.id);
    await this.audit.record({
      action: 'students.created',
      resourceType: 'student',
      resourceId: student.id,
      after: {
        studentCode: student.studentCode,
        email,
        name: input.name,
        batchId: batch?.id ?? null,
        status: input.status,
      },
      summary: `Student ${student.studentCode} (${email}) created`,
    });
    this.events.emit('student.created', { studentId: student.id, userId: student.userId });
    return toSummary(student);
  }

  async update(id: string, patch: StudentUpdateInput, user: AuthUser): Promise<StudentDetail> {
    const student = await this.find(id, user);
    if (patch.mobile) await this.assertMobileFree(patch.mobile, student.userId);
    const before = {
      name: student.user.name,
      mobile: student.user.mobile,
      personal: student.personal,
      education: student.education,
      summary: student.summary,
      skills: student.skills,
      custom: student.custom,
    };

    const personal =
      patch.personal === undefined
        ? (student.personal as Record<string, unknown>)
        : studentPersonalSchema.parse({
            ...(student.personal as Record<string, unknown>),
            ...patch.personal,
          });
    const education =
      patch.education === undefined
        ? (student.education as StudentEducation[])
        : patch.education.map((entry) => studentEducationSchema.parse(entry));
    const custom =
      patch.custom === undefined
        ? (student.custom as Record<string, unknown>)
        : await this.customFields.validateValues('student', patch.custom);

    const next = {
      personal,
      education,
      summary: patch.summary ?? student.summary,
      skills: patch.skills ?? student.skills,
      custom,
    };
    const mobile = patch.mobile === undefined ? student.user.mobile : patch.mobile || null;
    const completeness = computeCompleteness({ ...next, mobile });

    const updated = await this.prisma.$transaction(async (tx) => {
      if (patch.name !== undefined || patch.mobile !== undefined) {
        await tx.user.update({
          where: { id: student.userId },
          data: { name: patch.name?.trim(), mobile },
        });
      }
      await tx.studentProfile.update({
        where: { id },
        data: {
          personal: asJson(next.personal),
          education: asJson(next.education),
          summary: next.summary,
          skills: next.skills,
          custom: asJson(next.custom),
          completeness,
        },
      });
      return tx.studentProfile.findUniqueOrThrow({
        where: { id },
        include: { user: true, members: { where: { isActive: true }, include: { batch: true } } },
      });
    });

    await this.audit.record({
      action: 'students.updated',
      resourceType: 'student',
      resourceId: id,
      before,
      after: { name: updated.user.name, mobile: updated.user.mobile, ...next },
      summary: `Student ${updated.studentCode} updated`,
    });
    return this.get(id, user);
  }

  async setStatus(
    id: string,
    status: StudentStatus,
    reason: string,
    user: AuthUser,
  ): Promise<StudentSummary> {
    const student = await this.find(id, user);
    const allowed = STUDENT_STATUS_TRANSITIONS[student.status];
    if (student.status !== status && !allowed.includes(status)) {
      throw new ConflictError(
        `A student cannot move from ${student.status} to ${status}. Allowed: ${allowed.join(', ') || 'none'}`,
        'invalid_transition',
      );
    }
    const updated = await this.prisma.studentProfile.update({
      where: { id },
      data: { status },
      include: { user: true, members: { where: { isActive: true }, include: { batch: true } } },
    });
    await this.audit.record({
      action: 'students.status_changed',
      resourceType: 'student',
      resourceId: id,
      before: { status: student.status },
      after: { status, reason },
      summary: `Student ${student.studentCode} moved to ${status}`,
    });
    this.events.emit('student.status_changed', { studentId: id, status });
    return toSummary(updated);
  }

  async listNotes(id: string, user: AuthUser) {
    const student = await this.find(id, user);
    const notes = await this.prisma.studentNote.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { author: { select: { id: true, name: true } } },
    });
    return notes.map((n) => ({
      id: n.id,
      text: n.text,
      author: { id: n.author.id, name: n.author.name },
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async addNote(id: string, text: string, user: AuthUser) {
    const student = await this.find(id, user);
    const note = await this.prisma.studentNote.create({
      data: { studentId: student.id, authorId: user.id, text },
      include: { author: { select: { id: true, name: true } } },
    });
    await this.audit.record({
      action: 'students.note_added',
      resourceType: 'student',
      resourceId: student.id,
      summary: `Note added to ${student.studentCode}`,
    });
    return {
      id: note.id,
      text: note.text,
      author: { id: note.author.id, name: note.author.name },
      createdAt: note.createdAt.toISOString(),
    };
  }

  /** Batches the student belongs to, including past memberships. */
  async listBatches(id: string, user: AuthUser) {
    const student = await this.find(id, user);
    const members = await this.prisma.batchMember.findMany({
      where: { studentId: student.id },
      orderBy: { joinedAt: 'desc' },
      include: { batch: { include: { program: true } } },
    });
    return members.map((m) => ({
      batchId: m.batchId,
      code: m.batch.code,
      name: m.batch.name,
      programName: m.batch.program.name,
      status: m.batch.status,
      joinedAt: m.joinedAt.toISOString(),
      leftAt: m.leftAt?.toISOString() ?? null,
      isActive: m.isActive,
    }));
  }

  /**
   * Loads a student, enforcing the caller's batch scope for a permission: `students:read` by
   * default; their documents ask for `students:read_sensitive` (Phase 6).
   */
  async find(id: string, user: AuthUser, permission = 'students:read') {
    const org = await this.tenant.getOrganization();
    const student = await this.prisma.studentProfile.findFirst({
      where: { id, user: { organizationId: org.id, deletedAt: null } },
      include: { user: true, members: { where: { isActive: true }, include: { batch: true } } },
    });
    if (!student) throw new NotFoundError('Student');
    const batchIds = await this.scope.visibleBatchIds(user, permission);
    if (batchIds !== null && !student.members.some((m) => batchIds.includes(m.batchId))) {
      // Out of scope reads as "not found" so the existence of a record is not leaked.
      throw new NotFoundError('Student');
    }
    return student;
  }

  /**
   * A person given the learner role on the users page gets the learner record that role needs,
   * with a code of their own; one who already has a record keeps it (ADM-01).
   */
  @OnEvent('user.created')
  @OnEvent('user.roles_changed')
  async ensureProfile(payload: { userId: string }): Promise<void> {
    const holds = await this.prisma.userRole.count({
      where: { userId: payload.userId, role: { key: SYSTEM_ROLES.STUDENT } },
    });
    if (holds === 0) return;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = await this.prisma.studentProfile.findUnique({
        where: { userId: payload.userId },
        select: { id: true },
      });
      if (existing) return;
      try {
        const created = await this.prisma.studentProfile.create({
          data: {
            userId: payload.userId,
            studentCode: await this.allocateCode(),
            status: 'active',
          },
        });
        // A new learner is enrolled in what is published to everyone (Phase 5), as one made on
        // the students page is.
        await this.events.emitAsync('student.created', {
          studentId: created.id,
          userId: payload.userId,
        });
        return;
      } catch (error) {
        // Two codes allocated at once: the loser tries the next one.
        if ((error as { code?: string }).code !== 'P2002') throw error;
      }
    }
  }

  /**
   * Runs an insert with the next free code; two learners added at the same moment draw the same
   * one, and the later draws again (Phase 6).
   */
  private async withFreshCode<T>(insert: (studentCode: string) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await insert(await this.allocateCode());
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002' || attempt >= 2) throw error;
      }
    }
  }

  /**
   * The next student code for the current year: the highest number in use plus one, compared as
   * numbers (Phase 6). As text, STU-2026-10000 sorts below STU-2026-9999, and a code of another
   * shape sorts above both — either way the same code came back every time.
   */
  private async allocateCode(): Promise<string> {
    const year = new Date().getFullYear();
    const [row] = await this.prisma.$queryRaw<{ highest: number | null }[]>`
      SELECT MAX(substring(student_code FROM '^STU-[0-9]{4}-([0-9]{4,9})$')::int) AS highest
      FROM student_profiles
      WHERE student_code LIKE ${`STU-${year}-%`}`;
    const highest = row?.highest ?? 0;
    return formatStudentCode(year, highest + 1);
  }

  private async assertMobileFree(mobile: string, exceptUserId: string | null): Promise<void> {
    const clash = await this.prisma.user.findFirst({
      where: { mobile, ...(exceptUserId ? { NOT: { id: exceptUserId } } : {}) },
    });
    if (clash) throw new ConflictError('Another account uses this mobile number', 'mobile_taken');
  }
}

type StudentRow = {
  id: string;
  userId: string;
  studentCode: string;
  status: StudentStatus;
  verificationStatus: 'unverified' | 'pending' | 'verified';
  completeness: number;
  createdAt: Date;
  personal: unknown;
  education: unknown;
  summary: string;
  skills: string[];
  custom: unknown;
  user: {
    name: string;
    email: string;
    mobile: string | null;
    status: 'invited' | 'active' | 'suspended' | 'deactivated';
    lastLoginAt: Date | null;
  };
  members: { batchId: string; batch: { id: string; code: string; name: string } }[];
};

function toSummary(student: StudentRow): StudentSummary {
  return {
    id: student.id,
    userId: student.userId,
    studentCode: student.studentCode,
    name: student.user.name,
    email: student.user.email,
    mobile: student.user.mobile,
    status: student.status,
    accountStatus: student.user.status,
    verificationStatus: student.verificationStatus,
    batches: student.members.map((m) => ({
      id: m.batch.id,
      code: m.batch.code,
      name: m.batch.name,
    })),
    completeness: student.completeness,
    lastActiveAt: student.user.lastLoginAt?.toISOString() ?? null,
    createdAt: student.createdAt.toISOString(),
  };
}

/** Hides the personal fields that need `students:read_sensitive`. */
function stripSensitive(personal: Partial<StudentPersonal>): Partial<StudentPersonal> {
  const out: Record<string, unknown> = { ...personal };
  for (const field of SENSITIVE_PERSONAL_FIELDS) delete out[field];
  return out as Partial<StudentPersonal>;
}

/** Percentage of the profile a student has filled in; used for the completeness bar. */
export interface CompletenessInput {
  mobile?: string | null;
  personal: unknown;
  education: unknown;
  summary: string;
  skills: string[];
}

/**
 * What the score is made of, so the learner's own page can say which section is still empty
 * rather than only showing a number (plan AC-12.3).
 */
export function completenessParts(
  profile: CompletenessInput,
): { key: string; label: string; done: boolean; weight: number }[] {
  const personal = (profile.personal ?? {}) as Record<string, unknown>;
  const filledPersonal = ['dateOfBirth', 'city', 'state', 'guardianName'].filter((key) => {
    const value = personal[key];
    return value !== undefined && value !== null && String(value).length > 0;
  }).length;
  const values: Record<string, boolean> = {
    mobile: Boolean(profile.mobile),
    personal: filledPersonal >= 2,
    education: Array.isArray(profile.education) && profile.education.length > 0,
    summary: profile.summary.trim().length >= 20,
    skills: profile.skills.length >= 3,
  };
  return COMPLETENESS_CHECKS.map((check) => ({
    key: check.key,
    label: check.label,
    done: values[check.key] === true,
    weight: check.weight,
  }));
}

export function computeCompleteness(profile: CompletenessInput): number {
  return completenessParts(profile).reduce(
    (total, part) => total + (part.done ? part.weight : 0),
    0,
  );
}
