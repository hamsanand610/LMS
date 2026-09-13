import type { Bucket } from '../../core/storage/storage.driver.js';

export interface FileContext {
  bucket: Bucket;
  maxSize: number;
  mimes: readonly string[];
  /** Permission needed to upload into this context (`auth:self` = any signed-in user). */
  permission: string;
}

const MB = 1024 * 1024;
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

/** Upload contexts known in Phase 1. Later modules register theirs (lesson resources, resumes, …). */
export const FILE_CONTEXTS: Record<string, FileContext> = {
  'branding-logo': {
    bucket: 'public',
    maxSize: 2 * MB,
    mimes: [...IMAGE_MIMES, 'image/svg+xml'],
    permission: 'branding:manage',
  },
  'branding-favicon': {
    bucket: 'public',
    maxSize: 512 * 1024,
    mimes: ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'],
    permission: 'branding:manage',
  },
  'branding-background': {
    bucket: 'public',
    maxSize: 5 * MB,
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
    permission: 'branding:manage',
  },
  avatar: { bucket: 'public', maxSize: 2 * MB, mimes: [...IMAGE_MIMES], permission: 'auth:self' },
  /** Student documents are personal data: private bucket, staff-only upload, audited downloads. */
  'student-document': {
    bucket: 'private',
    maxSize: 10 * MB,
    mimes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
    permission: 'students:manage',
  },
  /** Course artwork is shown before anyone enrols, so it lives in the public bucket. */
  'course-thumbnail': {
    bucket: 'public',
    maxSize: 2 * MB,
    mimes: [...IMAGE_MIMES],
    permission: 'courses:manage',
  },
  /** Lesson video: private, streamed through a short-lived signed URL. */
  'lesson-video': {
    bucket: 'private',
    maxSize: 500 * MB,
    mimes: ['video/mp4', 'video/webm'],
    permission: 'courses:manage',
  },
  'lesson-resource': {
    bucket: 'private',
    maxSize: 25 * MB,
    mimes: [
      ...IMAGE_MIMES,
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    permission: 'courses:manage',
  },
  /** Class recording, uploaded by whoever ran the session. */
  'session-recording': {
    bucket: 'private',
    maxSize: 500 * MB,
    mimes: ['video/mp4', 'video/webm'],
    permission: 'sessions:run',
  },
};

export const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'application/pdf': 'pdf',
};
