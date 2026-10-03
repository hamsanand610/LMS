import { describe, expect, it } from 'vitest';
import { envSchema, isBrowserFacingUrl, loadConfig } from './env.js';

const REQUIRED = {
  DATABASE_URL: 'postgresql://user:secret@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
};

describe('envSchema', () => {
  it('applies local defaults when only the required variables are given', () => {
    const config = envSchema.parse(REQUIRED);
    expect(config.APP_ENV).toBe('local');
    expect(config.PORT).toBe(4000);
    expect(config.CLIENT_KEY).toBe('demo');
    expect(config.WORKER_MODE).toBe('embedded');
    expect(config.EXECUTION_DRIVER).toBe('runner');
    expect(config.CORS_ORIGINS).toEqual([]);
    expect(config.COOKIE_SECURE).toBe(false);
  });

  it('rejects a missing database URL and a short JWT secret', () => {
    expect(envSchema.safeParse({ JWT_ACCESS_SECRET: REQUIRED.JWT_ACCESS_SECRET }).success).toBe(
      false,
    );
    expect(envSchema.safeParse({ ...REQUIRED, JWT_ACCESS_SECRET: 'short' }).success).toBe(false);
  });

  it('reads the old browser-sandbox setting as "no execution"', () => {
    expect(
      envSchema.parse({ ...REQUIRED, EXECUTION_DRIVER: 'browser-sandbox' }).EXECUTION_DRIVER,
    ).toBe('none');
  });

  it('parses booleans and comma-separated lists from strings', () => {
    const config = envSchema.parse({
      ...REQUIRED,
      COOKIE_SECURE: 'TRUE',
      CORS_ORIGINS: 'http://a.test, http://b.test ,',
    });
    expect(config.COOKIE_SECURE).toBe(true);
    expect(config.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });

  it('keeps SI Academy AI off unless a provider is chosen, and knows only its own providers', () => {
    const config = envSchema.parse(REQUIRED);
    expect(config.AI_PROVIDER).toBe('none');
    expect(config.AI_MODEL).toBe('');
    expect(envSchema.parse({ ...REQUIRED, AI_PROVIDER: 'fake' }).AI_PROVIDER).toBe('fake');
    // A cloud provider arrives with its adapter (Phase 7B), never as a bare name.
    expect(envSchema.safeParse({ ...REQUIRED, AI_PROVIDER: 'gemini' }).success).toBe(false);
  });

  it('only accepts known client keys, drivers and modes', () => {
    expect(envSchema.safeParse({ ...REQUIRED, CLIENT_KEY: 'Bad Key' }).success).toBe(false);
    expect(envSchema.safeParse({ ...REQUIRED, WORKER_MODE: 'cluster' }).success).toBe(false);
    expect(envSchema.safeParse({ ...REQUIRED, EXECUTION_DRIVER: 'in-process' }).success).toBe(
      false,
    );
  });
});

describe('loadConfig', () => {
  it('refuses production with insecure cookies or the placeholder secret', () => {
    const base = {
      ...REQUIRED,
      LMS_SKIP_ENV_FILE: '1',
      APP_ENV: 'production',
      S3_SECRET_KEY: 'x'.repeat(24),
      RUNNER_TOKEN: 'r'.repeat(40),
      S3_PUBLIC_BASE_URL: 'https://files.example.com/lms-public',
    };
    expect(() => loadConfig({ ...base, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
    expect(() =>
      loadConfig({
        ...base,
        COOKIE_SECURE: 'true',
        JWT_ACCESS_SECRET: 'change-me-'.padEnd(40, 'x'),
      }),
    ).toThrow(/placeholder/);
    expect(loadConfig({ ...base, COOKIE_SECURE: 'true' }).APP_ENV).toBe('production');
  });

  it('refuses staging on the passwords the local setup ships with', () => {
    const base = {
      ...REQUIRED,
      LMS_SKIP_ENV_FILE: '1',
      APP_ENV: 'staging',
      COOKIE_SECURE: 'true',
      S3_SECRET_KEY: 'x'.repeat(24),
      EXECUTION_DRIVER: 'runner',
      RUNNER_TOKEN: 'r'.repeat(40),
      S3_PUBLIC_BASE_URL: 'https://files.example.com/lms-public',
    };
    expect(() =>
      loadConfig({ ...base, DATABASE_URL: 'postgresql://lms:lms_dev_password@db:5432/lms' }),
    ).toThrow(/DATABASE_URL uses the local development password/);
    expect(() => loadConfig({ ...base, S3_SECRET_KEY: 'lms_minio_password' })).toThrow(
      /S3_SECRET_KEY/,
    );
    expect(() => loadConfig({ ...base, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
    expect(() => loadConfig({ ...base, RUNNER_TOKEN: 'short' })).toThrow(/RUNNER_TOKEN/);
    expect(loadConfig(base).APP_ENV).toBe('staging');
    // Local development keeps working on them.
    expect(
      loadConfig({
        ...base,
        APP_ENV: 'local',
        COOKIE_SECURE: 'false',
        S3_SECRET_KEY: 'lms_minio_password',
      }).APP_ENV,
    ).toBe('local');
  });

  it('refuses the example files’ placeholders and a file address browsers cannot reach', () => {
    const base = {
      ...REQUIRED,
      LMS_SKIP_ENV_FILE: '1',
      APP_ENV: 'staging',
      COOKIE_SECURE: 'true',
      S3_SECRET_KEY: 'x'.repeat(24),
      RUNNER_TOKEN: 'r'.repeat(40),
      S3_PUBLIC_BASE_URL: 'https://files.example.com/lms-public',
    };
    expect(() => loadConfig({ ...base, S3_SECRET_KEY: 'replace-me-with-a-long-secret' })).toThrow(
      /S3_SECRET_KEY still has the placeholder value/,
    );
    expect(() => loadConfig({ ...base, JWT_ACCESS_SECRET: 'replace-me-'.padEnd(48, 'x') })).toThrow(
      /JWT_ACCESS_SECRET still has the placeholder value/,
    );
    // The address a page links public files with must not be an internal container host.
    for (const internal of ['', 'http://minio:9000/lms-public', 'https://localhost/files']) {
      expect(() => loadConfig({ ...base, S3_PUBLIC_BASE_URL: internal })).toThrow(
        /S3_PUBLIC_BASE_URL/,
      );
    }
    expect(
      loadConfig({ ...base, APP_ENV: 'local', COOKIE_SECURE: 'false', S3_PUBLIC_BASE_URL: '' })
        .APP_ENV,
    ).toBe('local');
  });

  it('refuses the fake AI provider outside local development (ADR-0024)', () => {
    const base = {
      ...REQUIRED,
      LMS_SKIP_ENV_FILE: '1',
      APP_ENV: 'staging',
      COOKIE_SECURE: 'true',
      S3_SECRET_KEY: 'x'.repeat(24),
      RUNNER_TOKEN: 'r'.repeat(40),
      S3_PUBLIC_BASE_URL: 'https://files.example.com/lms-public',
    };
    expect(() => loadConfig({ ...base, AI_PROVIDER: 'fake' })).toThrow(
      /AI_PROVIDER=fake is for local development and tests only/,
    );
    expect(loadConfig(base).AI_PROVIDER).toBe('none');
    expect(
      loadConfig({ ...base, APP_ENV: 'local', COOKIE_SECURE: 'false', AI_PROVIDER: 'fake' })
        .AI_PROVIDER,
    ).toBe('fake');
  });

  it('reports every invalid variable in one error', () => {
    let message = '';
    try {
      loadConfig({
        LMS_SKIP_ENV_FILE: '1',
        DATABASE_URL: '',
        JWT_ACCESS_SECRET: 'short',
        PORT: '99999',
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('Invalid environment configuration');
    for (const name of ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'PORT'])
      expect(message).toContain(`- ${name}:`);
  });
});

describe('isBrowserFacingUrl', () => {
  it('accepts public https addresses only', () => {
    expect(isBrowserFacingUrl('https://files.example.com/lms-public')).toBe(true);
    expect(isBrowserFacingUrl('https://lms.example.org')).toBe(true);
    for (const value of [
      'http://minio:9000',
      'https://minio:9000',
      'http://files.example.com',
      'https://localhost:9000',
      'https://127.0.0.1:9000',
      'https://10.0.0.5',
      'https://172.20.0.3',
      'https://192.168.1.10',
      'https://169.254.169.254',
      'not a url',
      '',
    ]) {
      expect(isBrowserFacingUrl(value), value).toBe(false);
    }
  });
});
