'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import {
  type CourseDetail,
  KNOWLEDGE_UPLOAD_ACCEPT,
  KNOWLEDGE_UPLOAD_MAX_BYTES,
  type KnowledgeDocumentView,
  type KnowledgeSourceDetail,
} from '@lms/shared';
import { FieldError } from '@/components/field-error';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import {
  KNOWLEDGE_KEYS,
  formatBytes,
  readKnowledgeFile,
  titleFromFileName,
} from './knowledge-state';

/** What the API's refusals of a file mean, in the page's words. */
export function knowledgeErrorMessage(error: unknown, fallback: string): string {
  if (!isApiError(error)) return fallback;
  if (error.code === 'ai_restricted_content') {
    return 'The file looks like it holds a password, key or token, so nothing was stored. Remove it and upload again.';
  }
  if (error.code === 'payload_too_large') {
    return `The file is too large to send. The largest file the knowledge base takes is ${formatBytes(KNOWLEDGE_UPLOAD_MAX_BYTES)}.`;
  }
  if (error.code === 'rate_limited') return 'Too many uploads at once. Wait a few minutes.';
  if (error.code === 'validation_failed') {
    return error.problem?.errors?.[0]?.message ?? error.message;
  }
  return error.message || fallback;
}

/** The lessons of a course source's course, by module, for a document to be about one of them. */
function useLessonOptions(source: KnowledgeSourceDetail, enabled: boolean) {
  return useQuery({
    queryKey: ['course', source.courseId],
    queryFn: () => api<CourseDetail>(`/courses/${source.courseId}`),
    enabled: enabled && source.audience === 'course' && source.courseId !== null,
  });
}

function LessonSelect({
  source,
  value,
  onChange,
  enabled,
}: {
  source: KnowledgeSourceDetail;
  value: string;
  onChange: (value: string) => void;
  enabled: boolean;
}) {
  const id = useId();
  const outline = useLessonOptions(source, enabled);
  if (source.audience !== 'course') return null;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>About</Label>
      <NativeSelect
        id={id}
        className="w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">The whole course</option>
        {(outline.data?.modules ?? []).map((module) => (
          <optgroup key={module.id} label={module.title}>
            {module.lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </optgroup>
        ))}
      </NativeSelect>
      <p className="text-xs text-muted-foreground">
        A document about one lesson is drawn on only for people who can open that lesson.
      </p>
    </div>
  );
}

function FilePicker({
  onPicked,
  error,
}: {
  onPicked: (file: File | null) => void;
  error: string | undefined;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>File</Label>
      <Input
        id={id}
        type="file"
        accept={KNOWLEDGE_UPLOAD_ACCEPT}
        onChange={(event) => onPicked(event.target.files?.[0] ?? null)}
      />
      <p className="text-xs text-muted-foreground">
        Markdown, plain text or HTML, up to {formatBytes(KNOWLEDGE_UPLOAD_MAX_BYTES)}. PDF and Word
        files are not read yet: save them as text first.
      </p>
      <FieldError message={error} />
    </div>
  );
}

