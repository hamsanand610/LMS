import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { MeResponse } from '@lms/shared';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus } from './setup/http.js';
import { collectRoutes, type RouteEntry } from './setup/routes.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

const SCOPE_ORDER = ['all', 'batch', 'own'] as const;
/** A well-formed id that names nothing: the guard decides before anything is looked up. */
const PLACEHOLDER_ID = '00000000-0000-4000-8000-000000000000';

type Role = 'student' | 'trainer' | 'admin';

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

  beforeAll(async () => {
    app = await createTestApp();
    routes = collectRoutes(app);
    for (const role of ['student', 'trainer', 'admin'] as const) {
      sessions[role] = new Session(app);
      expectStatus(await sessions[role].login(TEST_ACCOUNTS[role].email, password), 200);
      const me = expectStatus(await sessions[role].get('/me'), 200).body as MeResponse;
      granted[role] = new Map(me.permissions.map((p) => [p.key, p.scope]));
    }
  });

  afterAll(async () => {
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

  for (const role of ['student', 'trainer', 'admin'] as const) {
    it(`refuses a ${role} every route their role does not grant`, async () => {
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
    // Super Admin only: roles, settings, branding and flags, by permission (ADR-0004).
    for (const key of ['roles:manage', 'settings:manage', 'branding:manage', 'flags:manage']) {
      for (const role of ['student', 'trainer', 'admin'] as const) {
        expect(granted[role].has(key), `${role} holds ${key}`).toBe(false);
      }
    }
  });
});
