import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { BatchesService, DEACTIVATED_REASON } from '../batches/index.js';
import { EnrollmentService } from './enrollment.service.js';

export const RECONCILE_JOB = 'progress.reconcile';
/** Every quarter of an hour, like the platform's other sweeps; after a restart, the next run. */
export const RECONCILE_CRON = '*/15 * * * *';

/** What one run found and settled. */
export interface ReconciliationReport {
  learners: number;
  /** Places still held by accounts that are deactivated or erased. */
  placesEnded: number;
  completedKept: number;
  withdrawn: number;
  returned: number;
  added: number;
  /** Learners the run could not settle; they are tried again next time. */
  failed: number;
}

/**
 * Some effects follow a request instead of happening inside it — enrolments derived when a batch
 * changes, places ended when an account is deactivated — and an event handler that dies with its
 * process is retried by nothing (Phase 2's finding 9). This job re-derives that state from the
 * records themselves (Phase 5): every place an account should no longer hold is ended as a
 * removal is, and every learner's enrolments are brought to what the lifecycle says. It reads
 * state, not events, so running it twice — or alongside the handlers — changes nothing twice:
 * enrolments are unique per learner and course, and it sends no notices of its own. Certificates
 * missed by their event are issued by the certificates sweep, which is idempotent too.
 *
 * A learner it cannot settle is logged and counted, the rest go on, and the run then fails, so it
 * shows on the failed-jobs page and the queue tries again. A run that changed anything is audited.
 */
@Injectable()
export class ReconciliationService implements OnModuleInit {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
    private readonly batches: BatchesService,
    private readonly enrolments: EnrollmentService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(
      RECONCILE_JOB,
      async () => {
        await this.runJob();
      },
      { cron: RECONCILE_CRON },
    );
  }

  /** The job: a run that could not settle someone fails, so the queue retries it and shows it. */
  async runJob(): Promise<ReconciliationReport> {
    const report = await this.run();
    if (report.failed > 0) {
      throw new Error(
        `${report.failed} learner(s) could not be reconciled; the API log names them`,
      );
    }
    return report;
  }

  async run(): Promise<ReconciliationReport> {
    const org = await this.tenant.getOrganization();
    const report: ReconciliationReport = {
      learners: 0,
      placesEnded: 0,
      completedKept: 0,
      withdrawn: 0,
      returned: 0,
      added: 0,
      failed: 0,
    };

    // Places that should have ended with the account. (A removed learner role is settled inside the
    // request that removes it; a periodic rule keyed on permissions could empty every batch if an
    // institute reshaped its learner role, so it is not repeated here.)
    const inactive = await this.prisma.batchMember.findMany({
      where: {
        isActive: true,
        batch: { organizationId: org.id },
        student: {
          user: {
            OR: [{ deletedAt: { not: null } }, { status: { in: ['deactivated', 'suspended'] } }],
          },
        },
      },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    for (const { studentId } of inactive) {
      try {
        report.placesEnded += await this.batches.endPlaces(
          studentId,
          DEACTIVATED_REASON,
          'the account was deactivated',
        );
      } catch (error) {
        report.failed += 1;
        this.logger.error({ err: error, studentId }, 'Could not end batch places');
      }
    }

    // Every learner's enrolments, against the lifecycle.
    const learners = await this.prisma.studentProfile.findMany({
      where: { user: { organizationId: org.id } },
      select: { id: true },
    });
    report.learners = learners.length;
    for (const learner of learners) {
      try {
        const repair = await this.enrolments.reconcileStudent(learner.id);
        report.completedKept += repair.completedKept;
        report.withdrawn += repair.withdrawn;
        report.returned += repair.returned;
        report.added += repair.added;
      } catch (error) {
        report.failed += 1;
        this.logger.error({ err: error, studentId: learner.id }, 'Could not reconcile enrolments');
      }
    }

    const changed =
      report.placesEnded + report.completedKept + report.withdrawn + report.returned + report.added;
    if (changed > 0 || report.failed > 0) {
      await this.audit.record({
        action: 'progress.reconciled',
        resourceType: 'organization',
        resourceId: org.id,
        summary:
          `Reconciled ${report.learners} learners: ${report.placesEnded} places ended, ` +
          `${report.withdrawn} withdrawn, ${report.returned + report.added} given, ` +
          `${report.completedKept} completions kept, ${report.failed} failed`,
        after: report,
        actorId: null,
      });
    }
    this.logger.log(report, 'Reconciliation finished');
    return report;
  }
}
