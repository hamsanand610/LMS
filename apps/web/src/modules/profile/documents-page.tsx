'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { DocumentType, OwnDocumentRecord } from '@lms/shared';
import { DOCUMENT_TYPES } from '@lms/shared';
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

const TYPE_LABELS: Record<DocumentType, string> = {
  photo: 'Photograph',
  id_proof: 'Identity proof',
  marksheet_10: 'Class 10 marksheet',
  marksheet_12: 'Class 12 marksheet',
  degree: 'Degree certificate',
  other: 'Something else',
};

const STATUS_TONE: Record<string, string> = {
  verified: 'bg-success-soft text-success',
  pending: 'bg-warning-soft text-warning',
  rejected: 'bg-danger-soft text-danger',
};

/**
 * The documents a learner uploads for staff to check (plan DP-S20). A rejection shows the reason,
 * because a learner who does not know what was wrong cannot put it right (AC-12.2).
 */
export function DocumentsPage() {
  const client = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<DocumentType>('id_proof');
  const [uploading, setUploading] = useState(false);

  const query = useQuery({
    queryKey: ['my-documents'],
    queryFn: () => api<OwnDocumentRecord[]>('/me/documents'),
  });

  const onFile = async (file: File) => {
    setUploading(true);
    try {
      const uploaded = await uploadFile('profile-document', file);
      const records = await api<OwnDocumentRecord[]>('/me/documents', {
        method: 'POST',
        body: { type, fileId: uploaded.id, title: file.name },
      });
      client.setQueryData(['my-documents'], records);
      if (fileInput.current) fileInput.current.value = '';
      toast.success('Uploaded. Staff will check it.');
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'Could not upload that');
    } finally {
      setUploading(false);
    }
  };

  if (query.isPending) return <LoadingRows rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <>
      <PageHeader
        title="Documents"
        description="What the institute needs to verify who you are. Staff check each one and tell you the outcome."
        actions={
          <Button variant="outline" asChild>
            <Link href="/profile">Back to your profile</Link>
          </Button>
        }
      />

      <Card className="mb-6 max-w-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Upload a document</CardTitle>
          <CardDescription>
            A PDF or a photograph, up to 10 MB. It is stored privately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="document-type">What is it?</Label>
            <select
              id="document-type"
              value={type}
              onChange={(event) => setType(event.target.value as DocumentType)}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              {DOCUMENT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {TYPE_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="document-file">File</Label>
            <Input
              id="document-file"
              ref={fileInput}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
          </div>
          {uploading ? <p className="text-sm text-muted-foreground">Uploading…</p> : null}
        </CardContent>
      </Card>

      {query.data.length === 0 ? (
        <EmptyState
          title="Nothing uploaded yet"
          description="Your documents and what staff decided about them appear here."
        />
      ) : (
        <ul className="space-y-2">
          {query.data.map((document) => (
            <li key={document.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-48 flex-1">
                  <p className="font-medium">{TYPE_LABELS[document.type] ?? document.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {document.fileName || document.title} ·{' '}
                    {new Date(document.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge className={STATUS_TONE[document.status] ?? 'bg-muted text-muted-foreground'}>
                  {document.status}
                </Badge>
              </div>
              {document.status === 'rejected' && document.reason ? (
                <p className="mt-2 rounded-md bg-danger-soft p-3 text-sm text-danger">
                  <span className="font-medium">Why it was rejected: </span>
                  {document.reason}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
