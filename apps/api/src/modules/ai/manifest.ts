import { defineModule } from '@lms/module-sdk';
import { AI_FEATURE_FLAGS, AI_MODULE_FLAG, permissionsForModule } from '@lms/shared';

/**
 * SI Academy AI (Roadmap Phase 7; ADR-0031). Off by default, and every surface has its own flag
 * besides: none of them opens anything while `module.ai` is off. The workspace's navigation arrives
 * with the workspace (Phase 7E), gated by both flags.
 */
export const aiManifest = defineModule({
  key: 'ai',
  name: 'SI Academy AI',
  version: '0.1.0',
  core: false,
  permissions: permissionsForModule('ai'),
  navigation: [],
  flags: [
    {
      key: AI_MODULE_FLAG,
      description:
        'SI Academy AI. Off until the client approves it; no AI surface opens without it',
      default: false,
      kind: 'module',
    },
    {
      key: AI_FEATURE_FLAGS.assistant,
      description: 'The SI Academy AI assistant on eligible pages (needs SI Academy AI on)',
      default: false,
      kind: 'option',
    },
    {
      key: AI_FEATURE_FLAGS.workspace,
      description: 'The SI Academy AI workspace with conversations (needs SI Academy AI on)',
      default: false,
      kind: 'option',
    },
    {
      key: AI_FEATURE_FLAGS.lab_hints,
      description:
        'AI hints beside the Labs editor after repeated failed attempts (needs SI Academy AI on)',
      default: false,
      kind: 'option',
    },
    {
      key: AI_FEATURE_FLAGS.semantic_cache,
      description:
        'Reuse answers to general learning questions across learners (needs SI Academy AI on)',
      default: false,
      kind: 'option',
    },
  ],
  settingsSections: [],
  events: { publishes: [], subscribes: [] },
  dependsOn: ['auth', 'rbac', 'settings', 'tests', 'practice'],
});
