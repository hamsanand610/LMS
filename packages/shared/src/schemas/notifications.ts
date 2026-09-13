import { z } from 'zod';
import { paginationQuerySchema } from './common.js';

/** Categories group notifications for preferences and filtering. */
export const NOTIFICATION_CATEGORIES = [
  'account',
  'batch',
  'announcement',
  'content',
  'assessment',
  'attendance',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CHANNELS = ['in_app', 'email'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export const notificationListQuerySchema = paginationQuerySchema.extend({
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
  unread: z.coerce.boolean().optional(),
});

export const notificationPreferenceSchema = z.object({
  category: z.enum(NOTIFICATION_CATEGORIES),
  inApp: z.boolean(),
  email: z.boolean(),
});
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;

export const notificationPreferencesUpdateSchema = z.object({
  preferences: z.array(notificationPreferenceSchema).max(NOTIFICATION_CATEGORIES.length),
});

/** Who a broadcast or announcement reaches. An empty audience means everyone. */
export const audienceSchema = z
  .object({
    roleKeys: z.array(z.string().trim().min(2).max(64)).max(10).default([]),
    batchIds: z.array(z.uuid()).max(50).default([]),
    programIds: z.array(z.uuid()).max(20).default([]),
  })
  .default({ roleKeys: [], batchIds: [], programIds: [] });
export type Audience = z.infer<typeof audienceSchema>;

export const broadcastSchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(1).max(2000),
  link: z.string().trim().max(200).default(''),
  audience: audienceSchema,
  channels: z.array(z.enum(NOTIFICATION_CHANNELS)).min(1).default(['in_app']),
});
export type BroadcastInput = z.infer<typeof broadcastSchema>;

// ───────────────────────── announcements ─────────────────────────

export const ANNOUNCEMENT_STATUSES = ['scheduled', 'active', 'expired'] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export const announcementCreateSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    body: z.string().trim().min(1).max(4000),
    audience: audienceSchema,
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime().nullable().default(null),
    channels: z.array(z.enum(NOTIFICATION_CHANNELS)).min(1).default(['in_app']),
  })
  .refine((v) => v.endsAt === null || v.endsAt > v.startsAt, {
    path: ['endsAt'],
    message: 'The end must be after the start',
  });
export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;

export const announcementUpdateSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  body: z.string().trim().min(1).max(4000).optional(),
  audience: audienceSchema.optional(),
  startsAt: z.iso.datetime().optional(),
  endsAt: z.iso.datetime().nullable().optional(),
  channels: z.array(z.enum(NOTIFICATION_CHANNELS)).min(1).optional(),
});

export const announcementListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ANNOUNCEMENT_STATUSES).optional(),
});

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  startsAt: string;
  endsAt: string | null;
  channels: NotificationChannel[];
  status: AnnouncementStatus;
  deliveredAt: string | null;
  recipientCount: number;
  createdAt: string;
}
