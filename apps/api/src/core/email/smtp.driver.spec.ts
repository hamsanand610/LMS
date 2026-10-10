import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../config/env.js';
import { SmtpEmailDriver } from './smtp.driver.js';

function optionsFor(config: Partial<AppConfig>): { requireTLS?: boolean; secure?: boolean } {
  const driver = new SmtpEmailDriver({
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    EMAIL_FROM: 'noreply@example.com',
    ...config,
  } as AppConfig);
  return (driver as unknown as { transporter: { options: { requireTLS?: boolean } } }).transporter
    .options;
}

describe('the SMTP transport', () => {
  it('insists on TLS before signing in to the relay in production (SES on 587)', () => {
    expect(optionsFor({ APP_ENV: 'production' }).requireTLS).toBe(true);
  });

  it('leaves an implicit-TLS connection (port 465) as it is', () => {
    expect(optionsFor({ APP_ENV: 'production', SMTP_SECURE: true }).requireTLS).toBe(false);
  });

  it('talks plain SMTP to Mailpit locally and on staging', () => {
    expect(optionsFor({ APP_ENV: 'local' }).requireTLS).toBe(false);
    expect(optionsFor({ APP_ENV: 'staging' }).requireTLS).toBe(false);
  });
});
