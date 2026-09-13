import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig, type AppConfig } from './env.js';

/** Provides the validated environment as APP_CONFIG everywhere. */
@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig => loadConfig(),
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
