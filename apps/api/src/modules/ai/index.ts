/** Public surface of the AI module. */
export { AiModule } from './ai.module.js';
export { AiPolicyService } from './policy/ai-policy.service.js';
export {
  AI_PROVIDER,
  type AiProvider,
  type AiChatRequest,
  type AiChatResult,
  type AiChatDelta,
  AiUnavailableError,
} from './providers/ai-provider.js';
export { aiManifest } from './manifest.js';
