import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from '../config/env.js';

/** The request path with any one-time token in it replaced, so a log line never carries one. */
export function withoutPathSecrets(url: string | undefined): string | undefined {
  return url?.replace(/(\/invitations\/)[^/?#]+/g, '$1[redacted]');
}

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
              'req.headers["x-csrf-token"]',
              'res.headers["set-cookie"]',
              'req.body.password',
              'req.body.currentPassword',
              'req.body.newPassword',
              'req.body.token',
              'req.body.refreshToken',
            ],
            censor: '[redacted]',
          },
          // An invitation link carries its token in the path, and the path is logged.
          serializers: {
            req: (req: { url?: string }) => ({ ...req, url: withoutPathSecrets(req.url) }),
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
