/**
 * Where the `setup` project stores the signed-in sessions the other specs reuse.
 * Kept in its own module so a spec can import the paths without importing a test file.
 */
export const ADMIN_STATE = 'e2e/.auth/admin.json';
export const TRAINER_STATE = 'e2e/.auth/trainer.json';
export const STUDENT_STATE = 'e2e/.auth/student.json';
