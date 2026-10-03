import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../core/config/env.js';
import { SettingsModule } from '../settings/settings.module.js';
import { TestsModule } from '../tests/index.js';
import { AiController } from './gateway/ai.controller.js';
import { AiGatewayService } from './gateway/ai-gateway.service.js';
import { AiPolicyService } from './policy/ai-policy.service.js';
import { AI_PROVIDER, type AiProvider } from './providers/ai-provider.js';
import { FakeAiProvider } from './providers/fake.provider.js';
import { NoneAiProvider } from './providers/none.provider.js';

/**
 * SI Academy AI (Roadmap Phase 7; ADR-0024 to ADR-0031). The provider is chosen by configuration,
 * as storage, email and execution drivers are: `none` by default, `fake` locally and in tests.
 */
@Module({
  imports: [SettingsModule, TestsModule],
  controllers: [AiController],
  providers: [
    NoneAiProvider,
    FakeAiProvider,
    {
      provide: AI_PROVIDER,
      inject: [APP_CONFIG, NoneAiProvider, FakeAiProvider],
      useFactory: (config: AppConfig, none: NoneAiProvider, fake: FakeAiProvider): AiProvider =>
        config.AI_PROVIDER === 'fake' ? fake : none,
    },
    AiPolicyService,
    AiGatewayService,
  ],
  exports: [AiPolicyService, AI_PROVIDER],
})
export class AiModule {}
