'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type { TrainerDetail } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import { PageHeader } from '@/shell/page-header';

/** A trainer's own record (plan DP-T12): how they are introduced, and what they teach. */
export function TrainerProfile() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['my-trainer-profile'],
    queryFn: () => api<TrainerDetail>('/trainers/me'),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <>
      <PageHeader title={query.data.name} description={query.data.email} />
      <ProfileForm
        key={query.data.id}
        trainer={query.data}
        onSaved={(record) => client.setQueryData(['my-trainer-profile'], record)}
      />
    </>
  );
}

function ProfileForm({
  trainer,
  onSaved,
}: {
  trainer: TrainerDetail;
  onSaved: (record: TrainerDetail) => void;
}) {
  const [values, setValues] = useState({
    name: trainer.name,
    mobile: trainer.mobile ?? '',
    headline: trainer.headline,
    bio: trainer.bio,
    subjects: trainer.subjects.join(', '),
  });

  const save = useMutation({
    mutationFn: () =>
      api<TrainerDetail>('/trainers/me', {
        method: 'PATCH',
        body: {
          name: values.name,
          mobile: values.mobile,
          headline: values.headline,
          bio: values.bio,
          subjects: [
            ...new Set(
              values.subjects
                .split(',')
                .map((subject) => subject.trim())
                .filter(Boolean),
            ),
          ],
        },
      }),
    onSuccess: (record) => {
      onSaved(record);
      toast.success('Profile saved');
    },
    onError: (error: Error) =>
      toast.error(isApiError(error) ? error.message : 'Could not save that'),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">About you</CardTitle>
          <CardDescription>What learners see beside your name.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={values.name}
                  onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="mobile">Mobile</Label>
                <Input
                  id="mobile"
                  value={values.mobile}
                  onChange={(event) => setValues((v) => ({ ...v, mobile: event.target.value }))}
                  placeholder="+919876543210"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="headline">Headline</Label>
              <Input
                id="headline"
                value={values.headline}
                onChange={(event) => setValues((v) => ({ ...v, headline: event.target.value }))}
                placeholder="Core Java and databases"
              />
            </div>
            <div>
              <Label htmlFor="subjects">Subjects, separated by commas</Label>
              <Input
                id="subjects"
                value={values.subjects}
                onChange={(event) => setValues((v) => ({ ...v, subjects: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={5}
                value={values.bio}
                onChange={(event) => setValues((v) => ({ ...v, bio: event.target.value }))}
              />
            </div>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your batches</CardTitle>
          <CardDescription>Assigned by an administrator.</CardDescription>
        </CardHeader>
        <CardContent>
          {trainer.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">You are not assigned to a batch yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {trainer.assignments.map((assignment) => (
                <li
                  key={`${assignment.batchId}-${assignment.subject}`}
                  className="flex flex-wrap items-center gap-2"
                >
                  <span className="font-medium">{assignment.batchCode}</span>
                  <Badge className="bg-muted text-muted-foreground">{assignment.subject}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
