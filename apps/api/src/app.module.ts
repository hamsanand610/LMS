import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module.js';
import { RegistryModule } from './core/registry/registry.module.js';
import { AssignmentsModule } from './modules/assignments/index.js';
import { AttendanceModule } from './modules/attendance/index.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BatchesModule } from './modules/batches/index.js';
import { CoursesModule } from './modules/courses/index.js';
import { DoubtsModule } from './modules/doubts/index.js';
import { FeedbackModule } from './modules/feedback/index.js';
import { CertificatesModule } from './modules/certificates/index.js';
import { ExecutionModule } from './modules/execution/index.js';
import { FilesModule } from './modules/files/files.module.js';
import { GamificationModule } from './modules/gamification/index.js';
import { HealthModule } from './modules/health/health.module.js';
import { MODULE_MANIFESTS } from './modules/manifests.js';
import { NotificationsModule } from './modules/notifications/index.js';
import { PlacementModule } from './modules/placement/index.js';
import { PracticeModule } from './modules/practice/index.js';
import { ProfileModule } from './modules/profile/index.js';
import { ProgressModule } from './modules/progress/index.js';
import { QuestionsModule } from './modules/questions/index.js';
import { RbacModule } from './modules/rbac/rbac.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { SessionsModule } from './modules/sessions/index.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { TestsModule } from './modules/tests/index.js';
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
    SessionsModule,
    ProgressModule,
    CoursesModule,
    ExecutionModule,
    QuestionsModule,
    AssignmentsModule,
    TestsModule,
    PracticeModule,
    AttendanceModule,
    ProfileModule,
    GamificationModule,
    PlacementModule,
    DoubtsModule,
    CertificatesModule,
    FeedbackModule,
    ReportsModule,
    HealthModule,
  ],
})
export class AppModule {}
