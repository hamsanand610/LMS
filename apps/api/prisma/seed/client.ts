// Seeds share the standalone bootstrap that lives inside src (so the CLI can be compiled with the app).
export { createStandaloneContext as createSeedContext } from '../../src/core/prisma/standalone.js';
