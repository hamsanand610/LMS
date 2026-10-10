'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { type PermissionScope } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
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
import { useCan } from '@/shell/me-context';

interface RoleSummary {
  id: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissionCount: number;
  userCount: number;
}

interface PermissionGroup {
  moduleKey: string;
  moduleName: string;
  permissions: { key: string; description: string; scopes: readonly PermissionScope[] }[];
}

interface BundleEntry {
  permissionKey: string;
  scope: PermissionScope;
}

/** Sentinel for "not granted" in the scope selects. */
const NONE = 'none';
type CellValue = PermissionScope | typeof NONE;
/** Unsaved edits: roleId → permissionKey → chosen value. Everything else shows the saved bundle. */
type Edits = Record<string, Record<string, CellValue>>;

export function RolesMatrix() {
  const queryClient = useQueryClient();
  const canManage = useCan('roles:manage');
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api<RoleSummary[]>('/roles') });
  const permissions = useQuery({
    queryKey: ['permissions'],
    queryFn: () => api<PermissionGroup[]>('/permissions'),
  });
  const bundles = useQueries({
    queries: (roles.data ?? []).map((r) => ({
      queryKey: ['role-permissions', r.id],
      queryFn: () => api<BundleEntry[]>(`/roles/${r.id}/permissions`),
    })),
  });
  const [edits, setEdits] = useState<Edits>({});

  const save = useMutation({
    mutationFn: ({ roleId, entries }: { roleId: string; entries: BundleEntry[] }) =>
      api<BundleEntry[]>(`/roles/${roleId}/permissions`, { method: 'PUT', body: entries }),
    onSuccess: (_data, vars) => {
      setEdits((prev) => {
        const next = { ...prev };
        delete next[vars.roleId];
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ['role-permissions', vars.roleId] });
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Permissions saved. Affected users see the change within a minute.');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'Could not save permissions'),
  });

  if (roles.isPending || permissions.isPending) return <LoadingRows rows={8} />;
  if (roles.isError) return <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />;
  if (permissions.isError)
    return <ErrorState error={permissions.error} onRetry={() => void permissions.refetch()} />;

  const saved = (index: number): Map<string, PermissionScope> =>
    new Map((bundles[index]?.data ?? []).map((e) => [e.permissionKey, e.scope]));
  const valueFor = (role: RoleSummary, index: number, permissionKey: string): CellValue =>
    edits[role.id]?.[permissionKey] ?? saved(index).get(permissionKey) ?? NONE;
  const isDirty = (role: RoleSummary, index: number): boolean => {
    const base = saved(index);
    return Object.entries(edits[role.id] ?? {}).some(
      ([key, value]) => (base.get(key) ?? NONE) !== value,
    );
  };
  const entriesFor = (role: RoleSummary, index: number): BundleEntry[] => {
    const merged = new Map<string, CellValue>(saved(index));
    for (const [key, value] of Object.entries(edits[role.id] ?? {})) merged.set(key, value);
    return [...merged.entries()]
      .filter((e): e is [string, PermissionScope] => e[1] !== NONE)
      .map(([permissionKey, scope]) => ({ permissionKey, scope }));
  };
  const setCell = (roleId: string, permissionKey: string, value: CellValue) =>
    setEdits((prev) => ({
      ...prev,
      [roleId]: { ...(prev[roleId] ?? {}), [permissionKey]: value },
    }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {roles.data.length} roles ·{' '}
          {permissions.data.reduce((n, g) => n + g.permissions.length, 0)} permissions
        </p>
        {canManage ? <CreateRoleDialog roles={roles.data} /> : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-64">Permission</TableHead>
              {roles.data.map((role) => (
                <TableHead key={role.id} className="min-w-36 text-center">
                  <div className="font-medium">{role.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {role.userCount} user{role.userCount === 1 ? '' : 's'}
                    {role.isSystem ? (
                      <Badge variant="outline" className="ml-1">
                        system
                      </Badge>
                    ) : null}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.data.map((group) => (
              <GroupRows
                key={group.moduleKey}
                group={group}
                roles={roles.data}
                valueFor={(role, permissionKey) =>
                  valueFor(role, roles.data.indexOf(role), permissionKey)
                }
                onChange={setCell}
                canManage={canManage}
              />
            ))}
            <TableRow>
              <TableCell className="text-xs text-muted-foreground">
                Changes are saved per role.
              </TableCell>
              {roles.data.map((role, i) => (
                <TableCell key={role.id} className="text-center">
                  {role.key === 'super_admin' ? (
                    <span className="text-xs text-muted-foreground">Always full access</span>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!canManage || !isDirty(role, i) || save.isPending}
                      onClick={() => save.mutate({ roleId: role.id, entries: entriesFor(role, i) })}
                    >
                      Save
                    </Button>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function GroupRows({
  group,
  roles,
  valueFor,
  onChange,
  canManage,
}: {
  group: PermissionGroup;
  roles: RoleSummary[];
  valueFor: (role: RoleSummary, permissionKey: string) => CellValue;
  onChange: (roleId: string, permissionKey: string, value: CellValue) => void;
  canManage: boolean;
}) {
  return (
    <>
      <TableRow className="bg-muted/50">
        <TableCell
          colSpan={roles.length + 1}
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {group.moduleName}
        </TableCell>
      </TableRow>
      {group.permissions.map((permission) => (
        <TableRow key={permission.key}>
          <TableCell>
            <p className="font-mono text-xs">{permission.key}</p>
            <p className="text-xs text-muted-foreground">{permission.description}</p>
          </TableCell>
          {roles.map((role) => {
            const locked = role.key === 'super_admin' || !canManage;
            return (
              <TableCell key={role.id} className="text-center">
                <Select
                  value={role.key === 'super_admin' ? 'all' : valueFor(role, permission.key)}
                  disabled={locked}
                  onValueChange={(v) => onChange(role.id, permission.key, v as CellValue)}
                >
                  <SelectTrigger
                    className="mx-auto w-28"
                    aria-label={`${permission.key} for ${role.name}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {permission.scopes.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                    {role.key === 'super_admin' && !permission.scopes.includes('all') ? (
                      <SelectItem value="all">all</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </>
  );
}

function CreateRoleDialog({ roles }: { roles: RoleSummary[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cloneFrom, setCloneFrom] = useState<string>(NONE);
  const create = useMutation({
    mutationFn: () =>
      api<RoleSummary>('/roles', {
        body: {
          key,
          name,
          description: description || undefined,
          cloneFromRoleId: cloneFrom === NONE ? undefined : cloneFrom,
        },
      }),
    onSuccess: (role) => {
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success(`Role ${role.name} created`);
      setOpen(false);
      setKey('');
      setName('');
      setDescription('');
      setCloneFrom(NONE);
    },
    onError: (error) => {
      if (isApiError(error) && error.problem?.errors?.length)
        toast.error(error.problem.errors.map((e) => e.message).join(' '));
      else toast.error(isApiError(error) ? error.message : 'Could not create the role');
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">New role</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a role</DialogTitle>
          <DialogDescription>
            Start empty or copy an existing bundle, then adjust permissions in the matrix.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-key">Key</Label>
            <Input
              id="role-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="placement_assistant"
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, digits and underscores; cannot be changed later.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-name">Name</Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-description">Description</Label>
            <Input
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-copy-from">Copy permissions from</Label>
            <Select value={cloneFrom} onValueChange={setCloneFrom}>
              <SelectTrigger id="role-copy-from">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Start empty</SelectItem>
                {roles
                  .filter((r) => r.key !== 'super_admin')
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!key || !name || create.isPending} onClick={() => create.mutate()}>
            Create role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
