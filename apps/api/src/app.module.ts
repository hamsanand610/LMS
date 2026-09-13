import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module.js';
import { RegistryModule } from './core/registry/registry.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BatchesModule } from './modules/batches/index.js';
import { FilesModule } from './modules/files/files.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MODULE_MANIFESTS } from './modules/manifests.js';
import { NotificationsModule } from './modules/notifications/index.js';
import { RbacModule } from './modules/rbac/rbac.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { StudentsModule } from './modules/students/index.js';
import { TrainersModule } from './modules/trainers/index.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    CoreModule,
    RegistryModule.forManifests(MODULE_MANIFESTS),
    SettingsModule,
    AuthModule,
    RbacModule,
    UsersModule,
    AuditModule,
    FilesModule,
    SearchModule,
    NotificationsModule,
    StudentsModule,
    TrainersModule,
    BatchesModule,
    ReportsModule,
    HealthModule,
  ],
})
export class AppModule {}
