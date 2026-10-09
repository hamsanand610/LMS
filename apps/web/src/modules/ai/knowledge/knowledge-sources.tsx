'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  type CourseSummary,
  type KnowledgeSourceView,
  type KnowledgeStatus,
  type Paginated,
  knowledgeSourceCreateSchema,
} from '@lms/shared';
import { FieldError } from '@/components/field-error';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { StatStrip } from '@/components/stat-strip';
import { StatusBadge } from '@/components/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
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
import { formatDate } from '@/lib/format';
import { AUDIENCE_LABEL, KNOWLEDGE_KEYS } from './knowledge-state';

/**
 * The knowledge base's sources, for the people who manage it (Roadmap Phase 10): where it stands,
 * every source with who may draw on it, and a new one. A source is what a set of documents is for —
 * the institute, staff, or one course — and what they hold.
 */
export function KnowledgeSources() {
  const status = useQuery({
    queryKey: KNOWLEDGE_KEYS.status,
    queryFn: () => api<KnowledgeStatus>('/ai/knowledge/status'),
  });
  const sources = useQuery({
    queryKey: KNOWLEDGE_KEYS.sources,
    queryFn: () => api<KnowledgeSourceView[]>('/ai/knowledge/sources'),
  });

  return (
    <div className="space-y-4">
      {status.data ? <KnowledgeStatusStrip status={status.data} /> : null}
      {status.data && !status.data.vector.installed ? (
        <Alert variant="destructive">
          <AlertTitle>The database cannot index knowledge yet</AlertTitle>
          <AlertDescription>
            Its vector extension is not installed, so documents can be read but not indexed. Ask the
            platform team to install it.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          SI Academy AI answers from published sources only, and only for the people each source is
          for.
        </p>
        <NewSourceDialog />
      </div>

      {sources.isPending ? <LoadingRows /> : null}
      {sources.isError ? (
        <ErrorState error={sources.error} onRetry={() => sources.refetch()} />
      ) : null}
      {sources.data && sources.data.length === 0 ? (
        <EmptyState
          title="No knowledge yet"
          description="Create a source for a course, for staff or for everyone, upload its documents, then publish it so SI Academy AI can answer from them."
        />
      ) : null}

      {sources.data && sources.data.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>For</TableHead>
                <TableHead>Holds</TableHead>
                <TableHead className="text-right">Documents</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.data.map((source) => (
                <TableRow key={source.id}>
                  <TableCell>
                    <Link
                      className="font-medium hover:underline"
                      href={`/admin/knowledge/${source.id}`}
                    >
                      {source.name}
                    </Link>
                    {source.description ? (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {source.description}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {source.audience === 'course'
                      ? (source.course?.title ?? 'A course')
                      : AUDIENCE_LABEL[source.audience]}
                  </TableCell>
                  <TableCell className="text-sm">
                    {source.dataClass === 'course' ? 'Course material' : 'Public material'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{source.documentCount}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={source.status}
                      tone={source.status === 'published' ? 'success' : undefined}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(source.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}

function KnowledgeStatusStrip({ status }: { status: KnowledgeStatus }) {
  const failed = status.versions.failed;
  const working = status.versions.pending + status.versions.processing;
  return (
    <StatStrip
      items={[
        { label: 'Published sources', value: String(status.sources.published) },
        { label: 'Drafts', value: String(status.sources.draft) },
        { label: 'Passages', value: String(status.chunks) },
        { label: 'Indexed passages', value: String(status.embeddings) },
        {
          label: 'Being read',
          value: String(working),
          tone: working > 0 ? 'warning' : 'default',
        },
        { label: 'Could not read', value: String(failed), tone: failed > 0 ? 'danger' : 'default' },
      ]}
    />
  );
}

type CreateValues = z.output<typeof knowledgeSourceCreateSchema>;

function NewSourceDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const courses = useQuery({
    queryKey: ['courses', 'knowledge-picker'],
    queryFn: () => api<Paginated<CourseSummary>>('/courses?pageSize=100'),
    enabled: open,
  });
  const form = useForm<z.input<typeof knowledgeSourceCreateSchema>, unknown, CreateValues>({
    resolver: zodResolver(knowledgeSourceCreateSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'uploaded',
      audience: 'course',
      courseId: null,
      dataClass: 'course',
    },
  });
  const audience = useWatch({ control: form.control, name: 'audience' });

  const mutation = useMutation({
    mutationFn: (values: CreateValues) =>
      api<KnowledgeSourceView>('/ai/knowledge/sources', { method: 'POST', body: values }),
    onSuccess: async (source) => {
      await queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEYS.all });
      setOpen(false);
      form.reset();
      toast.success(`${source.name} created as a draft`);
      router.push(`/admin/knowledge/${source.id}`);
    },
    onError: (error) => {
      if (isApiError(error) && error.fieldErrors) {
        for (const [path, message] of Object.entries(error.fieldErrors)) {
          form.setError(path as keyof CreateValues, { message });
        }
      }
      toast.error(isApiError(error) ? error.message : 'The source could not be created');
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="ml-auto">New source</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New knowledge source</DialogTitle>
          <DialogDescription>
            A draft: upload its documents, check them, then publish it. Who it is for is settled
            before it is published.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="knowledge-name">Name</Label>
            <Input id="knowledge-name" {...form.register('name')} />
            <FieldError message={form.formState.errors.name?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="knowledge-description">Description</Label>
            <Textarea id="knowledge-description" rows={2} {...form.register('description')} />
            <FieldError message={form.formState.errors.description?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="knowledge-audience">Who may draw on it</Label>
            <NativeSelect
              id="knowledge-audience"
              className="w-full"
              {...form.register('audience', {
                onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
                  const course = event.target.value === 'course';
                  form.setValue('dataClass', course ? 'course' : 'public');
                  if (!course) form.setValue('courseId', null);
                },
              })}
            >
              <option value="course">The learners and trainers of one course</option>
              <option value="staff">Staff only — trainers and administrators</option>
              <option value="institute">Everyone in the institute</option>
            </NativeSelect>
          </div>
          {audience === 'course' ? (
            <div className="space-y-2">
              <Label htmlFor="knowledge-course">Course</Label>
              <NativeSelect
                id="knowledge-course"
                className="w-full"
                {...form.register('courseId', { setValueAs: (value) => value || null })}
              >
                <option value="">Choose a course</option>
                {(courses.data?.data ?? []).map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                    {course.status === 'published' ? '' : ` (${course.status})`}
                  </option>
                ))}
              </NativeSelect>
              <FieldError message={form.formState.errors.courseId?.message} />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="knowledge-class">What it holds</Label>
            <NativeSelect id="knowledge-class" className="w-full" {...form.register('dataClass')}>
              <option value="course">Course material</option>
              <option value="public">Public material</option>
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              Never personal data: documents about a learner do not belong in the knowledge base.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create source'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
