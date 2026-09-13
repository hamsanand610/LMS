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

/**
 * Three-step upload: ask the API for a presigned URL, PUT the bytes straight to storage,
 * then let the API verify the object (size, real type) and mark it ready.
 */
export async function uploadFile(context: string, file: File): Promise<UploadedFile> {
  const { fileId, upload } = await api<CreateUploadResponse>('/files/uploads', {
    body: { context, filename: file.name, mime: file.type, size: file.size },
  });
  const put = await fetch(upload.url, {
    method: upload.method,
    headers: upload.headers,
    body: file,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return api<UploadedFile>(`/files/uploads/${fileId}/complete`, { method: 'POST' });
}
