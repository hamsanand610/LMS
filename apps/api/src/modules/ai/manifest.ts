import { defineModule } from '@lms/module-sdk';
import {
  AI_FEATURE_FLAGS,
  AI_KNOWLEDGE_FLAG,
  AI_MODULE_FLAG,
  aiSettingsSchema,
  permissionsForModule,
} from '@lms/shared';

/** The workspace, in each portal's navigation: `module.ai` and `ai.workspace`, both (Phase 7E). */
const workspaceItem = {
  label: 'SI Academy AI',
  route: '/ai',
  icon: 'sparkles',
  permission: 'ai:chat',
  flag: AI_FEATURE_FLAGS.workspace,
};

/**
 * SI Academy AI (Roadmap Phase 7; ADR-0031). Off by default, and every surface has its own flag
 * besides: none of them opens anything while `module.ai` is off. Navigation (Phase 7E): the
 * workspace shows while `module.ai` and `ai.workspace` are both on — an item's own flag never
 * stands in for its module's — and the usage and settings pages with their permissions.
 */
export const aiManifest = defineModule({
  key: 'ai',
  name: 'SI Academy AI',
  version: '0.1.0',
  core: false,
  permissions: permissionsForModule('ai'),
  navigation: [
    { key: 'student.ai', portal: 'student', order: 117, group: 'Learn', ...workspaceItem },
    { key: 'trainer.ai', portal: 'trainer', order: 139, group: 'Teach', ...workspaceItem },
    { key: 'admin.ai', portal: 'admin', order: 320, group: 'Insight', ...workspaceItem },
    {
      key: 'trainer.ai_usage',
      portal: 'trainer',
      label: 'AI usage',
      route: '/trainer/ai-usage',
      icon: 'chart-column',
      order: 270,
      group: 'Insight',
      permission: 'ai:usage_read',
    },
    {
      key: 'admin.ai_usage',
      portal: 'admin',
      label: 'AI usage',
      route: '/admin/ai-usage',
      icon: 'chart-column',
      order: 315,
      group: 'Insight',
      permission: 'ai:usage_read',
      minScope: 'all',
    },
    {
      key: 'admin.settings.ai',
      portal: 'admin',
      label: 'AI settings',
      route: '/admin/settings/ai',
      icon: 'sparkles',
      order: 925,
      group: 'Settings',
      permission: 'ai:manage',
    },
  ],
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
      description: 'AI Hint beside a lab, after a failed submission (needs SI Academy AI on)',
      default: false,
      kind: 'option',
    },
    {
      key: AI_FEATURE_FLAGS.semantic_cache,
      description:
        'Reuse answers to general learning questions asked on their own: across learners when nothing in them is personal (needs SI Academy AI on)',
      default: false,
      kind: 'option',
    },
    {
      key: AI_KNOWLEDGE_FLAG,
      description:
        'The knowledge base SI Academy AI will draw on: its management (needs SI Academy AI on)',
      default: false,
      kind: 'option',
    },
  ],
  // The `ai` row of the settings table (Phase 7D): the Super Admin's, through /ai/admin/settings.
  settingsSections: [
    {
      key: 'ai',
      title: 'SI Academy AI',
      schema: aiSettingsSchema,
      permission: 'ai:manage',
    },
  ],
  events: { publishes: [], subscribes: [] },
  dependsOn: ['auth', 'rbac', 'settings', 'tests', 'practice', 'courses'],
});
