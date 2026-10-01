import { readFileSync } from 'node:fs';
import { Controller, Get, Inject, Logger, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public, RequirePermission } from '../../core/auth/decorators.js';
import { APP_CONFIG, type AppConfig } from '../../core/config/env.js';
import { EmailService } from '../../core/email/email.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { JobsService } from '../../core/queue/jobs.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { ExecutionService } from '../execution/index.js';

function readVersion(): string {
  try {
    return (
      (JSON.parse(readFileSync('package.json', 'utf8')) as { version?: string }).version ?? '0.0.0'
    );
  } catch {
    return '0.0.0';
  }
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  @Public()
  @Get('live')
  live() {
    return { status: 'ok', time: new Date().toISOString() };
  }

  /**
   * Public, so it says only whether each dependency answers. Why one does not (a host name, a
   * user name in a connection error) goes to the log and to the administrators' health page.
   */
  @Public()
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const db = await this.checkDb();
    const storage = await this.storage.healthCheck();
    const ok = db.ok && storage.ok;
    if (!ok) {
      res.status(503);
      this.logger.warn({ db: db.detail, storage: storage.detail }, 'Not ready');
    }
    return {
      status: ok ? 'ok' : 'degraded',
      checks: { db: { ok: db.ok }, storage: { ok: storage.ok } },
    };
  }

  private async checkDb(): Promise<{ ok: boolean; detail?: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error) };
    }
  }
}

@ApiTags('health')
@Controller('admin')
export class AdminHealthController {
  private readonly version = readVersion();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly email: EmailService,
    private readonly execution: ExecutionService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @RequirePermission('settings:manage')
  @Get('health')
  async health() {
    const [db, storage, email, queue, sandbox] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`
        .then(() => ({ ok: true }))
        .catch((e: Error) => ({ ok: false, detail: e.message })),
      this.storage.healthCheck(),
      this.email.healthCheck(),
      this.jobs.stats().catch((e: Error) => ({
        queued: 0,
        active: 0,
        failed: 0,
        mode: this.config.WORKER_MODE,
        error: e.message,
      })),
      this.execution.available
        ? this.execution
            .health()
            .catch(() => ({ ok: false, detail: 'The sandbox could not be checked' }))
        : Promise.resolve({
            ok: false,
            detail: 'Code execution is switched off on this installation',
          }),
    ]);
    return {
      version: this.version,
      env: this.config.APP_ENV,
      clientKey: this.config.CLIENT_KEY,
      time: new Date().toISOString(),
      checks: {
        db,
        storage: { ...storage, driver: this.storage.name },
        email: { ...email, driver: this.config.EMAIL_DRIVER },
        queue,
      },
      execution: {
        driver: this.execution.driverName,
        available: this.execution.available,
        trust: this.execution.trust,
        ok: sandbox.ok,
        ...(sandbox.detail ? { detail: sandbox.detail } : {}),
      },
    };
  }
}
