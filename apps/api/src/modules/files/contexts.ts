import { VIDEO_UPLOAD_MAX_BYTES, VIDEO_UPLOAD_MIMES } from '@lms/shared';
import type { Bucket } from '../../core/storage/storage.driver.js';

export interface FileContext {
  bucket: Bucket;
  maxSize: number;
  mimes: readonly string[];
  /** Permission needed to upload into this context (`auth:self` = any signed-in user). */
  permission: string;
  /**
   * For personal files: the permission (at scope `all`) that anyone but the uploader needs to read
   * one through the files API, on top of `files:read`.
   */
  readPermission?: string;
}

const MB = 1024 * 1024;
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

// No SVG anywhere (Phase 6): an SVG is a document that can carry script, and the public bucket is
// served from the app's own origin, where that script would run with a visitor's session.

/** Upload contexts known in Phase 1. Later modules register theirs (lesson resources, resumes, …). */
export const FILE_CONTEXTS: Record<string, FileContext> = {
  'branding-logo': {
    bucket: 'public',
    maxSize: 2 * MB,
    mimes: [...IMAGE_MIMES],
    permission: 'branding:manage',
  },
  'branding-favicon': {
    bucket: 'public',
    maxSize: 512 * 1024,
    mimes: ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon'],
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
    readPermission: 'students:read_sensitive',
  },
  /** A company's logo on placement drives and interview-prep kits (Task 2). */
  'company-logo': {
    bucket: 'public',
    maxSize: 1 * MB,
    mimes: [...IMAGE_MIMES],
    permission: 'placements:manage',
  },
  /** Course artwork is shown before anyone enrols, so it lives in the public bucket. */
  'course-thumbnail': {
    bucket: 'public',
    maxSize: 2 * MB,
    mimes: [...IMAGE_MIMES],
    permission: 'courses:author',
  },
  /**
   * Lesson video: private, streamed through a short-lived signed URL. 2000 MB (about two hours of
   * 1080p) is one presigned PUT and fits `files.size`; larger needs multipart and a wider column.
   */
  'lesson-video': {
    bucket: 'private',
    maxSize: VIDEO_UPLOAD_MAX_BYTES,
    mimes: [...VIDEO_UPLOAD_MIMES],
    permission: 'courses:author',
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
    permission: 'courses:author',
  },
  /** A learner's CV. PDF only, and small: this is the "configured size" of plan AC-12.1. */
  resume: {
    bucket: 'private',
    maxSize: 2 * MB,
    mimes: ['application/pdf'],
    permission: 'profile:update',
    readPermission: 'students:read',
  },
  /** A document a learner uploads about themselves, for staff to verify. */
  'profile-document': {
    bucket: 'private',
    maxSize: 10 * MB,
    mimes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
    permission: 'profile:update',
    readPermission: 'students:read_sensitive',
  },
  /**
   * A file a learner hands in with a file-upload, practical or project answer. Private; the
   * learner and the staff who review the answer reach it through the submission, not by id.
   */
  'assignment-submission': {
    bucket: 'private',
    maxSize: 20 * MB,
    mimes: [
      ...IMAGE_MIMES,
      'application/pdf',
      'application/zip',
      'text/plain',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    permission: 'assignments:submit',
    readPermission: 'assignments:grade',
  },
  /** Reading or a starter kit that goes with an assignment. */
  'assignment-resource': {
    bucket: 'private',
    maxSize: 25 * MB,
    mimes: [
      ...IMAGE_MIMES,
      'application/pdf',
      'application/zip',
      'text/plain',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    permission: 'assignments:manage',
  },
  /** Class recording, uploaded by whoever ran the session; the same limit as a lesson video. */
  'session-recording': {
    bucket: 'private',
    maxSize: VIDEO_UPLOAD_MAX_BYTES,
    mimes: [...VIDEO_UPLOAD_MIMES],
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
  'application/zip': 'zip',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};
