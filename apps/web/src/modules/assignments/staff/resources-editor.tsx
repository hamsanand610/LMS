'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ExternalLink, FileText, Link2, Paperclip, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { AssignmentDetail, AssignmentResourcesInput } from '@lms/shared';
import { EmptyState } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { uploadFile } from '@/lib/files/upload';

interface ResourceDraft {
  key: string;
  /** The saved resource, when there is one; a file is opened through it. */
  id: string | null;
  title: string;
  url: string;
  fileId: string | null;
  fileName: string | null;
}

let counter = 0;
const nextKey = () => `resource-${++counter}`;

const ACCEPT = '.pdf,.zip,.png,.jpg,.jpeg,.webp,.txt,.csv,.docx,.pptx,.xlsx';

/**
 * Reading and starter material that comes with the assignment: links, and files kept in private
 * storage that a learner opens through a short-lived link.
 */
export function ResourcesEditor({ detail }: { detail: AssignmentDetail }) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ResourceDraft[]>(() =>
    detail.resources.map((resource) => ({
      key: resource.id,
      id: resource.id,
      title: resource.title,
      url: resource.url,
      fileId: resource.fileId,
      fileName: resource.fileName,
    })),
  );
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: () => {
      const body: AssignmentResourcesInput = {
        resources: items.map((item) => ({
          title: item.title.trim(),
          url: item.fileId ? '' : item.url.trim(),
          fileId: item.fileId,
        })),
      };
      return api<AssignmentDetail>(`/assignments/${detail.id}/resources`, { method: 'PUT', body });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(['assignment', detail.id], saved);
      setItems(
        saved.resources.map((resource) => ({
          key: resource.id,
          id: resource.id,
          title: resource.title,
          url: resource.url,
          fileId: resource.fileId,
          fileName: resource.fileName,
        })),
      );
      toast.success('Resources saved');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The resources could not be saved'),
  });

  const openFile = async (resourceId: string) => {
    try {
      const { url } = await api<{ url: string }>(
        `/assignments/${detail.id}/resources/${resourceId}/link`,
      );
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'The file could not be opened');
    }
  };

  const update = (key: string, change: Partial<ResourceDraft>) =>
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );

  const move = (index: number, to: number) =>
    setItems((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(to, 0, item!);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Starter files, reading and reference links. Files stay private: a learner opens one
          through a link that expires after a few minutes.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={items.length >= 20}
            onClick={() =>
              setItems((current) => [
                ...current,
                { key: nextKey(), id: null, title: '', url: '', fileId: null, fileName: null },
              ])
            }
          >
            <Link2 aria-hidden="true" />
            Add a link
          </Button>
          <Button
            variant="outline"
            disabled={uploading || items.length >= 20}
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip aria-hidden="true" />
            {uploading ? 'Uploading…' : 'Attach a file'}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              setUploading(true);
              try {
                const uploaded = await uploadFile('assignment-resource', file);
                setItems((current) => [
                  ...current,
                  {
                    key: nextKey(),
                    id: null,
                    title: file.name.replace(/\.[^.]+$/, ''),
                    url: '',
                    fileId: uploaded.id,
                    fileName: uploaded.originalName,
                  },
                ]);
              } catch (error) {
                toast.error(isApiError(error) ? error.message : 'The file could not be uploaded');
              } finally {
                setUploading(false);
              }
            }}
          />
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save resources'}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No resources"
          description="Add a link to reading or a reference, or attach a starter project for the learners to download."
        />
      ) : (
        <ol className="space-y-2">
          {items.map((item, index) => (
            <li
              key={item.key}
              className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[auto_minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-center"
            >
              <span className="hidden size-8 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground sm:flex">
                {item.fileId ? (
                  <FileText className="size-4" aria-hidden="true" />
                ) : (
                  <Link2 className="size-4" aria-hidden="true" />
                )}
              </span>
              <Input
                value={item.title}
                onChange={(e) => update(item.key, { title: e.target.value })}
                placeholder="Title"
                aria-label={`Title of resource ${index + 1}`}
                maxLength={160}
              />
              {item.fileId ? (
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="truncate text-foreground-secondary">
                    {item.fileName ?? 'Attached file'}
                  </span>
                  {item.id ? (
                    <Button variant="ghost" size="sm" onClick={() => void openFile(item.id!)}>
                      <ExternalLink aria-hidden="true" />
                      Open
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Saved with the resources</span>
                  )}
                </div>
              ) : (
                <Input
                  type="url"
                  inputMode="url"
                  value={item.url}
                  onChange={(e) => update(item.key, { url: e.target.value })}
                  placeholder="https://"
                  aria-label={`Address of resource ${index + 1}`}
                  maxLength={500}
                />
              )}
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move resource ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move resource ${index + 1} down`}
                  disabled={index === items.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove resource ${index + 1}`}
                  onClick={() => setItems((current) => current.filter((i) => i.key !== item.key))}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
