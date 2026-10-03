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
    // A cloud provider is never a bare name: Gemini comes with its key and model (Phase 7B).
    expect(envSchema.safeParse({ ...REQUIRED, AI_PROVIDER: 'gemini' }).success).toBe(false);
    expect(envSchema.safeParse({ ...REQUIRED, AI_PROVIDER: 'openai' }).success).toBe(false);
  });

  it('only accepts known client keys, drivers and modes', () => {
    expect(envSchema.safeParse({ ...REQUIRED, CLIENT_KEY: 'Bad Key' }).success).toBe(false);
    expect(envSchema.safeParse({ ...REQUIRED, WORKER_MODE: 'cluster' }).success).toBe(false);
    expect(envSchema.safeParse({ ...REQUIRED, EXECUTION_DRIVER: 'in-process' }).success).toBe(
      false,
    );
  });
});

describe('SI Academy AI configuration (Phase 7B)', () => {
  const issues = (overrides: Record<string, string>) => {
    const result = envSchema.safeParse({ ...REQUIRED, ...overrides });
    return result.success
      ? []
      : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  };

  it('needs no key, model or address to start with AI off — locally, in CI and in tests', () => {
    const config = envSchema.parse(REQUIRED);
    expect(config).toMatchObject({
      AI_PROVIDER: 'none',
      GEMINI_API_KEY: '',
      GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1',
      AI_TASK_MODELS: {},
      AI_FALLBACK_MODEL: '',
      AI_TIMEOUT_MS: 60_000,
      AI_DATA_CLASSES: ['public'],
      AI_MODEL_COSTS: {},
    });
  });

  it('requires Gemini’s key and model, and accepts it with both', () => {
    expect(issues({ AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-3.8-flash' })).toEqual([
      'GEMINI_API_KEY: is required when AI_PROVIDER=gemini',
    ]);
    expect(issues({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k'.repeat(39) })).toEqual([
      'AI_MODEL: is required when AI_PROVIDER=gemini (a model the registry lists)',
    ]);
    const config = envSchema.parse({
      ...REQUIRED,
      AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: ` ${'k'.repeat(39)}\n`,
      AI_MODEL: 'gemini-3.8-flash',
    });
    // Pasted with a space or a line break around it: trimmed, as the provider expects it.
    expect(config.GEMINI_API_KEY).toBe('k'.repeat(39));
  });

  it('never repeats a refused key in its error', () => {
    let message = '';
    try {
      loadConfig({
        ...REQUIRED,
        LMS_SKIP_ENV_FILE: '1',
        AI_PROVIDER: 'gemini',
        AI_MODEL: 'gemini-3.8-flash',
        GEMINI_API_KEY: 'pasted canary-secret-value',
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('- GEMINI_API_KEY: must not contain spaces');
    expect(message).not.toContain('canary-secret-value');
  });

  it('reads per-task models, a fallback, a deadline, prices and approved data classes', () => {
    const config = envSchema.parse({
      ...REQUIRED,
      AI_TASK_MODELS: ' title=gemini-3.5-flash-lite, summarize = gemini-3.5-flash-lite ,',
      AI_FALLBACK_MODEL: 'gemini-3.5-flash-lite',
      AI_TIMEOUT_MS: '120000',
      AI_MODEL_COSTS: 'gemini-3.8-flash=0.50/3.00,gemini-3.5-flash-lite=0.1/0.4',
      AI_DATA_CLASSES: 'public, course, personal, course',
    });
    expect(config.AI_TASK_MODELS).toEqual({
      title: 'gemini-3.5-flash-lite',
      summarize: 'gemini-3.5-flash-lite',
    });
    expect(config.AI_TIMEOUT_MS).toBe(120_000);
    expect(config.AI_MODEL_COSTS).toEqual({
      'gemini-3.8-flash': { inputUsdPerMillion: 0.5, outputUsdPerMillion: 3 },
      'gemini-3.5-flash-lite': { inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.4 },
    });
    expect(config.AI_DATA_CLASSES).toEqual(['public', 'course', 'personal']);
  });

  it('refuses malformed AI settings, and restricted data outright', () => {
    for (const AI_TASK_MODELS of [
      'title',
      'quiz=gemini-3.8-flash',
      'title=Gemini 3.8',
      'title=a=b',
      'title=gemini-3.8-flash,title=gemini-3.5-flash-lite',
    ]) {
      expect(issues({ AI_TASK_MODELS }).length, AI_TASK_MODELS).toBe(1);
    }
    for (const AI_MODEL_COSTS of ['gemini-3.8-flash=1', 'gemini=1/2/3', 'Bad Model=1/2']) {
      expect(issues({ AI_MODEL_COSTS }).length, AI_MODEL_COSTS).toBe(1);
    }
    expect(issues({ AI_DATA_CLASSES: 'public,restricted' })).toEqual([
      'AI_DATA_CLASSES: restricted data never leaves the platform (ADR-0024): it cannot be approved',
    ]);
    expect(issues({ AI_DATA_CLASSES: 'secret' })).toHaveLength(1);
    for (const AI_TIMEOUT_MS of ['999', '300001', 'soon']) {
      expect(issues({ AI_TIMEOUT_MS }).length, AI_TIMEOUT_MS).toBe(1);
    }
    expect(issues({ AI_MODEL: 'models/gemini-3.8-flash?key=x' })).toHaveLength(1);
    expect(issues({ AI_FALLBACK_MODEL: '../other' })).toHaveLength(1);
  });

  it('sets daily allowances, an optional monthly budget and an output limit (Phase 7C)', () => {
    expect(envSchema.parse(REQUIRED)).toMatchObject({
      AI_USER_DAILY_REQUESTS: 50,
      AI_USER_DAILY_TOKENS: 100_000,
      AI_ORG_MONTHLY_BUDGET_USD: null,
      AI_MAX_OUTPUT_TOKENS: 4096,
      AI_FAKE_DELAY_MS: 0,
    });
    expect(
      envSchema.parse({ ...REQUIRED, AI_ORG_MONTHLY_BUDGET_USD: '25.50' })
        .AI_ORG_MONTHLY_BUDGET_USD,
    ).toBe(25.5);
    for (const [name, value] of [
      ['AI_ORG_MONTHLY_BUDGET_USD', '0'],
      ['AI_ORG_MONTHLY_BUDGET_USD', '-5'],
      ['AI_ORG_MONTHLY_BUDGET_USD', 'lots'],
      ['AI_USER_DAILY_REQUESTS', '0'],
      ['AI_USER_DAILY_TOKENS', '10'],
      ['AI_MAX_OUTPUT_TOKENS', '100000'],
      ['AI_FAKE_DELAY_MS', '5000'],
    ] as const) {
      expect(issues({ [name]: value }).length, `${name}=${value}`).toBe(1);
    }
  });

  it('keeps the key out of URLs: no query, fragment or credentials in the provider address', () => {
    for (const GEMINI_BASE_URL of [
      'https://generativelanguage.googleapis.com/v1?key=abc',
      'https://generativelanguage.googleapis.com/v1#key',
      'https://user:secret@generativelanguage.googleapis.com/v1',
      'ftp://generativelanguage.googleapis.com/v1',
      'not a url',
    ]) {
      expect(issues({ GEMINI_BASE_URL }).length, GEMINI_BASE_URL).toBe(1);
    }
    // A local stand-in may be plain http while nobody else uses the site.
    expect(issues({ GEMINI_BASE_URL: 'http://localhost:8787/v1' })).toEqual([]);
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

  it('refuses Gemini outside local on a placeholder key or a plain-http address', () => {
    const base = {
      ...REQUIRED,
      LMS_SKIP_ENV_FILE: '1',
      APP_ENV: 'staging',
      COOKIE_SECURE: 'true',
      S3_SECRET_KEY: 'x'.repeat(24),
      RUNNER_TOKEN: 'r'.repeat(40),
      S3_PUBLIC_BASE_URL: 'https://files.example.com/lms-public',
      AI_PROVIDER: 'gemini',
      AI_MODEL: 'gemini-3.8-flash',
      GEMINI_API_KEY: 'k'.repeat(39),
    };
    expect(() => loadConfig({ ...base, GEMINI_API_KEY: 'replace-me-with-the-key' })).toThrow(
      /GEMINI_API_KEY still has the placeholder value/,
    );
    expect(() => loadConfig({ ...base, GEMINI_BASE_URL: 'http://gemini.internal/v1' })).toThrow(
      /GEMINI_BASE_URL must be an https address/,
    );
    expect(loadConfig(base).AI_PROVIDER).toBe('gemini');
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
