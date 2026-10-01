'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  changePasswordSchema,
  type ChangePasswordInput,
  formatDateTime,
  type SessionSummary,
} from '@lms/shared';
import { FieldError } from '@/components/field-error';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import { useMe } from '@/shell/me-context';

const nameSchema = z.object({ name: z.string().trim().min(2).max(120) });

export function AccountPanels() {
  const me = useMe();
  const router = useRouter();
  const queryClient = useQueryClient();

  const nameForm = useForm<z.infer<typeof nameSchema>>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: me.user.name },
  });
  const saveName = useMutation({
    mutationFn: (values: z.infer<typeof nameSchema>) =>
      api('/me', { method: 'PATCH', body: values }),
    onSuccess: () => {
      toast.success('Name updated');
      router.refresh();
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'Could not update your name'),
  });

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const changePassword = useMutation({
    mutationFn: (values: ChangePasswordInput) => api('/auth/password/change', { body: values }),
    onSuccess: () => {
      toast.success('Password changed; other sessions were signed out');
      passwordForm.reset();
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (error) => {
      if (isApiError(error) && error.code === 'invalid_credentials')
        passwordForm.setError('currentPassword', { message: 'Current password is incorrect' });
      else if (isApiError(error) && error.code === 'password_too_common')
        passwordForm.setError('newPassword', { message: 'This password is too common' });
      else toast.error(isApiError(error) ? error.message : 'Could not change your password');
    },
  });

  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api<SessionSummary[]>('/auth/sessions'),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/auth/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Session signed out');
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'Could not sign out that session'),
  });
  const logoutAll = useMutation({
    mutationFn: () => api('/auth/logout-all', { method: 'POST' }),
    onSuccess: () => {
      router.replace('/login');
      router.refresh();
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            {me.user.email} · {me.roles.map((r) => r.name).join(', ')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={nameForm.handleSubmit((v) => saveName.mutate(v))}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" {...nameForm.register('name')} />
              <FieldError message={nameForm.formState.errors.name?.message} />
            </div>
            <Button type="submit" disabled={saveName.isPending || !nameForm.formState.isDirty}>
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            At least 10 characters. Other devices are signed out afterwards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={passwordForm.handleSubmit((v) => changePassword.mutate(v))}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <PasswordInput
                id="currentPassword"
                autoComplete="current-password"
                {...passwordForm.register('currentPassword')}
              />
              <FieldError message={passwordForm.formState.errors.currentPassword?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <PasswordInput
                id="newPassword"
                autoComplete="new-password"
                {...passwordForm.register('newPassword')}
              />
              <FieldError message={passwordForm.formState.errors.newPassword?.message} />
            </div>
            <Button type="submit" disabled={changePassword.isPending}>
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Signed-in devices</CardTitle>
            <CardDescription>Sign out of any device you do not recognise.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logoutAll.mutate()}
            disabled={logoutAll.isPending}
          >
            Sign out everywhere
          </Button>
        </CardHeader>
        <CardContent>
          {sessions.isPending ? (
            <LoadingRows rows={3} />
          ) : sessions.isError ? (
            <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Signed in</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.data.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="max-w-xs truncate text-sm">
                        {s.deviceLabel ?? 'Unknown device'}{' '}
                        {s.current ? (
                          <Badge variant="secondary" className="ml-1">
                            this device
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.ip ?? '—'}</TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {formatDateTime(s.createdAt, { timeZone: me.organization.timezone })}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {s.lastUsedAt
                          ? formatDateTime(s.lastUsedAt, { timeZone: me.organization.timezone })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {s.current ? null : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => revoke.mutate(s.id)}
                            disabled={revoke.isPending}
                          >
                            Sign out
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
