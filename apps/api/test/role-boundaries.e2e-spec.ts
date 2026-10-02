import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { SYSTEM_ROLES, type MeResponse } from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus } from './setup/http.js';
import { collectRoutes, type RouteEntry } from './setup/routes.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

const SCOPE_ORDER = ['all', 'batch', 'own'] as const;
/** A well-formed id that names nothing: the guard decides before anything is looked up. */
const PLACEHOLDER_ID = '00000000-0000-4000-8000-000000000000';

const ROLES = ['student', 'trainer', 'admin', 'content_manager', 'placement_coordinator'] as const;
type Role = (typeof ROLES)[number];

/**
 * Vertical privilege boundaries on every route (Phases 3 and 4). A role that does not hold a
 * route's permission, or holds it below the route's minimum scope, is refused with 403 before the
 * handler runs, whatever the request: hiding a button is never the control. The routes come from
 * the running application, so a route added later is checked without anyone remembering to.
 * Placeholder ids and an empty body are enough, because the refusal comes first.
 */
describe('role boundaries on every route', () => {
  let app: INestApplication;
  let routes: RouteEntry[];
  const sessions = {} as Record<Role, Session>;
  const granted = {} as Record<Role, Map<string, string>>;
  const password = inject('password');
  const unique = String(Date.now()).slice(-6);
  const extraEmails: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    routes = collectRoutes(app);
    const prisma = app.get(PrismaService);
    const organizationId = (await prisma.organization.findFirstOrThrow()).id;
    // The two staff roles the test seed has no account for get one here, with the bundle the
    // institute has for them (ADR-0009).
    const emails: Record<Role, string> = {
      student: TEST_ACCOUNTS.student.email,
      trainer: TEST_ACCOUNTS.trainer.email,
      admin: TEST_ACCOUNTS.admin.email,
      content_manager: `boundary-content-${unique}@test.local`,
      placement_coordinator: `boundary-placement-${unique}@test.local`,
    };
    for (const key of [SYSTEM_ROLES.CONTENT_MANAGER, SYSTEM_ROLES.PLACEMENT_COORDINATOR]) {
      const role = await prisma.role.findFirstOrThrow({ where: { organizationId, key } });
      await prisma.user.create({
        data: {
          organizationId,
          email: emails[key],
          name: `Boundary ${role.name}`,
          passwordHash: await hashPassword(password),
          status: 'active',
          emailVerifiedAt: new Date(),
          roles: { create: [{ roleId: role.id }] },
        },
      });
      extraEmails.push(emails[key]);
    }
    for (const role of ROLES) {
      sessions[role] = new Session(app);
      expectStatus(await sessions[role].login(emails[role], password), 200);
      const me = expectStatus(await sessions[role].get('/me'), 200).body as MeResponse;
      granted[role] = new Map(me.permissions.map((p) => [p.key, p.scope]));
    }
  });

  afterAll(async () => {
    await app.get(PrismaService).user.updateMany({
      where: { email: { in: extraEmails } },
      data: { status: 'deactivated', deletedAt: new Date() },
    });
    await app.close();
  });

  /** Whether the guard lets this role through: the permission, at the route's minimum scope. */
  function passes(role: Role, route: RouteEntry): boolean {
    const requirement = route.permission!;
    const scope = granted[role].get(requirement.key) as (typeof SCOPE_ORDER)[number] | undefined;
    if (!scope) return false;
    if (!requirement.minScope) return true;
    return SCOPE_ORDER.indexOf(scope) <= SCOPE_ORDER.indexOf(requirement.minScope);
  }

  function urlOf(route: RouteEntry): string {
    return route.path.replace(/:([A-Za-z]+)/g, (_, name: string) =>
      /id$/i.test(name) ? PLACEHOLDER_ID : 'placeholder',
    );
  }

  async function call(role: Role, route: RouteEntry) {
    const session = sessions[role];
    const url = urlOf(route);
    switch (route.method) {
      case 'GET':
        return session.get(url);
      case 'POST':
        return session.post(url, {});
      case 'PUT':
        return session.put(url, {});
      case 'PATCH':
        return session.patch(url, {});
      case 'DELETE':
        return session.delete(url);
      default:
        throw new Error(`Unexpected method ${route.method} on ${route.path}`);
    }
  }

  for (const role of ROLES) {
    it(`refuses a ${role.replace('_', ' ')} every route their role does not grant`, async () => {
      const guarded = routes.filter(
        (r) => !r.isPublic && r.permission && r.permission.key !== 'auth:self',
      );
      const refusedRoutes = guarded.filter((r) => !passes(role, r));
      expect(refusedRoutes.length, 'routes this role must not reach').toBeGreaterThan(0);
      const leaks: string[] = [];
      for (const route of refusedRoutes) {
        const response = await call(role, route);
        if (response.status !== 403) {
          leaks.push(
            `${route.method} ${route.path} (${route.permission!.key}) answered ${response.status}`,
          );
        }
      }
      expect(leaks, `routes that did not refuse a ${role}`).toEqual([]);
    });
  }

  it('keeps the Super Admin’s own powers from administrators and everyone below', () => {
    // Super Admin only: roles, settings, branding and flags, by permission (ADR-0004); privacy
    // operations on a learner (ADM-11).
    for (const key of [
      'roles:manage',
      'settings:manage',
      'branding:manage',
      'flags:manage',
      'privacy:manage',
    ]) {
      for (const role of ROLES) {
        expect(granted[role].has(key), `${role} holds ${key}`).toBe(false);
      }
    }
  });
});
