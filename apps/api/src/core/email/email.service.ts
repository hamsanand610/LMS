import { Inject, Injectable, Logger } from '@nestjs/common';
import { JobsService } from '../queue/jobs.service.js';
import { EMAIL_DRIVER, type EmailDriver, type EmailMessage } from './email.driver.js';

export const EMAIL_SEND_JOB = 'email.send';

/**
 * Sends email through the configured driver. Delivery normally goes through the queue so a slow
 * provider never blocks a request; `sendNow` exists for the CLI and tests.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_DRIVER) private readonly driver: EmailDriver,
    private readonly jobs: JobsService,
  ) {
    this.jobs.register<EmailMessage>(EMAIL_SEND_JOB, async (message) => {
      await this.sendNow(message);
    });
  }

  async queue(message: EmailMessage): Promise<void> {
    await this.jobs.enqueue(EMAIL_SEND_JOB, message, { retryLimit: 5, retryDelaySeconds: 60 });
  }

  async sendNow(message: EmailMessage): Promise<void> {
    const result = await this.driver.send(message);
    // The address is personal data; the provider's message id is enough to trace a delivery.
    this.logger.log({ id: result.id }, 'Email sent');
  }

  healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    return this.driver.healthCheck();
  }
}
