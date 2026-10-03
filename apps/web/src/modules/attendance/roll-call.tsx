'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, History, Search, TriangleAlert } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/http';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/shell/page-header';
import { initials } from '@/shell/user-menu';

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
        back={{ href: backHref, label: 'Attendance' }}
        eyebrow={isCorrection ? 'Roll call · marked' : 'Roll call'}
        title={`${view.session.subject} · ${view.session.batchCode}`}
        description={[formatDateTime(view.session.startsAt), view.session.title]
          .filter(Boolean)
          .join(' · ')}
      />

      {view.blockedReason ? (
        <div className="mb-5 flex gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground-secondary">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <p>{view.blockedReason}</p>
        </div>
      ) : null}

      {isCorrection && view.canMark ? (
        <div className="mb-5 flex gap-3 rounded-xl border border-info/25 bg-info-soft px-4 py-3 text-sm text-foreground-secondary">
          <History className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
          <p>
            <span className="font-medium text-foreground">Already marked</span> by{' '}
            {view.markedByName ?? 'somebody'} on {formatDateTime(view.markedAt ?? '')}.{' '}
            {view.correctionWindowEndsAt
              ? `Corrections are open until ${formatDateTime(view.correctionWindowEndsAt)}.`
              : null}
          </p>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a student"
            className="pl-9"
            aria-label="Find a student"
          />
        </div>
        {view.canMark ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setAll('present')}>
              <CheckCheck aria-hidden="true" />
              All present
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAll('absent')}>
              All absent
            </Button>
          </>
        ) : null}
        <ul
          aria-label="Tally"
          className="flex w-full flex-wrap gap-1.5 text-xs sm:ml-auto sm:w-auto"
        >
          {ATTENDANCE_STATUSES.map((status) => (
            <li
              key={status}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-foreground-secondary tabular-nums"
            >
              <span aria-hidden="true" className={cn('size-2 rounded-full', STATUS_DOT[status])} />
              {ATTENDANCE_STATUS_LABELS[status]}
              <span className="font-semibold text-foreground">{counts[status]}</span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
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
          <li className="px-6 py-8 text-center text-sm text-muted-foreground">
            Nobody matches “{search}”.
          </li>
        ) : null}
      </ul>

      {view.canMark ? (
        <div className="glass sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap items-end gap-3 border-t border-(--glass-border) px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {needsReason ? (
            <div className="min-w-64 flex-1 space-y-1.5">
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
          ) : (
            <p className="text-sm text-muted-foreground">
              {isCorrection
                ? changed.length === 0
                  ? 'Change a mark to correct it; the reason is kept with the record.'
                  : 'Notes only: no reason needed.'
                : 'Everybody starts present; mark the exceptions, then save the class.'}
            </p>
          )}
          <Button
            size="lg"
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

/** Each mark's colour, always shown beside its word. */
const STATUS_DOT: Record<AttendanceStatus, string> = {
  present: 'bg-success',
  absent: 'bg-danger',
  late: 'bg-warning',
  excused: 'bg-info',
};

const STATUS_SELECTED: Record<AttendanceStatus, string> = {
  present: 'bg-success-soft text-success ring-success/40',
  absent: 'bg-danger-soft text-danger ring-danger/40',
  late: 'bg-warning-soft text-warning ring-warning/40',
  excused: 'bg-info-soft text-info ring-info/40',
};

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
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-48 flex-1 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-foreground-secondary"
          >
            {initials(student.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{student.name}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {student.studentCode}
              {student.attendancePct !== null ? (
                <>
                  {' · '}
                  <span className={slipping ? 'font-medium text-danger' : undefined}>
                    {student.attendancePct}% so far
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <fieldset
          className="grid w-full grid-cols-4 gap-1 rounded-lg border border-border bg-surface p-0.5 sm:inline-grid sm:w-auto"
          disabled={disabled}
          aria-label={`Attendance for ${student.name}`}
        >
          {ATTENDANCE_STATUSES.map((option) => (
            <label
              key={option}
              // The input is visually hidden, so the focus ring has to be drawn on the label:
              // a keyboard user tabbing through the roll call must see where they are.
              className={cn(
                'flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus',
                status === option
                  ? cn('ring-1', STATUS_SELECTED[option])
                  : 'text-foreground-secondary hover:bg-surface-2 hover:text-foreground',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="radio"
                name={`status-${student.studentId}`}
                value={option}
                checked={status === option}
                onChange={() => onStatus(option)}
                className="sr-only"
              />
              {status === option ? (
                <span
                  aria-hidden="true"
                  className={cn('size-1.5 rounded-full', STATUS_DOT[option])}
                />
              ) : null}
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
          className="mt-3 h-8 text-sm sm:ml-12 sm:w-[calc(100%-3rem)]"
          disabled={disabled}
          aria-label={`Note for ${student.name}`}
        />
      ) : null}

      {student.history.length > 0 ? (
        <Corrections history={student.history} />
      ) : student.correctedAt ? (
        <p className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:ml-12">
          <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium text-foreground-secondary">
            Note changed
          </span>
          {student.correctedByName} on {formatDateTime(student.correctedAt)}
        </p>
      ) : null}
    </li>
  );
}

type Correction = SessionAttendanceStudent['history'][number];

/**
 * Who changed a mark, when and why (AC-05.2, TRN-04): the latest change always in sight, the
 * earlier ones, oldest last, behind it.
 */
function Corrections({ history }: { history: Correction[] }) {
  const latest = history[history.length - 1]!;
  const earlier = history.slice(0, -1).reverse();
  const describe = (change: Correction) => (
    <>
      {ATTENDANCE_STATUS_LABELS[change.from]} → {ATTENDANCE_STATUS_LABELS[change.to]},{' '}
      {change.byName ?? 'someone since removed'} on {formatDateTime(change.at)}
      {change.reason ? ` — ${change.reason}` : ''}
    </>
  );
  const badge = (
    <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium text-foreground-secondary">
      {history.length === 1 ? 'Corrected' : `Corrected ${history.length} times`}
    </span>
  );
  if (earlier.length === 0) {
    return (
      <p className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:ml-12">
        {badge}
        <span>{describe(latest)}</span>
      </p>
    );
  }
  return (
    <details className="mt-2.5 text-xs text-muted-foreground sm:ml-12">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2">
        {badge}
        <span>{describe(latest)}</span>
      </summary>
      <ol className="mt-2 space-y-1 border-l border-border pl-3">
        {earlier.map((change) => (
          <li key={change.at}>{describe(change)}</li>
        ))}
      </ol>
    </details>
  );
}
