'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { emailSchema, formatDateTime, mobileSchema, type Paginated } from '@lms/shared';
import { FieldError } from '@/components/field-error';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import { useCan, useMe } from '@/shell/me-context';

interface UserSummary {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  status: 'invited' | 'active' | 'suspended' | 'deactivated';
  roles: { key: string; name: string }[];
  lastLoginAt: string | null;
  createdAt: string;
}

interface RoleSummary {
  id: string;
  key: string;
  name: string;
}

const STATUS_STYLES: Record<UserSummary['status'], string> = {
  active: 'bg-success-soft text-success',
  invited: 'bg-info-soft text-info',
  suspended: 'bg-warning-soft text-warning',
  deactivated: 'bg-muted text-muted-foreground',
};

const ALL = 'all';

export function UsersTable() {
  const me = useMe();
  const canManage = useCan('users:manage');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const params = new URLSearchParams({ page: String(page), pageSize: '25', sort: '-createdAt' });
  if (q) params.set('q', q);
  if (status !== ALL) params.set('status', status);
  const query = useQuery({
    queryKey: ['users', params.toString()],
    queryFn: () => api<Paginated<UserSummary>>(`/users?${params.toString()}`),
  });
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api<RoleSummary[]>('/roles') });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name or email"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
          aria-label="Search users"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="deactivated">Deactivated</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        {canManage && roles.data ? <InviteDialog roles={roles.data} /> : null}
      </div>
      {query.isPending ? (
        <LoadingRows rows={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          title="No users found"
          description={
            q || status !== ALL
              ? 'Try different filters.'
              : 'Invite your first staff member or student.'
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {user.roles.map((r) => r.name).join(', ') || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLES[user.status]}>{user.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {user.lastLoginAt
                        ? formatDateTime(user.lastLoginAt, { timeZone: me.organization.timezone })
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && roles.data ? (
                        <RowActions user={user} roles={roles.data} selfId={me.user.id} />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {query.data.meta.page} · {query.data.meta.total} users
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * query.data.meta.pageSize >= query.data.meta.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const inviteFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter the full name').max(120),
  email: emailSchema,
  mobile: z.union([mobileSchema, z.literal('')]),
  roleKeys: z.array(z.string()).min(1, 'Choose at least one role'),
});
type InviteValues = z.infer<typeof inviteFormSchema>;

function InviteDialog({ roles }: { roles: RoleSummary[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { name: '', email: '', mobile: '', roleKeys: [] },
  });
  const invite = useMutation({
    mutationFn: (values: InviteValues) =>
      api<UserSummary>('/users', { body: { ...values, mobile: values.mobile || null } }),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Invitation sent to ${user.email}`);
      setOpen(false);
      form.reset();
    },
    onError: (error) => {
      if (isApiError(error) && error.code === 'email_taken')
        form.setError('email', { message: 'An account with this email already exists' });
      else toast.error(isApiError(error) ? error.message : 'Could not send the invitation');
    },
  });
  const { errors } = form.formState;
  const selected = useWatch({ control: form.control, name: 'roleKeys' }) ?? [];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Invite user</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit((v) => invite.mutate(v))} noValidate>
          <DialogHeader>
            <DialogTitle>Invite a user</DialogTitle>
            <DialogDescription>
              They receive an email with a link to set a password (valid for 72 hours).
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Full name</Label>
              <Input id="invite-name" {...form.register('name')} />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" {...form.register('email')} />
              <FieldError message={errors.email?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-mobile">Mobile (optional)</Label>
              <Input id="invite-mobile" placeholder="+919876543210" {...form.register('mobile')} />
              <FieldError message={errors.mobile?.message} />
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="grid grid-cols-2 gap-2">
                {roles.map((role) => (
                  <label key={role.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selected.includes(role.key)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selected);
                        if (checked === true) next.add(role.key);
                        else next.delete(role.key);
                        form.setValue('roleKeys', [...next], { shouldValidate: true });
                      }}
                    />
                    {role.name}
                  </label>
                ))}
              </div>
              <FieldError message={errors.roleKeys?.message} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? 'Sending…' : 'Send invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RowActions({
  user,
  roles,
  selfId,
}: {
  user: UserSummary;
  roles: RoleSummary[];
  selfId: string;
}) {
  const queryClient = useQueryClient();
  const [rolesOpen, setRolesOpen] = useState(false);
  const [roleKeys, setRoleKeys] = useState<string[]>(user.roles.map((r) => r.key));
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['users'] });
  const onError = (error: unknown) =>
    toast.error(isApiError(error) ? error.message : 'Action failed');

  const setRoles = useMutation({
    mutationFn: () =>
      api<UserSummary>(`/users/${user.id}/roles`, { method: 'PUT', body: { roleKeys } }),
    onSuccess: () => {
      refresh();
      toast.success('Roles updated; the user must sign in again');
      setRolesOpen(false);
    },
    onError,
  });
  const deactivate = useMutation({
    mutationFn: () =>
      api(`/users/${user.id}/deactivate`, {
        method: 'POST',
        body: { reason: 'Deactivated from the users page' },
      }),
    onSuccess: () => {
      refresh();
      toast.success(`${user.name} deactivated`);
    },
    onError,
  });
  const reactivate = useMutation({
    mutationFn: () => api(`/users/${user.id}/reactivate`, { method: 'POST', body: {} }),
    onSuccess: () => {
      refresh();
      toast.success(`${user.name} reactivated`);
    },
    onError,
  });
  const resend = useMutation({
    mutationFn: () => api(`/users/${user.id}/invitations/resend`, { method: 'POST', body: {} }),
    onSuccess: () => toast.success(`Invitation resent to ${user.email}`),
    onError,
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={`Actions for ${user.name}`}>
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRolesOpen(true)}>Edit roles</DropdownMenuItem>
          {user.status === 'invited' ? (
            <DropdownMenuItem onSelect={() => resend.mutate()}>Resend invitation</DropdownMenuItem>
          ) : null}
          {user.status === 'deactivated' || user.status === 'suspended' ? (
            <DropdownMenuItem onSelect={() => reactivate.mutate()}>Reactivate</DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={user.id === selfId}
              onSelect={() => deactivate.mutate()}
              className="text-danger"
            >
              Deactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={rolesOpen} onOpenChange={setRolesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Roles for {user.name}</DialogTitle>
            <DialogDescription>
              Changing roles signs the user out of all sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {roles.map((role) => (
              <label key={role.key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={roleKeys.includes(role.key)}
                  onCheckedChange={(checked) => {
                    const next = new Set(roleKeys);
                    if (checked === true) next.add(role.key);
                    else next.delete(role.key);
                    setRoleKeys([...next]);
                  }}
                />
                {role.name}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRolesOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={roleKeys.length === 0 || setRoles.isPending}
              onClick={() => setRoles.mutate()}
            >
              Save roles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
