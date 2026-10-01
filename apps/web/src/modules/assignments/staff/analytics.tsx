'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  QUESTION_TYPE_LABELS,
  type AssignmentAnalytics,
  type BatchSummary,
  type CourseSummary,
  type Paginated,
  type TaxonomyTerm,
} from '@lms/shared';
import { BarChartCard } from '@/components/charts';
import { OverviewBand } from '@/components/overview-band';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { StatStrip } from '@/components/stat-strip';
import { NativeSelect } from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api/http';
import { formatDateTime } from '@/lib/format';

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="min-w-0 rounded-xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Pct({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return <span className="tabular-nums">{value}%</span>;
}

/**
 * How the assignments are going, inside the caller's scope: a trainer sees their batches, an
 * administrator everything. Every figure is worked out on the server.
 */
export function AssignmentAnalyticsView({ showTrainers }: { showTrainers: boolean }) {
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [subject, setSubject] = useState('');

  const params = new URLSearchParams();
  if (courseId) params.set('courseId', courseId);
  if (batchId) params.set('batchId', batchId);
  if (subject) params.set('subject', subject);

  const query = useQuery({
    queryKey: ['assignment-analytics', params.toString()],
    queryFn: () => api<AssignmentAnalytics>(`/assignments/analytics?${params.toString()}`),
    placeholderData: keepPreviousData,
  });
  const courses = useQuery({
    queryKey: ['courses', 'options'],
    queryFn: () => api<Paginated<CourseSummary>>('/courses?pageSize=100'),
  });
  const batches = useQuery({
    queryKey: ['batches', 'options'],
    queryFn: () => api<Paginated<BatchSummary>>('/batches?pageSize=100'),
  });
  const subjects = useQuery({
    queryKey: ['taxonomy', 'subject'],
    queryFn: () => api<TaxonomyTerm[]>('/taxonomies/subject/terms'),
  });

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        aria-label="Course"
        value={courseId}
        onChange={(e) => setCourseId(e.target.value)}
        className="w-56"
      >
        <option value="">Every course</option>
        {(courses.data?.data ?? []).map((course) => (
          <option key={course.id} value={course.id}>
            {course.title}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Batch"
        value={batchId}
        onChange={(e) => setBatchId(e.target.value)}
        className="w-52"
      >
        <option value="">Every batch</option>
        {(batches.data?.data ?? []).map((batch) => (
          <option key={batch.id} value={batch.id}>
            {batch.code}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Technology"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="w-48"
      >
        <option value="">Every technology</option>
        {(subjects.data ?? []).map((term) => (
          <option key={term.key} value={term.key}>
            {term.label}
          </option>
        ))}
      </NativeSelect>
      {query.data ? (
        <span className="ml-auto text-xs text-muted-foreground">
          As of {formatDateTime(query.data.asOf)}
        </span>
      ) : null}
    </div>
  );

  if (query.isPending) {
    return (
      <div className="space-y-4">
        {filters}
        <LoadingRows rows={6} />
      </div>
    );
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const data = query.data;
  const completion =
    data.learners.reached > 0 ? (data.learners.completed / data.learners.reached) * 100 : 0;

  return (
    <div className="space-y-6">
      {filters}

      <OverviewBand
        label="Finished"
        pct={completion}
        detail={`${data.learners.completed} of ${data.learners.reached} learner assignments finished`}
        figures={[
          {
            label: 'Average score',
            value: data.averageScorePct === null ? '—' : `${data.averageScorePct}%`,
            hint:
              data.learners.completed > 0
                ? `Best attempts, across the ${data.learners.completed} finished`
                : 'Shown once someone finishes',
          },
          {
            label: 'Pass rate',
            value: data.passRatePct === null ? '—' : `${data.passRatePct}%`,
            hint: 'Finished at or above the pass mark',
          },
          {
            label: 'Waiting for review',
            value: data.submissions.awaitingReview,
            tone: data.submissions.awaitingReview > 0 ? 'warning' : 'default',
          },
        ]}
      />

      <StatStrip
        items={[
          {
            label: 'Assignments',
            value: data.totals.assignments,
            hint: `${data.totals.published} published · ${data.totals.draft} draft · ${data.totals.archived} archived`,
          },
          { label: 'Under way', value: data.learners.inProgress },
          { label: 'Not started', value: data.learners.notStarted },
          {
            label: 'Overdue',
            value: data.learners.overdue,
            tone: data.learners.overdue > 0 ? 'danger' : 'default',
          },
          {
            label: 'Submissions',
            value: data.submissions.total,
            hint: `${data.submissions.last7Days} in the last 7 days${data.submissions.evaluating ? ` · ${data.submissions.evaluating} being checked` : ''}`,
          },
        ]}
      />

      <Panel
        title="Submissions each week"
        description="Every answer submitted, by the week it came in."
      >
        <BarChartCard
          data={data.weekly}
          xKey="weekStart"
          series={[{ key: 'submissions', label: 'Submissions' }]}
          label="Submissions each week"
          emptyMessage="No submissions in this period."
        />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="By course"
          description="Finished share and average score of the assignments in each course."
        >
          {data.byCourse.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead className="text-right">Assignments</TableHead>
                    <TableHead className="w-40">Finished</TableHead>
                    <TableHead className="text-right">Average</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byCourse.map((row) => (
                    <TableRow key={row.courseId ?? 'none'}>
                      <TableCell className="font-medium">{row.title}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.assignments}</TableCell>
                      <TableCell>
                        {row.completionPct === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Progress
                              value={row.completionPct}
                              tone="success"
                              className="w-20"
                              aria-label={`${row.title}: ${row.completionPct}% finished`}
                            />
                            <span className="text-xs tabular-nums">{row.completionPct}%</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Pct value={row.averageScorePct} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>

        <Panel
          title="By topic"
          description="Share of marked answers that were right; the weakest topics first."
        >
          {data.byTopic.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead className="text-right">Questions</TableHead>
                    <TableHead className="text-right">Attempts</TableHead>
                    <TableHead className="text-right">Right</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byTopic.map((row) => (
                    <TableRow key={row.topic}>
                      <TableCell className="font-medium">{row.topic || 'No topic'}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.questions}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.attempts}</TableCell>
                      <TableCell className="text-right">
                        <Pct value={row.passRatePct} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>

        <Panel
          title="Hardest questions"
          description="Questions with at least three marked answers, lowest share right first."
        >
          {data.hardestQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough marked answers yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Attempts</TableHead>
                    <TableHead className="text-right">Right</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.hardestQuestions.map((row) => (
                    <TableRow key={row.questionId}>
                      <TableCell className="max-w-[16rem] truncate font-medium">
                        {row.title}
                      </TableCell>
                      <TableCell className="text-sm">{QUESTION_TYPE_LABELS[row.type]}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.attempts}</TableCell>
                      <TableCell className="text-right">
                        <Pct value={row.passRatePct} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>

        {showTrainers ? (
          <Panel
            title="By author"
            description="Assignments each person wrote, and the answers waiting in them."
          >
            {data.byTrainer.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Author</TableHead>
                      <TableHead className="text-right">Assignments</TableHead>
                      <TableHead className="text-right">Waiting for review</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byTrainer.map((row) => (
                      <TableRow key={row.name}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.assignments}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.awaitingReview}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
