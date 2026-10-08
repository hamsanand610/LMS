'use client';

import { api } from '@/lib/api/http';

export interface UploadedFile {
  id: string;
  url: string | null;
  originalName: string;
  mime: string;
  size: number;
}

interface CreateUploadResponse {
  fileId: string;
  upload: { url: string; method: 'PUT'; headers: Record<string, string>; expiresAt: string };
}

export interface UploadProgress {
  loaded: number;
  total: number;
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

function createUpload(context: string, file: File): Promise<CreateUploadResponse> {
  return api<CreateUploadResponse>('/files/uploads', {
    body: { context, filename: file.name, mime: file.type, size: file.size },
  });
}

/**
 * Three-step upload: ask the API for a presigned URL, PUT the bytes straight to storage,
 * then let the API verify the object (size, real type) and mark it ready.
 */
export async function uploadFile(context: string, file: File): Promise<UploadedFile> {
  const { fileId, upload } = await createUpload(context, file);
  const put = await fetch(upload.url, {
    method: upload.method,
    headers: upload.headers,
    body: file,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return api<UploadedFile>(`/files/uploads/${fileId}/complete`, { method: 'POST' });
}

/** One PUT through XMLHttpRequest, the browser API that reports upload progress. 0 = no answer. */
function putWithProgress(
  upload: CreateUploadResponse['upload'],
  file: File,
  options: UploadOptions,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(upload.method, upload.url);
    for (const [name, value] of Object.entries(upload.headers)) {
      // The browser sets the length itself and refuses to be told it.
      if (name.toLowerCase() !== 'content-length') request.setRequestHeader(name, value);
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        options.onProgress?.({ loaded: event.loaded, total: event.total });
    };
    request.onload = () => resolve(request.status);
    request.onerror = () => resolve(0);
    request.ontimeout = () => resolve(0);
    request.onabort = () => reject(new DOMException('The upload was cancelled', 'AbortError'));
    if (options.signal?.aborted) {
      reject(new DOMException('The upload was cancelled', 'AbortError'));
      return;
    }
    options.signal?.addEventListener('abort', () => request.abort(), { once: true });
    request.send(file);
  });
}

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('The upload was cancelled', 'AbortError'));
      },
      { once: true },
    );
  });
}

/**
 * The same three steps for large files (a lesson video, a class recording), with progress and
 * retries: a dropped connection or a storage error is sent again on the same signed link, up to
 * three tries; a refusal is not retried. Cancelling aborts the PUT. The API still checks the object
 * (size, real type) before it is marked ready.
 */
export async function uploadFileWithProgress(
  context: string,
  file: File,
  options: UploadOptions = {},
): Promise<UploadedFile> {
  const { fileId, upload } = await createUpload(context, file);
  let status = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await pause(2000 * attempt, options.signal);
    status = await putWithProgress(upload, file, options);
    if (status >= 200 && status < 300) {
      return api<UploadedFile>(`/files/uploads/${fileId}/complete`, { method: 'POST' });
    }
    if (status !== 0 && status < 500) break;
  }
  throw new Error(
    status === 0
      ? 'The upload was interrupted. Check the connection, then try again.'
      : `Storage refused the upload (${status}). Try again.`,
  );
}

/**
 * A video file's length in whole seconds, read by the browser from its metadata; 0 when it cannot
 * tell within ten seconds (an unplayable file, a codec the browser lacks).
 */
export function videoDurationOf(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;
    const done = (seconds: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      URL.revokeObjectURL(url);
      resolve(seconds);
    };
    const timer = setTimeout(() => done(0), 10_000);
    video.preload = 'metadata';
    video.onloadedmetadata = () =>
      done(Number.isFinite(video.duration) ? Math.max(0, Math.round(video.duration)) : 0);
    video.onerror = () => done(0);
    video.src = url;
  });
}
