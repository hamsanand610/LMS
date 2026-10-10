'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  type Paginated,
  type SeriesPreview,
  type SessionItem,
  type SessionSeriesSummary,
  type TrainerSummary,
  WEEKDAYS,
  type Weekday,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { useCan } from '@/shell/me-context';
import { SessionRow } from './schedule-view';
import { NativeSelect } from '@/components/ui/native-select';
import { formatDateTime } from '@/lib/format';

const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

function today(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/** The timetable of one batch: the repeating classes, and what is actually scheduled. */
export function TimetableEditor({ batchId }: { batchId: string }) {
  const canManage = useCan('sessions:manage');
  const canRun = useCan('sessions:run');
  const queryClient = useQueryClient();

  const series = useQuery({
    queryKey: ['series', batchId],
    queryFn: () => api<SessionSeriesSummary[]>(`/batches/${batchId}/series`),
  });
  const sessions = useQuery({
    queryKey: ['sessions', batchId],
    queryFn: () =>
      api<Paginated<SessionItem>>(
        `/sessions?batchId=${batchId}&pageSize=20&from=${today(-1)}&to=${today(30)}`,
      ),
  });

  const end = useMutation({
    mutationFn: (seriesId: string) =>
      api<{ removed: number }>(`/series/${seriesId}`, { method: 'DELETE' }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['series', batchId] });
      await queryClient.invalidateQueries({ queryKey: ['sessions', batchId] });
      toast.success(
        `Ended. ${result.removed} future class${result.removed === 1 ? '' : 'es'} withdrawn; the ones already taught stay.`,
      );
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The series could not be ended'),
  });

  return (
    <div className="space-y-6 pt-4">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">Repeating classes</h3>
          {canManage ? <SeriesDialog batchId={batchId} /> : null}
        </div>

        {series.isPending ? <LoadingRows rows={2} /> : null}
        {series.isError ? (
          <ErrorState error={series.error} onRetry={() => series.refetch()} />
        ) : null}
        {series.data && series.data.length === 0 ? (
          <EmptyState
            title="No timetable yet"
            description="Add a repeating class and every session in the date range is created for you."
          />
        ) : null}

        {series.data && series.data.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Trainer</TableHead>
                  <TableHead className="text-right">Classes</TableHead>
                  {canManage ? <TableHead className="w-20" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {series.data.map((row) => (
                  <TableRow key={row.id} className={row.active ? undefined : 'opacity-60'}>
                    <TableCell className="font-medium">{row.subject}</TableCell>
                    <TableCell>{row.weekdays.map((d) => WEEKDAY_LABELS[d]).join(', ')}</TableCell>
                    <TableCell className="tabular-nums">
                      {row.startsTime}–{row.endsTime}
                    </TableCell>
                    <TableCell>{row.trainerName ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.sessionCount}</TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        {row.active ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={end.isPending}
                            onClick={() => end.mutate(row.id)}
                          >
                            End
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Ended</span>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h3 className="font-medium">Next classes</h3>
        {sessions.isPending ? <LoadingRows rows={3} /> : null}
        {sessions.isError ? (
          <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />
        ) : null}
        {sessions.data && sessions.data.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled in the next month.</p>
        ) : null}
        {(sessions.data?.data ?? []).map((session) => (
          <SessionRow key={session.id} session={session} canRun={canRun} />
        ))}
      </section>
    </div>
  );
}

function SeriesDialog({ batchId }: { batchId: string }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [weekdays, setWeekdays] = useState<Weekday[]>(['mon', 'wed']);
  const [startsTime, setStartsTime] = useState('09:30');
  const [endsTime, setEndsTime] = useState('11:00');
  const [fromDate, setFromDate] = useState(today());
  const [untilDate, setUntilDate] = useState(today(28));
  const [joinUrl, setJoinUrl] = useState('');
  const [preview, setPreview] = useState<SeriesPreview | null>(null);
  const queryClient = useQueryClient();

  const trainers = useQuery({
    queryKey: ['trainers', 'options'],
    queryFn: () => api<Paginated<TrainerSummary>>('/trainers?pageSize=100'),
    enabled: open,
  });

  const body = () => ({
    subject,
    trainerId: trainerId || null,
    weekdays,
    startsTime,
    endsTime,
    fromDate,
    untilDate,
    joinUrl,
    provider: joinUrl ? 'other' : 'none',
    skipDates: [],
    title: '',
  });

  const check = useMutation({
    mutationFn: () =>
      api<SeriesPreview>(`/batches/${batchId}/series/preview`, { method: 'POST', body: body() }),
    onSuccess: (result) => setPreview(result),
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'Those dates could not be worked out'),
  });

  const create = useMutation({
    mutationFn: (allowConflicts: boolean) =>
      api<SessionSeriesSummary>(`/batches/${batchId}/series`, {
        method: 'POST',
        body: { series: body(), allowConflicts },
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['series', batchId] });
      await queryClient.invalidateQueries({ queryKey: ['sessions', batchId] });
      setOpen(false);
      setPreview(null);
      toast.success(`${result.subject}: ${result.sessionCount} classes scheduled`);
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The series could not be created'),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPreview(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>Add repeating class</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a repeating class</DialogTitle>
          <DialogDescription>
            Every class in the range is created at once. Check it first and any clash is named
            before anything is written.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="series-subject">Subject</Label>
              <Input
                id="series-subject"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setPreview(null);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="series-trainer">Trainer</Label>
              <NativeSelect
                id="series-trainer"
                className="w-full"
                value={trainerId}
                onChange={(e) => {
                  setTrainerId(e.target.value);
                  setPreview(null);
                }}
              >
                <option value="">Not assigned</option>
                {(trainers.data?.data ?? []).map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {trainer.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Days</legend>
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map((day) => (
                <label key={day} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={weekdays.includes(day)}
                    aria-label={WEEKDAY_LABELS[day]}
                    onCheckedChange={(checked) => {
                      setWeekdays((current) =>
                        checked === true
                          ? [...current, day]
                          : current.filter((value) => value !== day),
                      );
                      setPreview(null);
                    }}
                  />
                  {WEEKDAY_LABELS[day]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="series-starts">Starts</Label>
              <Input
                id="series-starts"
                type="time"
                value={startsTime}
                onChange={(e) => {
                  setStartsTime(e.target.value);
                  setPreview(null);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="series-ends">Ends</Label>
              <Input
                id="series-ends"
                type="time"
                value={endsTime}
                onChange={(e) => {
                  setEndsTime(e.target.value);
                  setPreview(null);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="series-from">First date</Label>
              <Input
                id="series-from"
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPreview(null);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="series-until">Last date</Label>
              <Input
                id="series-until"
                type="date"
                value={untilDate}
                onChange={(e) => {
                  setUntilDate(e.target.value);
                  setPreview(null);
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="series-join">Join link (optional)</Label>
            <Input
              id="series-join"
              value={joinUrl}
              placeholder="https://…"
              onChange={(e) => setJoinUrl(e.target.value)}
            />
          </div>

          {preview ? (
            <div className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">
                {preview.occurrences.length} class
                {preview.occurrences.length === 1 ? '' : 'es'} would be created.
              </p>
              {preview.conflicts.length === 0 ? (
                <p className="mt-1 text-muted-foreground">Nothing clashes with them.</p>
              ) : (
                <div className="mt-2 space-y-1">
                  <p className="text-danger">
                    {preview.conflicts.length} clash
                    {preview.conflicts.length === 1 ? '' : 'es'}:
                  </p>
                  {preview.conflicts.slice(0, 4).map((conflict) => (
                    <p key={conflict.startsAt} className="text-xs text-muted-foreground">
                      {formatDateTime(conflict.startsAt)} — {conflict.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            disabled={check.isPending || !subject || weekdays.length === 0}
            onClick={() => check.mutate()}
          >
            {check.isPending ? 'Checking…' : 'Check dates'}
          </Button>
          <Button
            disabled={create.isPending || !subject || weekdays.length === 0}
            onClick={() => create.mutate((preview?.conflicts.length ?? 0) > 0)}
          >
            {create.isPending
              ? 'Creating…'
              : (preview?.conflicts.length ?? 0) > 0
                ? 'Create anyway'
                : 'Create classes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
