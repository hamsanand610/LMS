import { z } from 'zod';
import { emailSchema, slugSchema } from './common.js';

// ───────────────────────── content pages ─────────────────────────

/**
 * A page of the institute's own words, shown at `/pages/<slug>` (plan DP-P09, DP-A33). The demo
 * ships terms and privacy; a client adds whatever else it needs without a deploy.
 */
export const contentPageSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().max(50_000).default(''),
  isPublished: z.boolean().default(false),
});
export type ContentPageInput = z.infer<typeof contentPageSchema>;

export const contentPageUpdateSchema = contentPageSchema.partial().omit({ slug: true });

export interface ContentPageRecord {
  id: string;
  slug: string;
  title: string;
  body: string;
  isPublished: boolean;
  updatedAt: string;
}

/** What a visitor gets: only a published page, and only its words. */
export interface PublicContentPage {
  slug: string;
  title: string;
  body: string;
  updatedAt: string;
}

// ───────────────────────── email templates ─────────────────────────

export const EMAIL_TEMPLATE_KEYS = [
  'invitation',
  'password_reset',
  'password_changed',
  'notification',
] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export interface EmailTemplateDefinition {
  key: EmailTemplateKey;
  label: string;
  description: string;
  /** Names that may appear as `{{name}}` in the subject or the message. */
  variables: string[];
  defaultSubject: string;
  defaultBody: string;
}

/**
 * The emails this build sends. The platform owns the layout, the button and the footer; a client
 * owns the subject line and what the message says, which is what changes between institutes.
 */
export const EMAIL_TEMPLATES: EmailTemplateDefinition[] = [
  {
    key: 'invitation',
    label: 'Invitation',
    description: 'Sent when somebody is invited to set their password and activate their account.',
    variables: ['name', 'brandName', 'roles', 'expiresInHours'],
    defaultSubject: 'Your invitation to {{brandName}}',
    defaultBody:
      'Hello {{name}},\n\nYou have been invited to {{brandName}}{{roles}}. Set your password to activate your account.',
  },
  {
    key: 'password_reset',
    label: 'Password reset',
    description: 'Sent when somebody asks for a link to set a new password.',
    variables: ['name', 'brandName', 'expiresInMinutes'],
    defaultSubject: 'Reset your {{brandName}} password',
    defaultBody: 'Hello {{name}},\n\nUse the button below to set a new password.',
  },
  {
    key: 'password_changed',
    label: 'Password changed',
    description: 'Sent after a password change, so an unexpected one is noticed.',
    variables: ['name', 'brandName'],
    defaultSubject: 'Your {{brandName}} password was changed',
    defaultBody:
      'Hello {{name}},\n\nYour password was changed and all other sessions were signed out. If this was not you, reset your password immediately.',
  },
  {
    key: 'notification',
    label: 'Notification',
    description:
      'The wrapper around an in-app notification that the recipient also wants by email. The notification supplies its own title and body.',
    variables: ['name', 'brandName', 'title'],
    defaultSubject: '{{title}} · {{brandName}}',
    defaultBody: 'Hello {{name}},',
  },
];

export const emailTemplateUpdateSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});
export type EmailTemplateUpdateInput = z.infer<typeof emailTemplateUpdateSchema>;

export const emailTemplateTestSchema = z.object({ to: emailSchema });

export interface EmailTemplateRecord extends EmailTemplateDefinition {
  subject: string;
  body: string;
  /** False while the template is still the platform's own wording. */
  isCustomised: boolean;
  updatedAt: string | null;
}

/** Replaces `{{name}}` with what the caller supplies; an unknown name is left alone. */
export function renderTemplate(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, key: string) => {
    const value = values[key];
    return value === undefined ? whole : String(value);
  });
}

