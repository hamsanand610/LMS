export declare function createSeedContext(): {
  config: {
    APP_ENV: 'local' | 'staging' | 'production';
    PORT: number;
    API_BASE_URL: string;
    WEB_BASE_URL: string;
    CLIENT_KEY: string;
    LOG_LEVEL: 'error' | 'trace' | 'debug' | 'info' | 'warn';
    DATABASE_URL: string;
    JWT_ACCESS_SECRET: string;
    JWT_ACCESS_TTL_SECONDS: number;
    JWT_REFRESH_TTL_DAYS: number;
    COOKIE_SECURE: boolean;
    COOKIE_DOMAIN: string;
    CORS_ORIGINS: string[];
    WORKER_MODE: 'embedded' | 'separate' | 'none';
    QUEUE_DRIVER: 'pgboss';
    STORAGE_DRIVER: 's3';
    S3_ENDPOINT: string;
    S3_REGION: string;
    S3_ACCESS_KEY: string;
    S3_SECRET_KEY: string;
    S3_BUCKET_PRIVATE: string;
    S3_BUCKET_PUBLIC: string;
    S3_FORCE_PATH_STYLE: boolean;
    S3_PUBLIC_BASE_URL: string;
    EMAIL_DRIVER: 'none' | 'smtp';
    SMTP_HOST: string;
    SMTP_PORT: number;
    SMTP_USER: string;
    SMTP_PASSWORD: string;
    SMTP_SECURE: boolean;
    EMAIL_FROM: string;
    EXECUTION_DRIVER: 'browser-sandbox' | 'judge0';
    JUDGE0_URL: string;
    JUDGE0_TOKEN: string;
    SEED_ADMIN_EMAIL: string;
    SEED_ADMIN_PASSWORD: string;
    SEED_DEMO_PASSWORD: string;
  };
  prisma: import('../../src/generated/prisma/internal/class.js').PrismaClient<
    never,
    import('../../src/generated/prisma/internal/prismaNamespace.js').GlobalOmitConfig | undefined,
    import('@prisma/client/runtime/client').DefaultArgs
  >;
};
