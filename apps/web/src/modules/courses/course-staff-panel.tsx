'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type { CourseDetail, CourseStaffMember, Paginated, TrainerSummary } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
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
import { Label } from '@/components/ui/label';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';

/**
 * The trainers in charge of a course's content (ADR-0023). They change its outline and details and
 * publish it to the batches they teach; everyone else on the trainer side only reads it.
 */
export function CourseStaffPanel({ course }: { course: CourseDetail }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">Course staff</h3>
          <p className="text-sm text-muted-foreground">
            Trainers who may change this course’s lessons and details, and publish it to the batches
            they teach.
          </p>
        </div>
        <StaffDialog course={course} />
      </div>
      {course.staff.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody yet: only administrators change it.</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Course staff">
          {course.staff.map((member) => (
            <li key={member.trainerId}>
              <Badge variant="secondary">{member.name}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StaffDialog({ course }: { course: CourseDetail }) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>(course.staff.map((s) => s.trainerId));
  const queryClient = useQueryClient();
  const trainers = useQuery({
    queryKey: ['trainers', 'options'],
    queryFn: () => api<Paginated<TrainerSummary>>('/trainers?pageSize=100'),
    enabled: open,
  });

  const save = useMutation({
    mutationFn: () =>
      api<CourseStaffMember[]>(`/courses/${course.id}/staff`, {
        method: 'PUT',
        body: { trainerIds: chosen },
      }),
    onSuccess: async (staff) => {
      await queryClient.invalidateQueries({ queryKey: ['course', course.id] });
      await queryClient.invalidateQueries({ queryKey: ['courses'] });
      setOpen(false);
      toast.success(
        staff.length === 0
          ? 'Nobody is in charge of the course now'
          : `${staff.length} trainer${staff.length === 1 ? '' : 's'} in charge of the course`,
      );
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The course staff could not be saved'),
  });

  const toggle = (id: string, on: boolean) =>
    setChosen((current) => (on ? [...current, id] : current.filter((x) => x !== id)));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setChosen(course.staff.map((s) => s.trainerId));
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Change staff
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Course staff</DialogTitle>
          <DialogDescription>
            Their changes reach everyone the course is published to.
          </DialogDescription>
        </DialogHeader>
        {trainers.isPending ? <LoadingRows rows={3} /> : null}
        {trainers.isError ? (
          <ErrorState error={trainers.error} onRetry={() => trainers.refetch()} />
        ) : null}
        {trainers.data ? (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {trainers.data.data.map((trainer) => {
              const id = `staff-${trainer.id}`;
              return (
                <li key={trainer.id} className="flex items-center gap-3">
                  <Checkbox
                    id={id}
                    checked={chosen.includes(trainer.id)}
                    onCheckedChange={(value) => toggle(trainer.id, value === true)}
                  />
                  <Label htmlFor={id} className="font-normal">
                    {trainer.name}
                    <span className="ml-2 text-xs text-muted-foreground">{trainer.email}</span>
                  </Label>
                </li>
              );
            })}
          </ul>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
