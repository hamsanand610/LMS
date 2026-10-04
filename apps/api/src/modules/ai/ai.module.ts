import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../core/config/env.js';
import { CoursesModule } from '../courses/index.js';
import { PracticeModule } from '../practice/index.js';
import { SettingsModule } from '../settings/settings.module.js';
import { TestsModule } from '../tests/index.js';
import { AiCacheService } from './cache/cache.service.js';
import { AiSourceReach } from './cache/source-reach.js';
import { AiSubjectsService } from './context/subjects.service.js';
import { AiConversationsService } from './conversations/conversations.service.js';
import { AiController } from './gateway/ai.controller.js';
import { AiGatewayService } from './gateway/ai-gateway.service.js';
import { AiBackgroundCalls } from './jobs/background-calls.js';
import { AiBudgetAlertsService } from './jobs/budget-alerts.service.js';
import { AiRetentionService } from './jobs/retention.service.js';
import { AiSummariesService } from './jobs/summaries.service.js';
import { AiTitlesService } from './jobs/titles.service.js';
import { AiUsageRollupService } from './jobs/usage-rollup.service.js';
import { AiPolicyService } from './policy/ai-policy.service.js';
import { AI_PROVIDER, type AiProvider } from './providers/ai-provider.js';
import { createAiProvider } from './providers/provider.factory.js';
import { AiCircuitBreakers } from './routing/circuit-breaker.js';
import { AI_MODEL_REGISTRY, AI_MODELS } from './routing/model-registry.js';
import { ModelRouter } from './routing/model-router.js';
import { AiSettingsService } from './settings/ai-settings.service.js';
import { AiUsageReportService } from './usage/usage-report.service.js';
import { AiUsageService } from './usage/usage.service.js';

/**
 * SI Academy AI (Roadmap Phase 7; ADR-0024 to ADR-0032). The provider is chosen by configuration,
 * as storage, email and execution drivers are — `none` by default, `fake` locally and in tests,
 * `gemini` once configured — and only the chosen one is built. Calls reach it through the model
 * router alone (Phase 7B): the provider is not exported, so no other module can call around the
 * router's checks, circuits and records. Conversations, usage and quotas are Phase 7C's; the
 * institute's AI settings, the background jobs and the answer cache Phase 7D's; the course, lesson
 * and lab material a conversation brings, checked by the modules that own it, Phase 7E's.
 */
@Module({
  imports: [SettingsModule, TestsModule, PracticeModule, CoursesModule],
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
    AiSettingsService,
    AiPolicyService,
    AiUsageService,
    AiUsageReportService,
    AiSubjectsService,
    AiConversationsService,
    AiSourceReach,
    AiCacheService,
    AiBackgroundCalls,
    AiTitlesService,
    AiSummariesService,
    AiRetentionService,
    AiUsageRollupService,
    AiBudgetAlertsService,
    AiGatewayService,
  ],
  exports: [AiPolicyService],
})
export class AiModule {}
