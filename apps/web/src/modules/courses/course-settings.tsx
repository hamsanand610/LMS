'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type { CourseDetail, TaxonomyTerm } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';

/** Title, description and the two curated terms the catalogue filters by. */
export function CourseSettings({ courseId }: { courseId: string }) {
  const query = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => api<CourseDetail>(`/courses/${courseId}`),
  });
  if (query.isPending) return <LoadingRows rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return <SettingsForm key={query.dataUpdatedAt} courseId={courseId} course={query.data} />;
}

function SettingsForm({ courseId, course }: { courseId: string; course: CourseDetail }) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [subject, setSubject] = useState(course.subject);
  const [level, setLevel] = useState(course.level);
  const [estimatedMinutes, setEstimatedMinutes] = useState(course.estimatedMinutes);
  const queryClient = useQueryClient();

  const subjects = useQuery({
    queryKey: ['taxonomy', 'subject'],
    queryFn: () => api<TaxonomyTerm[]>('/taxonomies/subject/terms'),
  });
  const levels = useQuery({
    queryKey: ['taxonomy', 'course-level'],
    queryFn: () => api<TaxonomyTerm[]>('/taxonomies/course-level/terms'),
  });

  const save = useMutation({
    mutationFn: () =>
      api<CourseDetail>(`/courses/${courseId}`, {
        method: 'PATCH',
        body: { title, description, subject, level, estimatedMinutes },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      await queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Course updated');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The course could not be updated'),
  });

  const archive = useMutation({
    mutationFn: () => api<{ withdrawn: number }>(`/courses/${courseId}`, { method: 'DELETE' }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(
        `Archived. ${result.withdrawn} learner${result.withdrawn === 1 ? '' : 's'} who had not started lost access.`,
      );
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The course could not be archived'),
  });

  return (
    <div className="max-w-2xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="settings-title">Title</Label>
        <Input id="settings-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-description">Description</Label>
        <Textarea
          id="settings-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="settings-subject">Subject</Label>
          <select
            id="settings-subject"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            <option value="">Not set</option>
            {(subjects.data ?? []).map((term) => (
              <option key={term.key} value={term.key}>
                {term.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-level">Level</Label>
          <select
            id="settings-level"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="">Not set</option>
            {(levels.data ?? []).map((term) => (
              <option key={term.key} value={term.key}>
                {term.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-minutes">Estimated minutes</Label>
          <Input
            id="settings-minutes"
            type="number"
            min={0}
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(Number(e.target.value) || 0)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save changes'}
        </Button>
        {course.status === 'archived' ? null : (
          <Button
            variant="outline"
            disabled={archive.isPending}
            onClick={() => archive.mutate()}
            title="Withdraws the course from every learner and keeps the content"
          >
            Archive course
          </Button>
        )}
      </div>
    </div>
  );
}
