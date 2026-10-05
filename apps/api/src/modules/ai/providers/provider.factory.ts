import type { AppConfig } from '../../../core/config/env.js';
import type { AiProvider } from './ai-provider.js';
import { FakeAiProvider } from './fake.provider.js';
import { GeminiAiProvider } from './gemini.provider.js';
import { GroqAiProvider } from './groq.provider.js';
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

/**
 * The provider that stands in for it, chosen by `AI_FALLBACK_PROVIDER` (ADR-0038): Groq, or none.
 * Built only when chosen, as the main one is; the router calls it for its stand-in model alone.
 */
export function createFallbackAiProvider(config: AppConfig): AiProvider | null {
  switch (config.AI_FALLBACK_PROVIDER) {
    case 'groq':
      return new GroqAiProvider(config);
    case 'none':
      return null;
  }
}
