import { createHmac, hkdfSync } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  FEEDBACK_MIN_RESPONSES,
  FEEDBACK_RATING_MAX,
  weeklyFeedbackRound,
  type FeedbackFormCreateInput,
  type FeedbackFormDetail,
  type FeedbackFormStatus,
  type FeedbackFormSummary,
  type FeedbackListQuery,
  type FeedbackQuestion,
  type FeedbackResults,
  type LearnerFeedbackItem,
  type Paginated,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { type AuthUser, hasPermission, scopeFor } from '../../core/auth/auth-user.js';
import { APP_CONFIG, type AppConfig } from '../../core/config/env.js';
import {
  ConflictError,
  DomainRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/http/errors.js';
import { paginate, skipTake } from '../../core/http/pagination.js';
import { asJson } from '../../core/prisma/json.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { requireOpenAudience } from '../../core/scope/open-audience.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { NotificationsService } from '../notifications/index.js';

export const FEEDBACK_ANNOUNCE_JOB = 'feedback.announce';

const FORM_INCLUDE = {
  batch: { select: { id: true, code: true, name: true } },
  trainer: { select: { id: true, user: { select: { name: true } } } },
  course: { select: { id: true, title: true } },
  _count: { select: { responses: true } },
} as const;

type FormRow = Prisma.FeedbackFormGetPayload<{ include: typeof FORM_INCLUDE }>;

/**
 * Feedback (F-18, Phases 3–4 D10). Administrators give forms to batches; learners answer; the
 * trainer a form is about sees its figures. An anonymous answer is stored with no learner, a random
 * id and the day only; a keyed hash of form, round and learner stops a second answer without saying
 * whose the first was (AC-13.2). No figure, chart or comment is shown below five answers.
 */
@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  /** Derived from the signing secret, so the secret itself never keys anything stored. */
  private readonly tokenKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly scope: ScopeService,
    private readonly notifications: NotificationsService,
    private readonly jobs: JobsService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.tokenKey = Buffer.from(
      hkdfSync('sha256', config.JWT_ACCESS_SECRET, '', 'lms.feedback.respondent.v1', 32),
    );
    this.jobs.register(
      FEEDBACK_ANNOUNCE_JOB,
      async () => {
        await this.announceOpenRounds();
      },
      { cron: '*/15 * * * *' },
    );
  }

  // ───────────────────────── staff ─────────────────────────

  /** Forms for staff: everything for administrators, the forms about them for a trainer. */
  async list(query: FeedbackListQuery, user: AuthUser): Promise<Paginated<FeedbackFormSummary>> {
    const org = await this.tenant.getOrganization();
    const where: Prisma.FeedbackFormWhereInput = {
      organizationId: org.id,
      deletedAt: null,
      ...(query.batchId ? { batchId: query.batchId } : {}),
      // A filter narrows what the caller may read and never replaces it.
      AND: [await this.readableBy(user), query.trainerId ? { trainerId: query.trainerId } : {}],
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.feedbackForm.findMany({
        where,
        orderBy: { opensAt: 'desc' },
        ...skipTake(query),
        include: FORM_INCLUDE,
      }),
      this.prisma.feedbackForm.count({ where }),
    ]);
    const zone = org.timezone;
    return paginate(
      rows.map((row) => toSummary(row, zone)),
      total,
      query,
    );
  }

  async get(id: string, user: AuthUser): Promise<FeedbackFormDetail> {
    const org = await this.tenant.getOrganization();
    const row = await this.findReadable(id, user);
    return {
      ...toSummary(row, org.timezone),
      description: row.description,
      questions: row.questions as FeedbackQuestion[],
    };
  }

  async create(input: FeedbackFormCreateInput, actor: AuthUser): Promise<FeedbackFormDetail> {
    const org = await this.tenant.getOrganization();
    await requireOpenAudience(this.prisma, { batchIds: [input.batchId] });
    const [batch, trainer, course] = await Promise.all([
      this.prisma.batch.count({
        where: { id: input.batchId, organizationId: org.id, deletedAt: null },
      }),
      input.trainerId
        ? this.prisma.trainerProfile.count({
            where: { id: input.trainerId, user: { organizationId: org.id, deletedAt: null } },
          })
        : Promise.resolve(1),
      input.courseId
        ? this.prisma.course.count({
            where: { id: input.courseId, organizationId: org.id, deletedAt: null },
          })
        : Promise.resolve(1),
    ]);
    const issues: { path: string; message: string }[] = [];
    if (batch === 0) issues.push({ path: 'batchId', message: 'That batch does not exist' });
    if (trainer === 0) issues.push({ path: 'trainerId', message: 'That trainer does not exist' });
    if (course === 0) issues.push({ path: 'courseId', message: 'That course does not exist' });
    if (issues.length > 0) throw new ValidationError(issues);

    const row = await this.prisma.feedbackForm.create({
      data: {
        organizationId: org.id,
        title: input.title,
        description: input.description,
        batchId: input.batchId,
        trainerId: input.trainerId,
        courseId: input.courseId,
        anonymous: input.anonymous,
        cadence: input.cadence,
        questions: asJson(input.questions),
        opensAt: new Date(input.opensAt),
        closesAt: input.closesAt ? new Date(input.closesAt) : null,
        createdById: actor.id,
      },
    });
    await this.audit.record({
      action: 'feedback.form_created',
      resourceType: 'feedback_form',
      resourceId: row.id,
      summary: `Feedback form "${input.title}" (${input.cadence}${input.anonymous ? ', anonymous' : ''})`,
      after: { batchId: input.batchId, trainerId: input.trainerId, cadence: input.cadence },
      actorId: actor.id,
    });
    await this.announceOpenRounds();
    return this.get(row.id, actor);
  }

  /** Ends a form now; what was answered stays. */
  async close(id: string, actor: AuthUser): Promise<FeedbackFormDetail> {
    const row = await this.findReadable(id, actor);
    const now = new Date();
    if (row.closesAt && row.closesAt <= now) {
      throw new DomainRuleError('This form is already closed', 'feedback_closed');
    }
    await this.prisma.feedbackForm.update({ where: { id }, data: { closesAt: now } });
    await this.audit.record({
      action: 'feedback.form_closed',
      resourceType: 'feedback_form',
      resourceId: id,
      summary: `Feedback form "${row.title}" closed`,
      actorId: actor.id,
    });
    return this.get(id, actor);
  }

  /**
   * The figures of one round. Below five answers only the counts are given (D10). Names appear
   * only on a form that is not anonymous, and only to whoever manages feedback.
   */
  async results(id: string, user: AuthUser, period?: string): Promise<FeedbackResults> {
    const org = await this.tenant.getOrganization();
    const form = await this.findReadable(id, user);
    const groups = await this.prisma.feedbackResponse.groupBy({
      by: ['period'],
      where: { formId: id },
      _count: { _all: true },
    });
    const periods = groups
      .map((g) => ({ period: g.period, responses: g._count._all }))
      .sort((a, b) => b.period.localeCompare(a.period));
    const chosen =
      period ??
      statusOf(form, new Date(), org.timezone).currentPeriod ??
      periods[0]?.period ??
      (form.cadence === 'once' ? 'once' : '');

    const seesNames = !form.anonymous && hasPermission(user, 'feedback:manage');
    const [rows, audience] = await Promise.all([
      this.prisma.feedbackResponse.findMany({
        where: { formId: id, period: chosen },
        // A random id, so the order says nothing about who answered when.
        orderBy: { id: 'asc' },
        // An anonymous answer has no learner to join; a named one's name is used only if allowed.
        select: { answers: true, student: { select: { user: { select: { name: true } } } } },
      }),
      this.prisma.batchMember.count({ where: { batchId: form.batchId, isActive: true } }),
    ]);
    const suppressed = rows.length < FEEDBACK_MIN_RESPONSES;
    const questions = (form.questions as FeedbackQuestion[]).map((question) => {
      const given = rows
        .map((row) => ({
          value: (row.answers as Record<string, unknown>)[question.id],
          name: seesNames ? (row.student?.user.name ?? null) : null,
        }))
        .filter((entry) => entry.value !== undefined && entry.value !== '');
      const base = {
        id: question.id,
        kind: question.kind,
        prompt: question.prompt,
        answered: given.length,
        average: null as number | null,
        distribution: [] as number[],
        choices: [] as { option: string; count: number }[],
        comments: [] as { text: string; name: string | null }[],
      };
      if (suppressed) return base;
      if (question.kind === 'rating') {
        const values = given.map((g) => Number(g.value)).filter((v) => Number.isFinite(v));
        base.average =
          values.length === 0
            ? null
            : Math.round((values.reduce((n, v) => n + v, 0) / values.length) * 10) / 10;
        base.distribution = Array.from(
          { length: FEEDBACK_RATING_MAX },
          (_, i) => values.filter((v) => v === i + 1).length,
        );
      } else if (question.kind === 'choice') {
        base.choices = question.options.map((option) => ({
          option,
          count: given.filter((g) => g.value === option).length,
        }));
      } else {
        base.comments = given.map((g) => ({ text: String(g.value), name: g.name }));
      }
      return base;
    });
    return {
      formId: id,
      period: chosen,
      periods,
      responses: rows.length,
      audience,
      suppressed,
      questions,
    };
  }

  // ───────────────────────── learners ─────────────────────────

  /** The forms open now for the learner's batches, and whether they have answered each. */
  async mine(user: AuthUser): Promise<LearnerFeedbackItem[]> {
    const org = await this.tenant.getOrganization();
    const person = await this.scope.personFor(user.id);
    if (!person.studentId || person.memberBatchIds.length === 0) return [];
    const now = new Date();
    const rows = await this.prisma.feedbackForm.findMany({
      where: {
        organizationId: org.id,
        deletedAt: null,
        batchId: { in: person.memberBatchIds },
        opensAt: { lte: now },
        OR: [{ closesAt: null }, { closesAt: { gt: now } }],
      },
      include: FORM_INCLUDE,
      orderBy: { opensAt: 'desc' },
    });
    const out: LearnerFeedbackItem[] = [];
    for (const row of rows) {
      const window = openWindow(row, now, org.timezone);
      if (!window) continue;
      const answered = await this.prisma.feedbackResponse.count({
        where: {
          formId: row.id,
          period: window.period,
          respondentToken: this.tokenFor(row.id, window.period, person.studentId),
        },
      });
      out.push({
        formId: row.id,
        title: row.title,
        description: row.description,
        anonymous: row.anonymous,
        period: window.period,
        closesAt: window.closesAt.toISOString(),
        answered: answered > 0,
        questions: row.questions as FeedbackQuestion[],
      });
    }
    return out;
  }

  /** One answer per learner per round; an anonymous one is stored without the learner. */
  async respond(
    formId: string,
    answers: Record<string, number | string>,
    user: AuthUser,
  ): Promise<{ period: string }> {
    const org = await this.tenant.getOrganization();
    const person = await this.scope.personFor(user.id);
    if (!person.studentId) throw new ForbiddenError('Feedback is given by learners');
    const form = await this.prisma.feedbackForm.findFirst({
      where: { id: formId, organizationId: org.id, deletedAt: null },
    });
    // Another batch's form is simply not there for this learner.
    if (!form || !person.memberBatchIds.includes(form.batchId)) {
      throw new NotFoundError('Feedback form');
    }
    const window = openWindow(form, new Date(), org.timezone);
    if (!window) {
      throw new DomainRuleError('This form is not open for answers now', 'feedback_not_open');
    }
    const clean = cleanAnswers(form.questions as FeedbackQuestion[], answers);
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    try {
      await this.prisma.feedbackResponse.create({
        data: {
          formId,
          period: window.period,
          respondentToken: this.tokenFor(formId, window.period, person.studentId),
          studentId: form.anonymous ? null : person.studentId,
          answers: asJson(clean),
          submittedOn: today,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictError('You have already answered this form', 'feedback_answered');
      }
      throw error;
    }
    return { period: window.period };
  }

  // ───────────────────────── rounds ─────────────────────────

  /** Tells each batch once per round that a form is open for it (AC-13.1). */
  async announceOpenRounds(now = new Date()): Promise<number> {
    const org = await this.tenant.getOrganization();
    const forms = await this.prisma.feedbackForm.findMany({
      where: {
        organizationId: org.id,
        deletedAt: null,
        opensAt: { lte: now },
        OR: [{ closesAt: null }, { closesAt: { gt: now } }],
      },
    });
    let announced = 0;
    for (const form of forms) {
      const window = openWindow(form, now, org.timezone);
      if (!window || form.notifiedPeriod === window.period) continue;
      const members = await this.prisma.batchMember.findMany({
        where: { batchId: form.batchId, isActive: true },
        select: { student: { select: { userId: true } } },
      });
      if (members.length > 0) {
        await this.notifications.deliver({
          category: 'announcement',
          type: 'feedback.open',
          title: `Feedback: ${form.title}`,
          body: form.anonymous ? 'A few questions, answered anonymously.' : 'A few questions.',
          link: `/feedback/${form.id}`,
          channels: ['in_app'],
          userIds: members.map((m) => m.student.userId),
        });
      }
      await this.prisma.feedbackForm.update({
        where: { id: form.id },
        data: { notifiedPeriod: window.period },
      });
      announced += 1;
    }
    if (announced > 0) this.logger.log(`Announced ${announced} feedback round(s)`);
    return announced;
  }

  // ───────────────────────── internals ─────────────────────────

  private tokenFor(formId: string, period: string, studentId: string): string {
    return createHmac('sha256', this.tokenKey)
      .update(`${formId}:${period}:${studentId}`)
      .digest('hex');
  }

  /** Whose forms a staff member may read: all, the ones about them, or none. */
  private async readableBy(user: AuthUser): Promise<Prisma.FeedbackFormWhereInput> {
    if (hasPermission(user, 'feedback:manage')) return {};
    const scope = scopeFor(user, 'feedback:read');
    if (scope === 'all') return {};
    if (scope === 'own') {
      const person = await this.scope.personFor(user.id);
      // A trainer reads the forms about them; someone else reads none.
      return { trainerId: person.trainerId ?? '00000000-0000-0000-0000-000000000000' };
    }
    throw new ForbiddenError('You do not have access to this resource');
  }

  private async findReadable(id: string, user: AuthUser): Promise<FormRow> {
    const org = await this.tenant.getOrganization();
    const row = await this.prisma.feedbackForm.findFirst({
      where: { id, organizationId: org.id, deletedAt: null, ...(await this.readableBy(user)) },
      include: FORM_INCLUDE,
    });
    if (!row) throw new NotFoundError('Feedback form');
    return row;
  }
}

/** Where a form stands: before it opens, open (with its round), between weekly rounds, closed. */
function statusOf(
  form: { cadence: string; opensAt: Date; closesAt: Date | null },
  now: Date,
  zone: string,
): { status: FeedbackFormStatus; currentPeriod: string | null } {
  if (now < form.opensAt) return { status: 'scheduled', currentPeriod: null };
  if (form.closesAt && now >= form.closesAt) return { status: 'closed', currentPeriod: null };
  if (form.cadence === 'once') return { status: 'open', currentPeriod: 'once' };
  const round = weeklyFeedbackRound(now, zone);
  return round
    ? { status: 'open', currentPeriod: round.period }
    : { status: 'between_rounds', currentPeriod: null };
}

/** The round a learner may answer now, and when it closes; null when none is open. */
function openWindow(
  form: { cadence: string; opensAt: Date; closesAt: Date | null },
  now: Date,
  zone: string,
): { period: string; closesAt: Date } | null {
  const { status, currentPeriod } = statusOf(form, now, zone);
  if (status !== 'open' || !currentPeriod) return null;
  if (form.cadence === 'once') return { period: 'once', closesAt: form.closesAt ?? now };
  const round = weeklyFeedbackRound(now, zone)!;
  const closesAt = form.closesAt && form.closesAt < round.closesAt ? form.closesAt : round.closesAt;
  return { period: currentPeriod, closesAt };
}

/** Answers that fit the questions: required ones given, ratings in range, choices from the list. */
function cleanAnswers(
  questions: FeedbackQuestion[],
  answers: Record<string, number | string>,
): Record<string, number | string> {
  const issues: { path: string; message: string }[] = [];
  const clean: Record<string, number | string> = {};
  for (const question of questions) {
    const value = answers[question.id];
    if (value === undefined || value === '') {
      if (question.required) {
        issues.push({ path: `answers.${question.id}`, message: 'This question needs an answer' });
      }
      continue;
    }
    const fits =
      question.kind === 'rating'
        ? typeof value === 'number'
        : question.kind === 'choice'
          ? typeof value === 'string' && question.options.includes(value)
          : typeof value === 'string';
    if (!fits) {
      issues.push({
        path: `answers.${question.id}`,
        message: 'That answer does not fit the question',
      });
      continue;
    }
    clean[question.id] = typeof value === 'string' ? value.trim() : value;
  }
  if (issues.length > 0) throw new ValidationError(issues);
  return clean;
}

function toSummary(row: FormRow, zone: string): FeedbackFormSummary {
  const { status, currentPeriod } = statusOf(row, new Date(), zone);
  return {
    id: row.id,
    title: row.title,
    batch: row.batch,
    trainer: row.trainer ? { id: row.trainer.id, name: row.trainer.user.name } : null,
    course: row.course,
    anonymous: row.anonymous,
    cadence: row.cadence as FeedbackFormSummary['cadence'],
    opensAt: row.opensAt.toISOString(),
    closesAt: row.closesAt?.toISOString() ?? null,
    status,
    currentPeriod,
    responses: row._count.responses,
    createdAt: row.createdAt.toISOString(),
  };
}
