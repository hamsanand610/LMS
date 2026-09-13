import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { S3StorageDriver } from './s3.driver.js';
import { STORAGE_DRIVER, type StorageDriver } from './storage.driver.js';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_DRIVER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): StorageDriver => new S3StorageDriver(config),
    },
  ],
  exports: [STORAGE_DRIVER],
})
export class StorageModule {}