/** A new document from a file: stored, then read and — once the source is published — indexed. */
export function UploadDocumentDialog({
  source,
  open,
  onOpenChange,
}: {
  source: KnowledgeSourceDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const titleId = useId();
  const [file, setFile] = useState<{ fileName: string; content: string; size: number } | null>(
    null,
  );
  const [fileError, setFileError] = useState<string>();
  const [title, setTitle] = useState('');
  const [lessonId, setLessonId] = useState('');

  const reset = () => {
    setFile(null);
    setFileError(undefined);
    setTitle('');
    setLessonId('');
  };
  const upload = useMutation({
    mutationFn: () =>
      api<KnowledgeDocumentView>(`/ai/knowledge/sources/${source.id}/uploads`, {
        method: 'POST',
        body: {
          title: title.trim(),
          fileName: file!.fileName,
          content: file!.content,
          lessonId: lessonId || null,
        },
      }),
    onSuccess: async (document) => {
      await queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEYS.all });
      toast.success(
        source.status === 'published'
          ? `${document.title} uploaded: it is being read and indexed`
          : `${document.title} uploaded: it is indexed once the source is published`,
      );
      reset();
      onOpenChange(false);
    },
    onError: (error) =>
      setFileError(knowledgeErrorMessage(error, 'The file could not be uploaded')),
  });

  async function pick(picked: File | null) {
    setFileError(undefined);
    setFile(null);
    if (!picked) return;
    const read = await readKnowledgeFile(picked);
    if (!read.ok) {
      setFileError(read.error);
      return;
    }
    setFile({ fileName: read.fileName, content: read.content, size: picked.size });
    if (!title.trim()) setTitle(titleFromFileName(read.fileName));
  }

  const titleError =
    title.trim().length > 0 && title.trim().length < 2 ? 'At least 2 characters' : undefined;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
          <DialogDescription>
            It is checked, stored privately, read into passages and — while {source.name} is
            published — indexed for SI Academy AI.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!file || title.trim().length < 2) {
              setFileError(file ? undefined : 'Choose a file to upload.');
              return;
            }
            upload.mutate();
          }}
        >
          <FilePicker onPicked={(picked) => void pick(picked)} error={fileError} />
          {file ? (
            <p className="text-xs text-muted-foreground">
              {file.fileName} · {formatBytes(file.size)} · {file.content.length.toLocaleString()}{' '}
              characters
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={titleId}>Title</Label>
            <Input
              id={titleId}
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
            />
            <FieldError message={titleError} />
          </div>
          <LessonSelect source={source} value={lessonId} onChange={setLessonId} enabled={open} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={upload.isPending || !file}>
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A new version of a document: the old one keeps answering until the new one is read. */
export function NewVersionDialog({
  document,
  onClose,
}: {
  document: KnowledgeDocumentView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<{ fileName: string; content: string } | null>(null);
  const [fileError, setFileError] = useState<string>();
  const upload = useMutation({
    mutationFn: () =>
      api<KnowledgeDocumentView>(`/ai/knowledge/documents/${document.id}/uploads`, {
        method: 'POST',
        body: { fileName: file!.fileName, content: file!.content },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEYS.all });
      toast.success(`A new version of ${document.title} is being processed`);
      onClose();
    },
    onError: (error) =>
      setFileError(knowledgeErrorMessage(error, 'The new version could not be uploaded')),
  });
  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New version of {document.title}</DialogTitle>
          <DialogDescription>
            Answers keep using the current version until the new one is read; from then on, only the
            new one is drawn on.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!file) {
              setFileError('Choose a file to upload.');
              return;
            }
            upload.mutate();
          }}
        >
          <FilePicker
            error={fileError}
            onPicked={(picked) => {
              setFile(null);
              setFileError(undefined);
              if (!picked) return;
              void readKnowledgeFile(picked).then((read) =>
                read.ok
                  ? setFile({ fileName: read.fileName, content: read.content })
                  : setFileError(read.error),
              );
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={upload.isPending || !file}>
              {upload.isPending ? 'Uploading…' : 'Upload version'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A document's title, and the lesson it is about. */
export function EditDocumentDialog({
  source,
  document,
  onClose,
}: {
  source: KnowledgeSourceDetail;
  document: KnowledgeDocumentView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const titleId = useId();
  const [title, setTitle] = useState(document.title);
  const [lessonId, setLessonId] = useState(document.lessonId ?? '');
  const [error, setError] = useState<string>();
  const save = useMutation({
    mutationFn: () =>
      api<KnowledgeDocumentView>(`/ai/knowledge/documents/${document.id}`, {
        method: 'PATCH',
        body: {
          title: title.trim(),
          ...(source.audience === 'course' ? { lessonId: lessonId || null } : {}),
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEYS.all });
      toast.success('Document saved');
      onClose();
    },
    onError: (failure) => setError(knowledgeErrorMessage(failure, 'The document was not saved')),
  });
  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {document.title}</DialogTitle>
          <DialogDescription>
            Answers cite the new title at once, and only people who can open its lesson draw on it.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim().length < 2) {
              setError('Give it a title of at least 2 characters.');
              return;
            }
            save.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={titleId}>Title</Label>
            <Input
              id={titleId}
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <LessonSelect source={source} value={lessonId} onChange={setLessonId} enabled />
          <FieldError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A yes-or-no before something that cannot be undone. */
export function ConfirmDialog({
  title,
  description,
  confirm,
  pending,
  destructive = false,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirm: string;
  pending: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? 'Working…' : confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
