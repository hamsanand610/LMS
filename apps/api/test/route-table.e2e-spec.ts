import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ModuleRegistryService } from '../src/core/registry/module-registry.service.js';
import { createTestApp } from './setup/app.js';
import { collectRoutes, type RouteEntry } from './setup/routes.js';

describe('route table (operating rule 16: every endpoint declares a permission or is public)', () => {
  let app: INestApplication;
  let routes: RouteEntry[];

  beforeAll(async () => {
    app = await createTestApp();
    routes = collectRoutes(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('discovers the Phase 1 routes', () => {
    const table = routes.map((r) => `${r.method.padEnd(6)} ${r.path}`).sort();
    expect(table.length).toBeGreaterThanOrEqual(35);
    expect(table).toEqual(
      expect.arrayContaining([
        'POST   /auth/login',
        'GET    /me',
        'GET    /roles',
        'PATCH  /branding',
        'GET    /health/live',
      ]),
    );
  });

  it('marks every route as public or as requiring a permission (never both, never neither)', () => {
    const undeclared = routes
      .filter((r) => !r.isPublic && !r.permission)
      .map((r) => `${r.method} ${r.path} (${r.controller}.${r.handler})`);
    const conflicting = routes
      .filter((r) => r.isPublic && r.permission)
      .map((r) => `${r.method} ${r.path}`);
    expect(
      undeclared,
      `routes without @Public or @RequirePermission:\n${undeclared.join('\n')}`,
    ).toEqual([]);
    expect(conflicting).toEqual([]);
  });

  it('only requires permissions that exist in the module catalogue', () => {
    const catalogue = new Set(
      app
        .get(ModuleRegistryService)
        .permissions()
        .map((p) => p.key),
    );
    catalogue.add('auth:self');
    const unknown = routes
      .filter((r) => r.permission && !catalogue.has(r.permission.key))
      .map((r) => `${r.method} ${r.path} → ${r.permission!.key}`);
    expect(unknown).toEqual([]);
  });

  it('associates every feature-module controller with a module key so flags can block it', () => {
    const exempt = new Set(['HealthController', 'AdminHealthController', 'MeController']);
    const missing = routes
      .filter((r) => !r.moduleKey && !exempt.has(r.controller))
      .map((r) => r.controller);
    expect([...new Set(missing)]).toEqual([]);
  });

  it('rejects unauthenticated calls to every protected parameter-less GET route with 401', async () => {
    const targets = routes.filter(
      (r) => r.method === 'GET' && !r.isPublic && !r.path.includes(':'),
    );
    expect(targets.length).toBeGreaterThan(5);
    for (const route of targets) {
      const res = await request(app.getHttpServer() as Parameters<typeof request>[0]).get(
        `/api/v1${route.path}`,
      );
      expect(res.status, `${route.method} ${route.path}`).toBe(401);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect((res.body as { code: string }).code).toBe('unauthenticated');
    }
  });
});
