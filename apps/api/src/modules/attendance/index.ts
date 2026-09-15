/** Public surface of the attendance module. */
export { AttendanceModule } from './attendance.module.js';
export { AttendanceService } from './attendance.service.js';
export { AttendanceAlertsService } from './attendance-alerts.service.js';
export { attendanceManifest } from './manifest.js';
export { attendancePercentage, countByStatus, summarise } from './attendance-math.js';
