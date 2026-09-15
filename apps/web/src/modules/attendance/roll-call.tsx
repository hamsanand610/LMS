'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type {
  AttendanceMarkResult,
  AttendanceStatus,
  SessionAttendanceStudent,
  SessionAttendanceView,
} from '@lms/shared';
import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_LABELS } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/http';
import { PageHeader } from '@/shell/page-header';

/**
 * The roll call (plan DP-T06, journey J-05). Everybody starts present, so marking a full class is
 * one button; the exceptions are the only thing anybody has to touch (AC-05.1). Changing a mark
 * that has already been taken asks for a reason, because the record keeps it (AC-05.2).
 */
export function RollCall({ sessionId, backHref }: { sessionId: string; backHref: string }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['attendance', sessionId],
    queryFn: () => api<SessionAttendanceView>(`/sessions/${sessionId}/attendance`),
  });

  if (query.isPending) return <LoadingRows rows={8} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <RollCallForm
      key={query.data.markedAt ?? 'unmarked'}
      view={query.data}
      sessionId={sessionId}
      backHref={backHref}
      onSaved={() => {
        void client.invalidateQueries({ queryKey: ['attendance'] });
        void client.invalidateQueries({ queryKey: ['trainer-dashboard'] });
      }}
    />
  );
}

function RollCallForm({
  view,
  sessionId,
  backHref,
  onSaved,
}: {
  view: SessionAttendanceView;
  sessionId: string;
  backHref: string;
  onSaved: () => void;
}) {
  const isCorrection = view.markedAt !== null;
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(() =>
    Object.fromEntries(
      view.students.map((student) => [
        student.studentId,
        student.status ?? view.rules.defaultStatus,
      ]),
    ),
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(view.students.map((student) => [student.studentId, student.note])),
  );
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');

  const changed = useMemo(
    () =>
      view.students.filter(
        (student) =>
          student.status !== null &&
          (marks[student.studentId] !== student.status ||
            (notes[student.studentId] ?? '') !== student.note),
      ),
    [view.students, marks, notes],
  );
  const needsReason = changed.some((student) => marks[student.studentId] !== student.status);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return view.students;
    return view.students.filter(
      (student) =>
        student.name.toLowerCase().includes(needle) ||
        student.studentCode.toLowerCase().includes(needle),
    );
  }, [view.students, search]);

  const counts = useMemo(() => {
    const tally: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const student of view.students) {
      const status = marks[student.studentId];
      if (status) tally[status] += 1;
    }
    return tally;
  }, [view.students, marks]);

  const save = useMutation({
    mutationFn: () =>
      api<AttendanceMarkResult>(`/sessions/${sessionId}/attendance`, {
        method: 'PUT',
        body: {
          records: view.students.map((student) => ({
            studentId: student.studentId,
            status: marks[student.studentId] ?? view.rules.defaultStatus,
            note: notes[student.studentId] ?? '',
          })),
          reason,
        },
      }),
    onSuccess: (result) => {
      toast.success(
        result.corrected > 0
          ? `${result.corrected} ${result.corrected === 1 ? 'mark' : 'marks'} changed`
          : `${result.marked} students marked`,
      );
      setReason('');
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setAll = (status: AttendanceStatus) => {
    setMarks(Object.fromEntries(view.students.map((student) => [student.studentId, status])));
  };

  return (
    <>
      <PageHeader
        title={`${view.session.subject} · ${view.session.batchCode}`}
        description={`${new Date(view.session.startsAt).toLocaleString()} · ${view.session.title}`}
        actions={
          <Button variant="outline" asChild>
            <Link href={backHref}>Back</Link>
          </Button>
        }
      />

      {view.blockedReason ? (
        <Card className="mb-4 border-warning/40 bg-warning-soft">
          <CardContent className="py-4 text-sm">{view.blockedReason}</CardContent>
        </Card>
      ) : null}

      {isCorrection && view.canMark ? (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Already marked</CardTitle>
            <CardDescription>
              Taken by {view.markedByName ?? 'somebody'} on{' '}
              {new Date(view.markedAt ?? '').toLocaleString()}.{' '}
              {view.correctionWindowEndsAt
                ? `Corrections are open until ${new Date(view.correctionWindowEndsAt).toLocaleString()}.`
                : null}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find a student"
          className="max-w-xs"
          aria-label="Find a student"
        />
        {view.canMark ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setAll('present')}>
              All present
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAll('absent')}>
              All absent
            </Button>
          </>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2 text-xs text-muted-foreground">
          {ATTENDANCE_STATUSES.map((status) => (
            <span key={status} className="tabular-nums">
              {ATTENDANCE_STATUS_LABELS[status]}: {counts[status]}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2 pb-24">
        {visible.map((student) => (
          <StudentRow
            key={student.studentId}
            student={student}
            status={marks[student.studentId] ?? view.rules.defaultStatus}
            note={notes[student.studentId] ?? ''}
            disabled={!view.canMark}
            thresholdPct={view.rules.thresholdPct}
            onStatus={(status) =>
              setMarks((current) => ({ ...current, [student.studentId]: status }))
            }
            onNote={(note) => setNotes((current) => ({ ...current, [student.studentId]: note }))}
          />
        ))}
        {visible.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nobody matches “{search}”.
          </p>
        ) : null}
      </div>

      {view.canMark ? (
        <div className="sticky bottom-0 mt-6 flex flex-wrap items-end gap-3 border-t border-border bg-background py-4">
          {needsReason ? (
            <div className="min-w-64 flex-1">
              <Label htmlFor="reason">Why are you changing this?</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Kept with the record, alongside your name and the time."
                rows={2}
                required
              />
            </div>
          ) : null}
          <Button
            onClick={() => save.mutate()}
            disabled={
              save.isPending ||
              (needsReason && reason.trim().length === 0) ||
              // Nothing to save once a class has been marked and nothing has been touched since.
              (isCorrection && changed.length === 0)
            }
            className="ml-auto"
          >
            {save.isPending
              ? 'Saving…'
              : isCorrection
                ? `Save ${changed.length} ${changed.length === 1 ? 'change' : 'changes'}`
                : `Mark ${view.students.length} students`}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function StudentRow({
  student,
  status,
  note,
  disabled,
  thresholdPct,
  onStatus,
  onNote,
}: {
  student: SessionAttendanceStudent;
  status: AttendanceStatus;
  note: string;
  disabled: boolean;
  thresholdPct: number;
  onStatus: (status: AttendanceStatus) => void;
  onNote: (note: string) => void;
}) {
  const slipping = student.attendancePct !== null && student.attendancePct < thresholdPct;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">
          <p className="font-medium">{student.name}</p>
          <p className="text-xs text-muted-foreground">
            {student.studentCode}
            {student.attendancePct !== null ? (
              <>
                {' · '}
                <span className={slipping ? 'text-danger' : undefined}>
                  {student.attendancePct}% so far
                </span>
              </>
            ) : null}
          </p>
        </div>

        <fieldset
          className="flex flex-wrap gap-1"
          disabled={disabled}
          aria-label={`Attendance for ${student.name}`}
        >
          {ATTENDANCE_STATUSES.map((option) => (
            <label
              key={option}
              // The input is visually hidden, so the focus ring has to be drawn on the label:
              // a keyboard user tabbing through the roll call must see where they are.
              className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 ${
                status === option
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="radio"
                name={`status-${student.studentId}`}
                value={option}
                checked={status === option}
                onChange={() => onStatus(option)}
                className="sr-only"
              />
              {ATTENDANCE_STATUS_LABELS[option]}
            </label>
          ))}
        </fieldset>
      </div>

      {status !== 'present' || note ? (
        <Input
          value={note}
          onChange={(event) => onNote(event.target.value)}
          placeholder="Note (optional)"
          className="mt-2 h-8 text-sm"
          disabled={disabled}
          aria-label={`Note for ${student.name}`}
        />
      ) : null}

      {student.correctedAt ? (
        <p className="mt-2 text-xs text-muted-foreground">
          <Badge className="mr-2 bg-muted text-muted-foreground">Corrected</Badge>
          {student.correctedByName} on {new Date(student.correctedAt).toLocaleString()}
          {student.correctionReason ? ` — ${student.correctionReason}` : ''}
        </p>
      ) : null}
    </div>
  );
}
