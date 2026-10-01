import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type MeResponse, SYSTEM_ROLES } from '@lms/shared';
import { SYSTEM_ROLE_DEFINITIONS } from '../src/modules/rbac/role-bundles.js';
import { createTestApp } from './setup/app.js';
import { problemCode, Session } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

/** Permission matrix for the four Phase 1 roles (architecture plan §13). One sign-in per role. */
describe('permissions and scopes', () => {
  let app: INestApplication;
  const sessions = {} as Record<'superAdmin' | 'admin' | 'trainer' | 'student', Session>;
  const password = inject('password');

  beforeAll(async () => {
    app = await createTestApp();
    for (const key of ['superAdmin', 'admin', 'trainer', 'student'] as const) {
      sessions[key] = new Session(app);
      const res = await sessions[key].login(TEST_ACCOUNTS[key].email, password);
      expect(res.status, `login as ${key}`).toBe(200);
    }
  });
  afterAll(async () => {
    await app.close();
  });

  it('sends each role to its own portal', async () => {
    const homes: Record<string, string> = {};
    for (const key of ['superAdmin', 'admin', 'trainer', 'student'] as const) {
      const me = (await sessions[key].get('/me')).body as MeResponse;
      homes[key] = me.homePortal;
      expect(me.portals).toContain(me.homePortal);
    }
    expect(homes).toEqual({
      superAdmin: 'admin',
      admin: 'admin',
      trainer: 'trainer',
      student: 'student',
    });
  });

  it.each([
    ['student', 403],
    ['trainer', 403],
    ['admin', 200],
    ['superAdmin', 200],
  ] as const)('%s listing users → %i', async (role, status) => {
    const res = await sessions[role].get('/users');
    expect(res.status).toBe(status);
    if (status === 403) expect(problemCode(res)).toBe('forbidden');
  });

  it('lets admins read roles but not change them', async () => {
    expect((await sessions.admin.get('/roles')).status).toBe(200);
    const create = await sessions.admin.post('/roles', { key: 'blocked_role', name: 'Blocked' });
    expect(create.status).toBe(403);
  });

  it('reserves branding, flags and settings changes for the permissions that grant them', async () => {
    expect((await sessions.admin.get('/settings')).status).toBe(200);
    expect(
      (await sessions.admin.patch('/settings', { general: { instituteName: 'Nope' } })).status,
    ).toBe(403);
    expect((await sessions.admin.patch('/branding', { tagline: 'Nope' })).status).toBe(403);
    expect((await sessions.admin.get('/flags')).status).toBe(403);
    expect((await sessions.student.get('/branding')).status).toBe(403);
    expect((await sessions.superAdmin.get('/flags')).status).toBe(200);
  });

  it('applies the "own" scope of audit:read for admins', async () => {
    const res = await sessions.admin.get('/audit-logs?pageSize=50');
    expect(res.status).toBe(200);
    const rows = res.body.data as { actor: { id: string } | null }[];
    expect(rows.length).toBeGreaterThan(0);
    const admin = (await sessions.admin.get('/me')).body as MeResponse;
    for (const row of rows) expect(row.actor?.id).toBe(admin.user.id);
    expect((await sessions.student.get('/audit-logs')).status).toBe(403);
  });

  it('never lets the Super Admin bundle be edited', async () => {
    const roles = (await sessions.superAdmin.get('/roles')).body as { id: string; key: string }[];
    const superAdminRole = roles.find((r) => r.key === 'super_admin')!;
    const res = await sessions.superAdmin.put(`/roles/${superAdminRole.id}/permissions`, [
      { permissionKey: 'users:read', scope: 'all' },
    ]);
    expect(res.status).toBe(422);
    expect(problemCode(res)).toBe('role_locked');
  });

  it('exposes only the permissions granted by the role bundle', async () => {
    const student = (await sessions.student.get('/me')).body as MeResponse;
    const keys = student.permissions.map((p) => p.key);
    expect(keys).toContain('auth:self');
    expect(keys).not.toContain('users:read');
    expect(keys).not.toContain('settings:manage');
    expect(student.navigation.admin).toEqual([]);
  });

  it('leaves a Super Admin’s account to Super Admins', async () => {
    const superAdmin = (await sessions.superAdmin.get('/me')).body as MeResponse;
    const id = superAdmin.user.id;
    const demote = await sessions.admin.put(`/users/${id}/roles`, { roleKeys: ['admin'] });
    expect(demote.status).toBe(403);
    const switchOff = await sessions.admin.post(`/users/${id}/deactivate`, { reason: 'test' });
    expect(switchOff.status).toBe(403);
    const rename = await sessions.admin.patch(`/users/${id}`, { name: 'Renamed' });
    expect(rename.status).toBe(403);
    // The account is untouched.
    expect(((await sessions.superAdmin.get('/me')).body as MeResponse).user.id).toBe(id);
  });

  /**
   * The matrix as the database actually holds it (plan §13.2, Phase 6 "permission testing").
   * `role-matrix.spec.ts` asserts the bundles in code; this asserts that the sync put them there,
   * which is what a caller's guard actually reads.
   */
  it('gives each role exactly the bundle the code declares', async () => {
    const cases = [
      { key: SYSTEM_ROLES.ADMIN, session: sessions.admin },
      { key: SYSTEM_ROLES.TRAINER, session: sessions.trainer },
      { key: SYSTEM_ROLES.STUDENT, session: sessions.student },
    ] as const;

    for (const { key, session } of cases) {
      const definition = SYSTEM_ROLE_DEFINITIONS[key];
      if (!definition || definition.bundle === '*') throw new Error(`No bundle for ${key}`);
      const me = (await session.get('/me')).body as MeResponse;
      const held = me.permissions
        .filter((permission) => permission.key !== 'auth:self')
        .map((permission) => `${permission.key}:${permission.scope}`)
        .sort();
      const expected = definition.bundle.map((entry) => `${entry.key}:${entry.scope}`).sort();
      expect(held, `${key} holds a different bundle than the code declares`).toEqual(expected);
    }
  });
});
