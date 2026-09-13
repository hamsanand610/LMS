'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import type { TrainerDetail as TrainerDetailData } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import { useCan } from '@/shell/me-context';
import { PageHeader } from '@/shell/page-header';

export function TrainerDetail({ trainerId }: { trainerId: string }) {
  const query = useQuery({
    queryKey: ['trainer', trainerId],
    queryFn: () => api<TrainerDetailData>(`/trainers/${trainerId}`),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  // Remount when fresh server data arrives so the form starts from the saved values.
  return <TrainerView key={query.dataUpdatedAt} trainer={query.data} />;
}

function TrainerView({ trainer }: { trainer: TrainerDetailData }) {
  const queryClient = useQueryClient();
  const canManage = useCan('trainers:manage');
  const [form, setForm] = useState({
    name: trainer.name,
    subjects: trainer.subjects.join(', '),
    headline: trainer.headline,
    bio: trainer.bio,
  });

  const save = useMutation({
    mutationFn: () =>
      api(`/trainers/${trainer.id}`, {
        method: 'PATCH',
        body: {
          name: form.name,
          subjects: form.subjects
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          headline: form.headline,
          bio: form.bio,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trainer', trainer.id] });
      void queryClient.invalidateQueries({ queryKey: ['trainers'] });
      toast.success('Trainer saved');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'Could not save the trainer'),
  });

  return (
    <>
      <PageHeader
        title={trainer.name}
        description={`${trainer.email}${trainer.mobile ? ` · ${trainer.mobile}` : ''}`}
        actions={<StatusBadge status={trainer.accountStatus} />}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={!canManage}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subjects">Subjects (comma separated)</Label>
              <Input
                id="subjects"
                value={form.subjects}
                onChange={(e) => setForm({ ...form, subjects: e.target.value })}
                disabled={!canManage}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="headline">Headline</Label>
              <Input
                id="headline"
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
                disabled={!canManage}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={4}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                disabled={!canManage}
              />
            </div>
            {canManage ? (
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Batch assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {trainer.assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Not assigned to any batch. Assignments are made on the batch page.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trainer.assignments.map((a) => (
                    <TableRow key={`${a.batchId}-${a.subject}`}>
                      <TableCell>
                        <Link
                          href={`/admin/batches/${a.batchId}`}
                          className="font-medium hover:underline"
                        >
                          {a.batchCode}
                        </Link>
                        <p className="text-xs text-muted-foreground">{a.batchName}</p>
                      </TableCell>
                      <TableCell className="text-sm">{a.subject}</TableCell>
                      <TableCell className="text-sm capitalize">{a.role}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.batchStatus} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
