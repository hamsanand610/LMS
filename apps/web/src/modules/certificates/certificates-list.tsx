'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Award, Copy, Download, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  formatCertificateCode,
  type CertificateDownload,
  type CertificateRecord,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { formatDate } from '@/lib/format';

/**
 * The learner's certificates (ADR-0022). Each one is issued when a course is completed; it can be
 * downloaded as a PDF and shared through its public verification page.
 */
export function CertificatesList() {
  const query = useQuery({
    queryKey: ['certificates'],
    queryFn: () => api<CertificateRecord[]>('/me/certificates'),
  });

  if (query.isPending) return <LoadingRows rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <EmptyState
        title="No certificates yet"
        description="Finish every lesson that counts in a course and its certificate arrives here, ready to download and share."
        action={
          <Button asChild variant="outline">
            <Link href="/courses">Go to your courses</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {query.data.map((certificate) => (
        <CertificateCard key={certificate.id} certificate={certificate} />
      ))}
    </ul>
  );
}

function CertificateCard({ certificate }: { certificate: CertificateRecord }) {
  const verifyPath = `/verify/${certificate.code}`;
  const download = useMutation({
    mutationFn: () => api<CertificateDownload>(`/me/certificates/${certificate.id}/download`),
    // Opened in this tab: the file arrives as a download, so the page stays where it is.
    onSuccess: (result) => window.location.assign(result.url),
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The certificate could not be downloaded'),
  });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${verifyPath}`);
      toast.success('Verification link copied');
    } catch {
      toast.error('The link could not be copied');
    }
  };
  const revoked = certificate.status === 'revoked';

  return (
    <li className="flex flex-col rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-brand">
          <Award className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] leading-snug font-semibold text-foreground">
            {certificate.courseTitle}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Completed {formatDate(certificate.completedAt)} · issued{' '}
            {formatDate(certificate.issuedAt)}
          </p>
          <p className="mt-1 font-mono text-xs text-foreground-secondary tabular-nums">
            {formatCertificateCode(certificate.code)}
          </p>
          {revoked ? (
            <p className="mt-2 rounded-md bg-danger-soft px-2 py-1 text-xs font-medium text-danger">
              Revoked{certificate.revokedAt ? ` on ${formatDate(certificate.revokedAt)}` : ''}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!certificate.downloadable || download.isPending}
          onClick={() => download.mutate()}
        >
          {download.isPending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Download aria-hidden="true" />
          )}
          {certificate.downloadable ? 'Download PDF' : revoked ? 'Not available' : 'Preparing…'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => void copy()}>
          <Copy aria-hidden="true" />
          Copy link
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href={verifyPath} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />
            Verification page
          </Link>
        </Button>
      </div>
    </li>
  );
}