/** Names used in a template that it was not given. Used to refuse a save that would render wrong. */
export function unknownVariables(text: string, allowed: readonly string[]): string[] {
  const used = [...text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((match) => match[1] ?? '');
  return [...new Set(used.filter((name) => !allowed.includes(name)))];
}

// ───────────────────────── integrations ─────────────────────────

export const INTEGRATION_PROVIDERS = ['email', 'storage', 'video', 'execution'] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export interface IntegrationDefinition {
  provider: IntegrationProvider;
  label: string;
  description: string;
  drivers: { key: string; label: string; note: string }[];
  /** Fields that are safe to show. The secret is never among them. */
  fields: { key: string; label: string; placeholder: string }[];
  /** True when this provider takes a secret (an API key, a password). */
  hasSecret: boolean;
}

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    provider: 'email',
    label: 'Email',
    description:
      'Where email goes: an SMTP host. Local and staging installations hand it to Mailpit, which sends nothing out.',
    drivers: [
      { key: 'smtp', label: 'SMTP', note: 'Mailpit locally; any SMTP host in production.' },
      {
        key: 'resend',
        label: 'Resend',
        note: 'Not in this build; shown so the choice is visible.',
      },
    ],
    fields: [
      { key: 'host', label: 'Host', placeholder: 'localhost' },
      { key: 'port', label: 'Port', placeholder: '1025' },
      { key: 'from', label: 'From address', placeholder: 'no-reply@siacademy.example' },
    ],
    hasSecret: true,
  },
  {
    provider: 'storage',
    label: 'File storage',
    description: 'Where uploads live. S3-compatible: MinIO locally, R2 or S3 elsewhere.',
    drivers: [{ key: 's3', label: 'S3 compatible', note: 'MinIO, Cloudflare R2, AWS S3.' }],
    fields: [
      { key: 'endpoint', label: 'Endpoint', placeholder: 'http://localhost:9000' },
      { key: 'region', label: 'Region', placeholder: 'us-east-1' },
      { key: 'bucketPrivate', label: 'Private bucket', placeholder: 'lms-private' },
    ],
    hasSecret: true,
  },
  {
    provider: 'video',
    label: 'Video',
    description:
      'How lesson video is delivered. This build streams the stored file itself through a signed URL.',
    drivers: [
      { key: 'storage-file', label: 'Stored file', note: 'Played through a signed URL.' },
      { key: 'external', label: 'Hosted provider', note: 'Not in this build (plan §12.3).' },
    ],
    fields: [],
    hasSecret: false,
  },
  {
    provider: 'execution',
    label: 'Code execution',
    description:
      'Where learners’ code runs: never in the API or the browser, but in a sandbox, with hidden test cases kept on the server (ADR-0016).',
    drivers: [
      {
        key: 'runner',
        label: 'Sandbox runner',
        note: 'One locked-down container per job: Java, Python, JavaScript, PHP and SQL.',
      },
      { key: 'judge0', label: 'Judge0', note: 'Needs a Linux host; SQL is not offered there.' },
      {
        key: 'none',
        label: 'Switched off',
        note: 'Nothing runs; coding answers wait for a trainer.',
      },
    ],
    fields: [{ key: 'url', label: 'Service URL', placeholder: 'http://runner:4100' }],
    hasSecret: true,
  },
];

export const integrationUpdateSchema = z.object({
  driver: z.string().trim().min(1).max(40),
  config: z.record(z.string(), z.string().max(400)).default({}),
  /** Write-only. An empty string leaves the stored secret alone; `null` clears it. */
  secret: z.string().max(400).nullable().optional(),
});
export type IntegrationUpdateInput = z.infer<typeof integrationUpdateSchema>;

export interface IntegrationRecord extends IntegrationDefinition {
  driver: string;
  config: Record<string, string>;
  /** All the API will say about the secret. Its value is never returned. */
  hasStoredSecret: boolean;
  /** What the running build actually uses, which is the environment, not this row. */
  activeDriver: string;
  updatedAt: string | null;
}

export interface IntegrationTestResult {
  ok: boolean;
  detail: string;
}
