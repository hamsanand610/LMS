/** Values handed from the global setup to every test file. */
declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    jwtSecret: string;
    /** Password of every seeded test account (generated per run, never stored). */
    password: string;
  }
}

export {};
