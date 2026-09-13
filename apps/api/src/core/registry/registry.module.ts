import { type DynamicModule, Global, Module } from '@nestjs/common';
import type { ModuleManifest } from '@lms/module-sdk';
import { MODULE_MANIFESTS, ModuleRegistryService } from './module-registry.service.js';
import { ModuleStateService } from './module-state.service.js';

@Global()
@Module({})
export class RegistryModule {
  static forManifests(manifests: ModuleManifest[]): DynamicModule {
    return {
      module: RegistryModule,
      providers: [
        { provide: MODULE_MANIFESTS, useValue: manifests },
        ModuleRegistryService,
        ModuleStateService,
      ],
      exports: [ModuleRegistryService, ModuleStateService, MODULE_MANIFESTS],
    };
  }
}
