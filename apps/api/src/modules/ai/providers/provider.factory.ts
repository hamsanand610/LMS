import type { AppConfig } from '../../../core/config/env.js';
import type { AiProvider } from './ai-provider.js';
import { FakeAiProvider } from './fake.provider.js';
import { GeminiAiProvider } from './gemini.provider.js';
import { NoneAiProvider } from './none.provider.js';

/**
 * The one provider this process runs, chosen by `AI_PROVIDER` (ADR-0024), the way the storage,
 * email and execution drivers are. Only the chosen one is built: with Gemini configured there is no
 * fake in the process to fall back to, and the configuration refuses the fake outside local.
 */
export function createAiProvider(config: AppConfig): AiProvider {
  switch (config.AI_PROVIDER) {
    case 'gemini':
      return new GeminiAiProvider(config);
    case 'fake':
      return new FakeAiProvider(config);
    case 'none':
      return new NoneAiProvider();
  }
}
