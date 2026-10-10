import nodemailer, { type Transporter } from 'nodemailer';
import type { AppConfig } from '../config/env.js';
import type { EmailDriver, EmailMessage } from './email.driver.js';

/** SMTP transport: Mailpit locally, any SMTP relay (or a provider's SMTP endpoint) elsewhere. */
export class SmtpEmailDriver implements EmailDriver {
  readonly name = 'smtp';
  private readonly transporter: Transporter;

  constructor(private readonly config: AppConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      // In production (Amazon SES on 587) the connection must upgrade to TLS before the password
      // and the mail go over it; a server that does not offer it is refused (Step 6 audit). Mailpit,
      // locally and on staging, offers none.
      requireTLS: config.APP_ENV === 'production' && !config.SMTP_SECURE,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
    });
  }

  async send(message: EmailMessage): Promise<{ id: string | null }> {
    const info = await this.transporter.sendMail({
      from: this.config.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
    });
    return { id: typeof info.messageId === 'string' ? info.messageId : null };
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    try {
      await this.transporter.verify();
      return { ok: true };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error) };
    }
  }
}

/** Used when EMAIL_DRIVER=none (tests): records messages in memory. */
export class NoopEmailDriver implements EmailDriver {
  readonly name = 'none';
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<{ id: string | null }> {
    this.sent.push(message);
    return { id: null };
  }

  async healthCheck(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}
