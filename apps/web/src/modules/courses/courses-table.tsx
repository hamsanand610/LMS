'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  COURSE_STATUSES,
  type CourseSummary,
  type Paginated,
  type TaxonomyTerm,
  courseCreateSchema,
} from '@lms/shared';
import { FieldError } from '@/components/field-error';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { SearchInput } from '@/components/ui/search-input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { useCan, useMe } from '@/shell/me-context';
import { NativeSelect } from '@/components/ui/native-select';

const ALL = 'all';

/** `basePath` differs per portal: admins open the builder, trainers only read the outline. */
export function CoursesTable({ basePath = '/admin/courses' }: { basePath?: string }) {
  const canManage = useCan('courses:manage');
  const trainerId = useMe().person.trainerId;
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(ALL);
  const [subject, setSubject] = useState(ALL);

  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (q) params.set('q', q);
  if (status !== ALL) params.set('status', status);
  if (subject !== ALL) params.set('subject', subject);

  const query = useQuery({
    queryKey: ['courses', params.toString()],
    queryFn: () => api<Paginated<CourseSummary>>(`/courses?${params.toString()}`),
  });
  const subjects = useQuery({
    queryKey: ['taxonomy', 'subject'],
    queryFn: () => api<TaxonomyTerm[]>('/taxonomies/subject/terms'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder="Search title or description"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          wrapperClassName="w-full max-w-xs"
          aria-label="Search courses"
        />
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any status</SelectItem>
            {COURSE_STATUSES.map((value) => (
              <SelectItem key={value} value={value} className="capitalize">
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={subject}
          onValueChange={(value) => {
            setSubject(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48" aria-label="Filter by subject">
            <SelectValue placeholder="Any subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any subject</SelectItem>
            {(subjects.data ?? []).map((term) => (
              <SelectItem key={term.key} value={term.key}>
                {term.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canManage ? <NewCourseDialog subjects={subjects.data ?? []} /> : null}
      </div>

      {query.isPending ? <LoadingRows /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && query.data.data.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description={
            canManage
              ? 'Create a course, add its modules and lessons, then publish it to a batch or a programme.'
              : 'Courses appear here once they are published to one of your batches.'
          }
        />
      ) : null}

      {query.data && query.data.data.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Level</TableHead>
                <TableHead className="text-right">Lessons</TableHead>
                <TableHead className="text-right">Published to</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((course) => (
                <TableRow key={course.id}>
                  <TableCell>
                    <Link className="font-medium hover:underline" href={`${basePath}/${course.id}`}>
                      {course.title}
                    </Link>
                    {trainerId && course.staff.some((s) => s.trainerId === trainerId) ? (
                      <Badge variant="secondary" className="ml-2">
                        You edit this
                      </Badge>
                    ) : null}
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {course.description}
                    </p>
                  </TableCell>
                  <TableCell className="capitalize">{course.subject || '—'}</TableCell>
                  <TableCell className="capitalize">{course.level || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{course.lessonCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {course.publicationCount}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {course.staff.length === 0 ? '—' : course.staff.map((s) => s.name).join(', ')}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={course.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {query.data ? (
        <PaginationBar
          page={query.data.meta.page}
          pageSize={query.data.meta.pageSize}
          total={query.data.meta.total}
          onPageChange={setPage}
          noun="courses"
        />
      ) : null}
    </div>
  );
}

type CreateValues = z.infer<typeof courseCreateSchema>;

function NewCourseDialog({ subjects }: { subjects: TaxonomyTerm[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const levels = useQuery({
    queryKey: ['taxonomy', 'course-level'],
    queryFn: () => api<TaxonomyTerm[]>('/taxonomies/course-level/terms'),
    enabled: open,
  });

  const form = useForm<z.input<typeof courseCreateSchema>, unknown, CreateValues>({
    resolver: zodResolver(courseCreateSchema),
    defaultValues: {
      title: '',
      description: '',
      level: '',
      subject: '',
      tags: [],
      thumbnailFileId: null,
      estimatedMinutes: 0,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: CreateValues) =>
      api<CourseSummary>('/courses', { method: 'POST', body: values }),
    onSuccess: async (course) => {
      await queryClient.invalidateQueries({ queryKey: ['courses'] });
      setOpen(false);
      form.reset();
      toast.success(`${course.title} created`);
      router.push(`/admin/courses/${course.id}`);
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The course could not be created'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="ml-auto">New course</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New course</DialogTitle>
          <DialogDescription>
            Give it a title now; the modules and lessons come next.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="course-title">Title</Label>
            <Input id="course-title" {...form.register('title')} />
            <FieldError message={form.formState.errors.title?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-description">Description</Label>
            <Textarea id="course-description" rows={3} {...form.register('description')} />
            <FieldError message={form.formState.errors.description?.message} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="course-subject">Subject</Label>
              <NativeSelect id="course-subject" className="w-full" {...form.register('subject')}>
                <option value="">Not set</option>
                {subjects.map((term) => (
                  <option key={term.key} value={term.key}>
                    {term.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-level">Level</Label>
              <NativeSelect id="course-level" className="w-full" {...form.register('level')}>
                <option value="">Not set</option>
                {(levels.data ?? []).map((term) => (
                  <option key={term.key} value={term.key}>
                    {term.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create course'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
