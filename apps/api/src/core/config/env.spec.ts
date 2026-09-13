import { describe, expect, it } from 'vitest';
import { envSchema, loadConfig } from './env.js';

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
    expect(config.EXECUTION_DRIVER).toBe('browser-sandbox');
    expect(config.CORS_ORIGINS).toEqual([]);
    expect(config.COOKIE_SECURE).toBe(false);
  });

  it('rejects a missing database URL and a short JWT secret', () => {
    expect(envSchema.safeParse({ JWT_ACCESS_SECRET: REQUIRED.JWT_ACCESS_SECRET }).success).toBe(
      false,
    );
    expect(envSchema.safeParse({ ...REQUIRED, JWT_ACCESS_SECRET: 'short' }).success).toBe(false);
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
    const base = { ...REQUIRED, LMS_SKIP_ENV_FILE: '1', APP_ENV: 'production' };
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
