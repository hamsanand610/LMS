import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../core/config/env.js';
import { SettingsModule } from '../settings/settings.module.js';
import { TestsModule } from '../tests/index.js';
import { AiController } from './gateway/ai.controller.js';
import { AiGatewayService } from './gateway/ai-gateway.service.js';
import { AiPolicyService } from './policy/ai-policy.service.js';
import { AI_PROVIDER, type AiProvider } from './providers/ai-provider.js';
import { createAiProvider } from './providers/provider.factory.js';
import { AiCircuitBreakers } from './routing/circuit-breaker.js';
import { AI_MODEL_REGISTRY, AI_MODELS } from './routing/model-registry.js';
import { ModelRouter } from './routing/model-router.js';

/**
 * SI Academy AI (Roadmap Phase 7; ADR-0024 to ADR-0031). The provider is chosen by configuration,
 * as storage, email and execution drivers are — `none` by default, `fake` locally and in tests,
 * `gemini` once configured — and only the chosen one is built. Calls reach it through the model
 * router alone (Phase 7B): the provider is not exported, so no other module can call around the
 * router's checks, circuits and records.
 */
@Module({
  imports: [SettingsModule, TestsModule],
  controllers: [AiController],
  providers: [
    {
      provide: AI_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): AiProvider => createAiProvider(config),
    },
    { provide: AI_MODELS, useValue: AI_MODEL_REGISTRY },
    { provide: AiCircuitBreakers, useFactory: () => new AiCircuitBreakers() },
    ModelRouter,
    AiPolicyService,
    AiGatewayService,
  ],
  exports: [AiPolicyService],
})
export class AiModule {}
