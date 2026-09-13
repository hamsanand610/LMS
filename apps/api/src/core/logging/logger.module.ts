import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from '../config/env.js';

/**
 * Structured JSON logging with a request id on every line.
 * Sensitive headers are redacted; local development gets pretty output.
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.LOG_LEVEL,
          genReqId: (req) => {
            const header = req.headers['x-request-id'];
            return typeof header === 'string' && header.length <= 64 ? header : randomUUID();
          },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              'req.body.password',
              'req.body.currentPassword',
              'req.body.newPassword',
            ],
            censor: '[redacted]',
          },
          customProps: () => ({ app: 'api' }),
          autoLogging: {
            ignore: (req) => (req.url ?? '').startsWith('/health/'),
          },
          ...(config.APP_ENV === 'local'
            ? {
                transport: {
                  target: 'pino-pretty',
                  options: { colorize: true, singleLine: true, translateTime: 'HH:MM:ss' },
                },
              }
            : {}),
        },
      }),
    }),
  ],
})
export class LoggerModule {}
