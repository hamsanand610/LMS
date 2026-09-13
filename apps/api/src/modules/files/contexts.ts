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
