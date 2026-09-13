import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { EMAIL_DRIVER, type EmailDriver } from './email.driver.js';
import { EmailService } from './email.service.js';
import { NoopEmailDriver, SmtpEmailDriver } from './smtp.driver.js';

@Global()
@Module({
  providers: [
    {
      provide: EMAIL_DRIVER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): EmailDriver =>
        config.EMAIL_DRIVER === 'none' ? new NoopEmailDriver() : new SmtpEmailDriver(config),
    },
    EmailService,
  ],
  exports: [EmailService, EMAIL_DRIVER],
})
export class EmailModule {}
