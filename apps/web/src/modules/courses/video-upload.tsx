'use client';

import { useRef, useState } from 'react';
import { VIDEO_UPLOAD_MAX_BYTES, VIDEO_UPLOAD_MIMES } from '@lms/shared';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { isApiError } from '@/lib/api/errors';
import { uploadFileWithProgress, videoDurationOf } from '@/lib/files/upload';

export interface UploadedVideo {
  fileId: string;
  name: string;
  /** Measured by the browser from the file; 0 when it could not tell. */
  durationSeconds: number;
}

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; name: string; loaded: number; total: number }
  | { phase: 'failed'; message: string; file: File | null };

const MAX_MB = Math.round(VIDEO_UPLOAD_MAX_BYTES / (1024 * 1024));

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/**
 * Uploads a video (a lesson's, a class recording) straight to storage with its progress, a cancel
 * and a retry, then hands back the registered file and its measured length. The file must be MP4 or
 * WebM and at most 2000 MB; the API checks both again, and the real type, before accepting it.
 */
export function VideoUpload({
  id,
  context,
  label,
  onUploaded,
  disabled = false,
}: {
  id: string;
  context: 'lesson-video' | 'session-recording';
  label: string;
  onUploaded: (video: UploadedVideo) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<UploadState>({ phase: 'idle' });
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);

  const start = async (file: File) => {
    if (!(VIDEO_UPLOAD_MIMES as readonly string[]).includes(file.type)) {
      setState({ phase: 'failed', message: 'Choose an MP4 or WebM video.', file: null });
      return;
    }
    if (file.size > VIDEO_UPLOAD_MAX_BYTES) {
      setState({
        phase: 'failed',
        message: `That video is ${megabytes(file.size)}; the most is ${MAX_MB} MB. Export it at a lower quality, or split it.`,
        file: null,
      });
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setState({ phase: 'uploading', name: file.name, loaded: 0, total: file.size });
    try {
      const durationSeconds = await videoDurationOf(file);
      const uploaded = await uploadFileWithProgress(context, file, {
        signal: abort.signal,
        onProgress: ({ loaded, total }) =>
          setState({ phase: 'uploading', name: file.name, loaded, total }),
      });
      setState({ phase: 'idle' });
      onUploaded({ fileId: uploaded.id, name: file.name, durationSeconds });
    } catch (error) {
      if (abort.signal.aborted) {
        setState({ phase: 'idle' });
        return;
      }
      setState({
        phase: 'failed',
        message: isApiError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : 'The upload failed. Try again.',
        file,
      });
    } finally {
      controller.current = null;
    }
  };

  const percent =
    state.phase === 'uploading' && state.total > 0
      ? Math.min(100, Math.round((state.loaded / state.total) * 100))
      : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || state.phase === 'uploading'}
          onClick={() => input.current?.click()}
        >
          {label}
        </Button>
        {state.phase === 'uploading' ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => controller.current?.abort()}
          >
            Cancel upload
          </Button>
        ) : null}
        {state.phase === 'failed' && state.file ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (state.file) void start(state.file);
            }}
          >
            Try again
          </Button>
        ) : null}
        <input
          ref={input}
          id={id}
          type="file"
          accept={VIDEO_UPLOAD_MIMES.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void start(file);
          }}
        />
      </div>
      {state.phase === 'uploading' ? (
        <div className="space-y-1">
          <Progress value={percent} aria-label={`Uploading ${state.name}`} />
          <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
            Uploading {state.name}: {percent}% ({megabytes(state.loaded)} of{' '}
            {megabytes(state.total)}). Keep this page open until it finishes.
          </p>
        </div>
      ) : state.phase === 'failed' ? (
        <p className="text-xs text-danger" role="alert">
          {state.message}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">MP4 or WebM, up to {MAX_MB} MB.</p>
      )}
    </div>
  );
}
