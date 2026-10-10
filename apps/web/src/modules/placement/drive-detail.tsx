'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, Clock, ExternalLink, FileText, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  APPLICATION_STATUS_LABELS,
  type DriveDetail as DriveDetailData,
  type ResumeRecord,
} from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { formatDateTime, formatRelativeDay } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { PageHeader } from '@/shell/page-header';
import { CompanyLogo } from './company-logo';
import { DriveFacts, DriveStanding } from './drives-board';

/** The eligibility a drive sets, in words; "Anyone" when it sets none. */
export function EligibilityList({ drive }: { drive: DriveDetailData }) {
  const { eligibility } = drive;
  const rules = [
    eligibility.batches.length > 0
      ? `Batches: ${eligibility.batches.map((b) => b.code).join(', ')}`
      : null,
    eligibility.programs.length > 0
      ? `Programmes: ${eligibility.programs.map((p) => p.name).join(', ')}`
      : null,
    eligibility.minAttendancePct !== null
      ? `Attendance of at least ${eligibility.minAttendancePct}%`
      : null,
  ].filter((rule): rule is string => Boolean(rule));
  return rules.length === 0 ? (
    <p className="text-sm text-muted-foreground">Open to every learner of the institute.</p>
  ) : (
    <ul className="list-disc space-y-1 pl-5 text-sm text-foreground-secondary">
      {rules.map((rule) => (
        <li key={rule}>{rule}</li>
      ))}
    </ul>
  );
}

/** One drive as a learner sees it: the role, the rules, their standing, and apply or withdraw. */
export function DriveDetail({ id }: { id: string }) {
  const now = useNow();
  const client = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const key = ['drive', id];
  const query = useQuery({ queryKey: key, queryFn: () => api<DriveDetailData>(`/drives/${id}`) });
  // Whether a resume will go with an application is said before the learner applies.
  const resumes = useQuery({
    queryKey: ['my-resumes'],
    queryFn: () => api<ResumeRecord[]>('/me/resumes'),
  });

  const refresh = (drive: DriveDetailData) => {
    client.setQueryData(key, drive);
    void client.invalidateQueries({ queryKey: ['drives'] });
    void client.invalidateQueries({ queryKey: ['placement-summary'] });
  };
  const apply = useMutation({
    mutationFn: () => api<DriveDetailData>(`/drives/${id}/apply`, { method: 'POST' }),
    onSuccess: (drive) => {
      refresh(drive);
      setConfirming(false);
      toast.success('Application sent');
    },
    onError: (error: Error) =>
      toast.error(isApiError(error) ? error.message : 'The application could not be sent'),
  });
  const withdraw = useMutation({
    mutationFn: () => api<DriveDetailData>(`/drives/${id}/withdraw`, { method: 'POST' }),
    onSuccess: (drive) => {
      refresh(drive);
      toast.success('Application withdrawn');
    },
    onError: (error: Error) => toast.error(isApiError(error) ? error.message : 'That did not work'),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const drive = query.data;
  const application =
    drive.application && drive.application.status !== 'withdrawn' ? drive.application : null;
  const decided = application?.status === 'selected' || application?.status === 'rejected';
  const closed = drive.status !== 'open' || (now !== null && Date.parse(drive.applyBy) <= now);

  return (
    <>
      <PageHeader
        back={{ href: '/placements', label: 'Placements' }}
        eyebrow={`${drive.company.name} · ${drive.code}`}
        title={drive.role}
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <DriveStanding drive={drive} />
            <DriveFacts drive={drive} />
          </div>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="order-2 space-y-6 lg:order-1">
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-[15px] font-semibold text-foreground">About the role</h2>
            <p className="mt-2 max-w-(--reading-max) text-sm leading-relaxed whitespace-pre-wrap text-foreground-secondary">
              {drive.description || 'The company has not added a description.'}
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-[15px] font-semibold text-foreground">Who can apply</h2>
            <div className="mt-2">
              <EligibilityList drive={drive} />
            </div>
          </section>
          <Link
            href={`/interview-prep/${drive.company.slug}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 text-sm transition-colors hover:bg-surface-2/60"
          >
            <CompanyLogo name={drive.company.name} logoUrl={drive.company.logoUrl} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-foreground">
                Prepare with the {drive.company.name} kit
              </span>
              <span className="block text-xs text-muted-foreground">
                Practice problems chosen for this company’s interviews.
              </span>
            </span>
          </Link>
        </div>

        <aside className="order-1 space-y-4 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:order-2">
          <p className="flex items-center gap-2 text-sm text-foreground-secondary">
            <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
            {closed ? 'Closed' : 'Closes'} {formatDateTime(drive.applyBy)}
            {!closed && now !== null ? (
              <span className="text-muted-foreground">
                ({formatRelativeDay(drive.applyBy, now)})
              </span>
            ) : null}
          </p>

          {application ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CircleCheck className="size-4 text-success" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">
                  Applied {formatDateTime(application.appliedAt)}
                </p>
              </div>
              <div className="rounded-lg bg-surface-2/70 px-3.5 py-3 text-sm">
                <p className="text-xs text-muted-foreground">Stage</p>
                <div className="mt-1">
                  <StatusBadge
                    status={application.status}
                    label={APPLICATION_STATUS_LABELS[application.status]}
                  />
                </div>
                {application.note ? (
                  <p className="mt-2 leading-relaxed whitespace-pre-wrap text-foreground-secondary">
                    {application.note}
                  </p>
                ) : null}
              </div>
              {!decided ? (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={withdraw.isPending}
                  onClick={() => withdraw.mutate()}
                >
                  {withdraw.isPending ? 'Withdrawing…' : 'Withdraw my application'}
                </Button>
              ) : null}
            </div>
          ) : drive.eligible && !closed ? (
            <div className="space-y-3">
              {resumes.data && resumes.data.length === 0 ? (
                <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                  You have no resume yet, so only your profile would go with the application. Add
                  one first if you can.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your default resume and your profile go with the application.
                </p>
              )}
              <Button className="w-full" onClick={() => setConfirming(true)}>
                <Send aria-hidden="true" />
                Apply
              </Button>
              <Link
                href="/profile/resumes"
                className="flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline"
              >
                <FileText className="size-3.5" aria-hidden="true" />
                Check your resumes first
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CircleAlert className="size-4 text-muted-foreground" aria-hidden="true" />
                {closed ? 'Applications have closed' : 'You cannot apply to this drive'}
              </p>
              {!closed && drive.ineligibleReasons.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {drive.ineligibleReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
          {drive.applyUrl && !closed && (drive.eligible || drive.application) ? (
            <div className="space-y-1.5 border-t border-border pt-4">
              <a
                href={drive.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                {drive.company.name}&apos;s official application
                <span className="sr-only"> (opens the company&apos;s site in a new tab)</span>
              </a>
              <p className="text-xs text-muted-foreground">
                The company may also ask you to apply on its own site. It opens in a new tab.
              </p>
            </div>
          ) : null}
        </aside>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Apply to {drive.company.name} for {drive.role}?
            </DialogTitle>
            <DialogDescription>
              The placement team sees your profile, your attendance and your default resume. You can
              withdraw until the company decides.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Not yet
            </Button>
            <Button disabled={apply.isPending} onClick={() => apply.mutate()}>
              {apply.isPending ? 'Sending…' : 'Send application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
