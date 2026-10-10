'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  ASSIGNMENT_KIND_LABELS,
  ASSIGNMENT_KINDS,
  type AssignmentDetail,
  type AssignmentKind,
  type AssignmentSettings,
  type AssignmentUpdateInput,
  type CourseSummary,
  type DuePolicy,
  type ExplanationPolicy,
  type GradingMethod,
  type Paginated,
  type ProgramSummary,
  type TaxonomyTerm,
} from '@lms/shared';
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
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';

const EXPLANATION_LABELS: Record<ExplanationPolicy, string> = {
  after_solve: 'Once they solve it or run out of attempts',
  after_due: 'After the due date',
  never: 'Never',
};

const DUE_LABELS: Record<DuePolicy, string> = {
  allow_late: 'Accept it, marked as late',
  block_late: 'Refuse it',
};

const GRADING_LABELS: Record<GradingMethod, string> = {
  best: 'Their best attempt',
  latest: 'Their latest attempt',
};

function Field({
  id,
  label,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `space-y-1.5 ${className}` : 'space-y-1.5'}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A list of choices that did not arrive, said under the field with a retry. */
function OptionsProblem({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <p className="text-xs text-muted-foreground" role="alert">
      The {what} could not be loaded.{' '}
      <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={onRetry}>
        Try again
      </Button>
    </p>
  );
}

/**
 * What the assignment is and the rules it runs by. Every field is sent on save; the server checks
 * the course and programme exist and that the caller may change this assignment.
 */
export function DetailsForm({
  detail,
  listHref,
  onSaved,
}: {
  detail: AssignmentDetail;
  listHref: string;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [title, setTitle] = useState(detail.title);
  const [description, setDescription] = useState(detail.description);
  const [instructions, setInstructions] = useState(detail.instructions);
  const [kind, setKind] = useState<AssignmentKind>(detail.kind);
  const [subject, setSubject] = useState(detail.subject);
  const [difficulty, setDifficulty] = useState(detail.difficulty);
  const [courseId, setCourseId] = useState(detail.courseId ?? '');
  const [programId, setProgramId] = useState(detail.programId ?? '');
  const [estimatedMinutes, setEstimatedMinutes] = useState(String(detail.estimatedMinutes));
  const [passPercent, setPassPercent] = useState(String(detail.passPercent));
  const [settings, setSettings] = useState<AssignmentSettings>(detail.settings);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const subjects = useQuery({
    queryKey: ['taxonomy', 'subject'],
    queryFn: () => api<TaxonomyTerm[]>('/taxonomies/subject/terms'),
  });
  const levels = useQuery({
    queryKey: ['taxonomy', 'course-level'],
    queryFn: () => api<TaxonomyTerm[]>('/taxonomies/course-level/terms'),
  });
  const courses = useQuery({
    queryKey: ['courses', 'options'],
    queryFn: () => api<Paginated<CourseSummary>>('/courses?pageSize=100'),
  });
  const programs = useQuery({
    queryKey: ['programs', 'options'],
    queryFn: () => api<Paginated<ProgramSummary>>('/programs?pageSize=100'),
    // Trainers may not list programmes; the field is then simply not offered.
    retry: false,
  });

  const save = useMutation({
    mutationFn: () => {
      const body: AssignmentUpdateInput = {
        title,
        description,
        instructions,
        kind,
        subject,
        difficulty,
        courseId: courseId || null,
        programId: programId || null,
        estimatedMinutes: Number(estimatedMinutes) || 0,
        passPercent: Math.min(100, Math.max(0, Number(passPercent) || 0)),
        settings,
      };
      return api<AssignmentDetail>(`/assignments/${detail.id}`, { method: 'PATCH', body });
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(['assignment', detail.id], saved);
      await queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Details saved');
      onSaved();
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The details could not be saved'),
  });

  const archive = useMutation({
    mutationFn: () => api<{ withdrawn: number }>(`/assignments/${detail.id}`, { method: 'DELETE' }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success(
        result.withdrawn > 0
          ? `Archived and taken back from ${result.withdrawn} ${result.withdrawn === 1 ? 'audience' : 'audiences'}. Answers already given are kept.`
          : 'Archived. Answers already given are kept.',
      );
      router.push(listHref);
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'It could not be archived'),
  });

  const setSetting = <K extends keyof AssignmentSettings>(key: K, value: AssignmentSettings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  const activeTerms = (terms: TaxonomyTerm[] | undefined, current: string) =>
    (terms ?? []).filter((term) => !term.archived || term.key === current);

  return (
    <form
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="space-y-6">
        <section
          aria-labelledby="details-what"
          className="space-y-4 rounded-xl border border-border bg-card p-5"
        >
          <h2 id="details-what" className="text-base font-semibold">
            What it is
          </h2>
          <Field id="assignment-title" label="Title">
            <Input
              id="assignment-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={160}
            />
          </Field>
          <Field
            id="assignment-description"
            label="Summary"
            hint="One or two sentences; the learner's list shows it."
          >
            <Textarea
              id="assignment-description"
              rows={2}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-describedby="assignment-description-hint"
            />
          </Field>
          <Field
            id="assignment-instructions"
            label="Instructions"
            hint="What the learner reads before starting: the rules, what finished looks like, how it is marked. Put code between ``` lines."
          >
            <Textarea
              id="assignment-instructions"
              rows={8}
              maxLength={20000}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              aria-describedby="assignment-instructions-hint"
              className="font-mono text-[13px]"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="assignment-kind-edit" label="Type">
              <NativeSelect
                id="assignment-kind-edit"
                className="w-full"
                value={kind}
                onChange={(e) => setKind(e.target.value as AssignmentKind)}
              >
                {ASSIGNMENT_KINDS.map((value) => (
                  <option key={value} value={value}>
                    {ASSIGNMENT_KIND_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="assignment-technology" label="Technology">
              <NativeSelect
                id="assignment-technology"
                className="w-full"
                value={subject}
                disabled={subjects.isPending}
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value="">{subjects.isPending ? 'Loading…' : 'Not set'}</option>
                {activeTerms(subjects.data, subject).map((term) => (
                  <option key={term.key} value={term.key}>
                    {term.label}
                  </option>
                ))}
              </NativeSelect>
              {subjects.isError ? (
                <OptionsProblem what="technologies" onRetry={() => void subjects.refetch()} />
              ) : null}
            </Field>
            <Field id="assignment-level" label="Level">
              <NativeSelect
                id="assignment-level"
                className="w-full"
                value={difficulty}
                disabled={levels.isPending}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="">{levels.isPending ? 'Loading…' : 'Not set'}</option>
                {activeTerms(levels.data, difficulty).map((term) => (
                  <option key={term.key} value={term.key}>
                    {term.label}
                  </option>
                ))}
              </NativeSelect>
              {levels.isError ? (
                <OptionsProblem what="levels" onRetry={() => void levels.refetch()} />
              ) : null}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="assignment-course"
              label="Course"
              hint="Learners can filter by it; modules can point at its modules."
            >
              <NativeSelect
                id="assignment-course"
                className="w-full"
                value={courseId}
                disabled={courses.isPending}
                onChange={(e) => setCourseId(e.target.value)}
                aria-describedby="assignment-course-hint"
              >
                <option value="">{courses.isPending ? 'Loading…' : 'No course'}</option>
                {(courses.data?.data ?? []).map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </NativeSelect>
              {courses.isError ? (
                <OptionsProblem what="courses" onRetry={() => void courses.refetch()} />
              ) : null}
            </Field>
            {programs.data ? (
              <Field id="assignment-programme" label="Programme">
                <NativeSelect
                  id="assignment-programme"
                  className="w-full"
                  value={programId}
                  onChange={(e) => setProgramId(e.target.value)}
                >
                  <option value="">No programme</option>
                  {programs.data.data.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
          </div>
        </section>

        <section
          aria-labelledby="details-rules"
          className="space-y-4 rounded-xl border border-border bg-card p-5"
        >
          <h2 id="details-rules" className="text-base font-semibold">
            How it runs
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="assignment-attempts"
              label="Attempts per question"
              hint="0 lets a learner try as often as they like."
            >
              <Input
                id="assignment-attempts"
                type="number"
                min={0}
                max={100}
                value={settings.attemptsPerQuestion}
                onChange={(e) =>
                  setSetting(
                    'attemptsPerQuestion',
                    Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                  )
                }
                aria-describedby="assignment-attempts-hint"
              />
            </Field>
            <Field id="assignment-grading" label="Which attempt counts">
              <NativeSelect
                id="assignment-grading"
                className="w-full"
                value={settings.gradingMethod}
                onChange={(e) => setSetting('gradingMethod', e.target.value as GradingMethod)}
              >
                {(Object.keys(GRADING_LABELS) as GradingMethod[]).map((value) => (
                  <option key={value} value={value}>
                    {GRADING_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="assignment-explanation" label="Show the worked answer">
              <NativeSelect
                id="assignment-explanation"
                className="w-full"
                value={settings.explanationPolicy}
                onChange={(e) =>
                  setSetting('explanationPolicy', e.target.value as ExplanationPolicy)
                }
              >
                {(Object.keys(EXPLANATION_LABELS) as ExplanationPolicy[]).map((value) => (
                  <option key={value} value={value}>
                    {EXPLANATION_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="assignment-late" label="An answer after the due date">
              <NativeSelect
                id="assignment-late"
                className="w-full"
                value={settings.duePolicy}
                onChange={(e) => setSetting('duePolicy', e.target.value as DuePolicy)}
              >
                {(Object.keys(DUE_LABELS) as DuePolicy[]).map((value) => (
                  <option key={value} value={value}>
                    {DUE_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              id="assignment-pass"
              label="Pass mark (%)"
              hint="The share of the marks that counts as passed."
            >
              <Input
                id="assignment-pass"
                type="number"
                min={0}
                max={100}
                value={passPercent}
                onChange={(e) => setPassPercent(e.target.value)}
                aria-describedby="assignment-pass-hint"
              />
            </Field>
            <Field
              id="assignment-minutes"
              label="Expected time (minutes)"
              hint="Shown to learners; 0 leaves it out."
            >
              <Input
                id="assignment-minutes"
                type="number"
                min={0}
                max={10000}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                aria-describedby="assignment-minutes-hint"
              />
            </Field>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save details'}
          </Button>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5 text-sm">
          <h2 className="font-semibold">Changing a live assignment</h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Learners see new rules straight away. Answers already submitted keep the marks they were
            given; a new attempt limit counts the attempts already made.
          </p>
        </div>
        {detail.status !== 'archived' ? (
          <div className="rounded-xl border border-danger/25 bg-card p-5 text-sm">
            <h2 className="font-semibold">Archive</h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Takes it back from every batch and learner. Submissions, marks and reviews are kept.
            </p>
            <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" className="mt-3">
                  <Archive aria-hidden="true" />
                  Archive assignment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Archive “{detail.title}”?</DialogTitle>
                  <DialogDescription>
                    Learners stop seeing it. Everything they submitted stays on record.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setArchiveOpen(false)}>
                    Keep it
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={archive.isPending}
                    onClick={() => archive.mutate()}
                  >
                    {archive.isPending ? 'Archiving…' : 'Archive'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : null}
      </aside>
    </form>
  );
}
