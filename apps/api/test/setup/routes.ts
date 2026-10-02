import type { INestApplication } from '@nestjs/common';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import {
  IS_PUBLIC_KEY,
  MODULE_KEY,
  PERMISSION_KEY,
  type PermissionRequirement,
} from '../../src/core/auth/decorators.js';

const PATH_METADATA = 'path';
const METHOD_METADATA = 'method';
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD', 'SEARCH'];

export interface RouteEntry {
  controller: string;
  handler: string;
  method: string;
  path: string;
  isPublic: boolean;
  permission: PermissionRequirement | undefined;
  moduleKey: string | undefined;
}

/** Every route the running application serves, with the metadata its guards read. */
export function collectRoutes(app: INestApplication): RouteEntry[] {
  const container = app.get(ModulesContainer);
  const scanner = new MetadataScanner();
  const routes: RouteEntry[] = [];
  for (const module of container.values()) {
    for (const wrapper of module.controllers.values()) {
      const metatype = wrapper.metatype as (abstract new () => unknown) | undefined;
      if (!metatype) continue;
      const prototype = metatype.prototype as Record<string, unknown>;
      const controllerPath = String(Reflect.getMetadata(PATH_METADATA, metatype) ?? '');
      for (const name of scanner.getAllMethodNames(prototype)) {
        const handler = prototype[name];
        if (typeof handler !== 'function') continue;
        const methodIndex = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
        if (methodIndex === undefined) continue;
        const handlerPath = String(Reflect.getMetadata(PATH_METADATA, handler) ?? '');
        routes.push({
          controller: metatype.name,
          handler: name,
          method: HTTP_METHODS[methodIndex] ?? String(methodIndex),
          path: `/${[controllerPath, handlerPath].filter((p) => p && p !== '/').join('/')}`.replace(
            /\/+/g,
            '/',
          ),
          isPublic: Boolean(
            Reflect.getMetadata(IS_PUBLIC_KEY, handler) ??
            Reflect.getMetadata(IS_PUBLIC_KEY, metatype),
          ),
          permission: (Reflect.getMetadata(PERMISSION_KEY, handler) ??
            Reflect.getMetadata(PERMISSION_KEY, metatype)) as PermissionRequirement | undefined,
          moduleKey: (Reflect.getMetadata(MODULE_KEY, handler) ??
            Reflect.getMetadata(MODULE_KEY, metatype)) as string | undefined,
        });
      }
    }
  }
  return routes;
}
