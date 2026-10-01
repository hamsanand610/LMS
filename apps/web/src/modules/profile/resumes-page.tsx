'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ResumeRecord } from '@lms/shared';
import { MAX_RESUMES } from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import { uploadFile } from '@/lib/files/upload';
import { PageHeader } from '@/shell/page-header';
import { formatDate } from '@/lib/format';

/**
 * The learner's CVs (plan DP-S19, AC-12.1). PDFs only, up to the size the upload context allows,
 * at most three of them, and exactly one offered by default.
 */
export function ResumesPage() {
  const client = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);

  const query = useQuery({
    queryKey: ['my-resumes'],
    queryFn: () => api<ResumeRecord[]>('/me/resumes'),
  });

  const write = (records: ResumeRecord[]) => client.setQueryData(['my-resumes'], records);
  const fail = (error: Error) =>
    toast.error(isApiError(error) ? error.message : 'Something went wrong');

  const setDefault = useMutation({
    mutationFn: (id: string) =>
      api<ResumeRecord[]>(`/me/resumes/${id}/default`, { method: 'POST' }),
    onSuccess: (records) => {
      write(records);
      toast.success('That is the one you will be put forward with');
    },
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api<ResumeRecord[]>(`/me/resumes/${id}`, { method: 'DELETE' }),
    onSuccess: (records) => {
      write(records);
      toast.success('Resume removed');
    },
    onError: fail,
  });

  const download = useMutation({
    mutationFn: (id: string) => api<{ url: string }>(`/me/resumes/${id}/download`),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: fail,
  });

  const onFile = async (file: File) => {
    setUploading(true);
    try {
      const uploaded = await uploadFile('resume', file);
      const records = await api<ResumeRecord[]>('/me/resumes', {
        method: 'POST',
        body: { fileId: uploaded.id, title: title.trim() || file.name },
      });
      write(records);
      setTitle('');
      if (fileInput.current) fileInput.current.value = '';
      toast.success('Resume uploaded');
    } catch (error) {
      fail(error as Error);
    } finally {
      setUploading(false);
    }
  };

  if (query.isPending) return <LoadingRows rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const resumes = query.data;
  const full = resumes.length >= MAX_RESUMES;

  return (
    <>
      <PageHeader
        back={{ href: '/profile', label: 'Your profile' }}
        title="Resumes"
        description={`A PDF of up to 2 MB, and up to ${MAX_RESUMES} of them. The one marked default is the one you are put forward with.`}
      />

      <Card className="mb-6 max-w-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Upload a resume</CardTitle>
          <CardDescription>
            {full
              ? `You already have ${MAX_RESUMES}. Remove one before adding another.`
              : 'PDF only. It is stored privately and only staff can see it.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="resume-title">Name it (optional)</Label>
            <Input
              id="resume-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Java developer, March"
              disabled={full}
            />
          </div>
          <div>
            <Label htmlFor="resume-file">File</Label>
            <Input
              id="resume-file"
              ref={fileInput}
              type="file"
              accept="application/pdf"
              disabled={full || uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
          </div>
          {uploading ? <p className="text-sm text-muted-foreground">Uploading…</p> : null}
        </CardContent>
      </Card>

      {resumes.length === 0 ? (
        <EmptyState
          title="No resume yet"
          description="Upload one and it will be the one you are put forward with."
        />
      ) : (
        <ul className="space-y-2">
          {resumes.map((resume) => (
            <li
              key={resume.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4"
            >
              <div className="min-w-48 flex-1">
                <p className="font-medium">
                  {resume.title}
                  {resume.isDefault ? (
                    <Badge className="ml-2 bg-success-soft text-success">Default</Badge>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {resume.filename} · {Math.max(1, Math.round(resume.sizeBytes / 1024))} KB ·{' '}
                  {formatDate(resume.uploadedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => download.mutate(resume.id)}
                  disabled={download.isPending}
                >
                  Download
                </Button>
                {resume.isDefault ? null : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDefault.mutate(resume.id)}
                    disabled={setDefault.isPending}
                  >
                    Make default
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate(resume.id)}
                  disabled={remove.isPending}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
