import { describe, expect, it } from 'vitest';
import { acceptInvitationSchema, changePasswordSchema, loginSchema } from './auth.js';
import { brandingSeedsSchema } from './branding.js';
import { mobileSchema, paginationQuerySchema } from './common.js';

describe('loginSchema', () => {
  it('normalises the email and defaults rememberMe to false', () => {
    const parsed = loginSchema.parse({ email: '  Admin@Demo.LOCAL ', password: 'x' });
    expect(parsed.email).toBe('admin@demo.local');
    expect(parsed.rememberMe).toBe(false);
  });

  it('rejects malformed emails and empty passwords', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});

describe('acceptInvitationSchema', () => {
  it('requires both consents to be literally true and a 10+ character password', () => {
    expect(
      acceptInvitationSchema.safeParse({
        password: 'short',
        consents: { terms: true, privacy: true },
      }).success,
    ).toBe(false);
    expect(
      acceptInvitationSchema.safeParse({
        password: 'long-enough-password',
        consents: { terms: true, privacy: false },
      }).success,
    ).toBe(false);
    expect(
      acceptInvitationSchema.safeParse({
        password: 'long-enough-password',
        consents: { terms: true, privacy: true },
      }).success,
    ).toBe(true);
  });
});

describe('changePasswordSchema', () => {
  it('applies the password policy to the new password only', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'a', newPassword: 'tooshort' }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'a', newPassword: 'a-longer-secret-1' })
        .success,
    ).toBe(true);
  });
});

describe('common schemas', () => {
  it('accepts Indian and international mobile numbers with a country code', () => {
    expect(mobileSchema.safeParse('+919876543210').success).toBe(true);
    expect(mobileSchema.safeParse('919876543210').success).toBe(true);
    expect(mobileSchema.safeParse('98765').success).toBe(false);
    expect(mobileSchema.safeParse('+91 98765 43210').success).toBe(false);
  });

  it('coerces and bounds pagination parameters', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 25 });
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toMatchObject({
      page: 3,
      pageSize: 50,
    });
    expect(paginationQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });
});

describe('brandingSeedsSchema', () => {
  it('fills every optional seed with a default', () => {
    const seeds = brandingSeedsSchema.parse({
      brandName: 'Demo Institute',
      primaryColor: '#0B6E4F',
    });
    expect(seeds.fontUi).toBe('ibm-plex-sans');
    expect(seeds.radius).toBe('md');
    expect(seeds.login.layout).toBe('split');
    expect(seeds.email.supportEmail).toBeNull();
  });

  it('rejects shorthand or named colours', () => {
    expect(brandingSeedsSchema.safeParse({ brandName: 'x', primaryColor: '#0B6' }).success).toBe(
      false,
    );
    expect(brandingSeedsSchema.safeParse({ brandName: 'x', primaryColor: 'green' }).success).toBe(
      false,
    );
  });
});
