'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  type BatchSummary,
  type CustomFieldRecord,
  emailSchema,
  formatDateTime,
  mobileSchema,
  type Paginated,
  STUDENT_STATUSES,
  type StudentSummary,
  VERIFICATION_STATUSES,
} from '@lms/shared';
import { FieldError } from '@/components/field-error';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
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
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
import { CustomFieldInputs, customFieldDefaults } from './custom-field-inputs';

const ALL = 'all';

export function StudentsTable() {
  const me = useMe();
  const canManage = useCan('students:manage');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(ALL);
  const [batchId, setBatchId] = useState(ALL);

  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (q) params.set('q', q);
  if (status !== ALL) params.set('status', status);
  if (batchId !== ALL) params.set('batchId', batchId);

  const query = useQuery({
    queryKey: ['students', params.toString()],
    queryFn: () => api<Paginated<StudentSummary>>(`/students?${params.toString()}`),
  });
  const batches = useQuery({
    queryKey: ['batches', 'options'],
    queryFn: () => api<Paginated<BatchSummary>>('/batches?pageSize=100'),
  });

  const filtered = q !== '' || status !== ALL || batchId !== ALL;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder="Search name, email or student code"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          wrapperClassName="w-full max-w-xs"
          aria-label="Search students"
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
            {STUDENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={batchId}
          onValueChange={(v) => {
            setBatchId(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-52" aria-label="Filter by batch">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All batches</SelectItem>
            {(batches.data?.data ?? []).map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        {canManage ? (
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/students/import">Import</Link>
            </Button>
            <NewStudentDialog batches={batches.data?.data ?? []} />
          </>
        ) : null}
      </div>

      {query.isPending ? (
        <LoadingRows rows={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          title={filtered ? 'No students match these filters' : 'No students yet'}
          description={
            filtered
              ? 'Try a different search or clear the filters.'
              : 'Add students one at a time, or import a sheet to onboard a whole intake.'
          }
          action={
            filtered ? (
              <Button
                variant="outline"
                onClick={() => {
                  setQ('');
                  setStatus(ALL);
                  setBatchId(ALL);
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : canManage ? (
              <Button asChild>
                <Link href="/admin/students/import">Import students</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Batches</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead className="w-36">Profile</TableHead>
                  <TableHead>Last sign-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <Link
                        href={`/admin/students/${student.id}`}
                        className="font-medium hover:underline"
                      >
                        {student.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {student.studentCode} · {student.email}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {student.batches.length === 0 ? (
                        <span className="text-muted-foreground">Not in a batch</span>
                      ) : (
                        student.batches.map((b) => b.code).join(', ')
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={student.status} />
                      {student.accountStatus === 'invited' ? (
                        <StatusBadge status="invited" className="ml-1" />
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={student.verificationStatus} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={student.completeness} tone="neutral" className="h-2" />
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {student.completeness}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {student.lastActiveAt
                        ? formatDateTime(student.lastActiveAt, {
                            timeZone: me.organization.timezone,
                          })
                        : 'Never'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            page={query.data.meta.page}
            pageSize={query.data.meta.pageSize}
            total={query.data.meta.total}
            onPageChange={setPage}
            noun="students"
          />
        </>
      )}
    </div>
  );
}

const NONE = 'none';

function NewStudentDialog({ batches }: { batches: BatchSummary[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const fields = useQuery({
    queryKey: ['custom-fields', 'student'],
    queryFn: () => api<CustomFieldRecord[]>('/custom-fields?entityType=student'),
  });
  const active = (fields.data ?? []).filter((f) => !f.archived);

  const formSchema = z.object({
    name: z.string().trim().min(2, 'Enter the full name').max(120),
    email: emailSchema,
    mobile: z.union([mobileSchema, z.literal('')]),
    batchId: z.string(),
    sendInvitation: z.boolean(),
    custom: z.record(z.string(), z.unknown()),
  });
  type Values = z.infer<typeof formSchema>;

  const form = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      mobile: '',
      batchId: NONE,
      sendInvitation: true,
      custom: {},
    },
  });
  const [sendInvitation, batchValue, customValues] = useWatch({
    control: form.control,
    name: ['sendInvitation', 'batchId', 'custom'],
  });

  const create = useMutation({
    mutationFn: (values: Values) =>
      api<StudentSummary>('/students', {
        body: {
          name: values.name,
          email: values.email,
          mobile: values.mobile || undefined,
          batchId: values.batchId === NONE ? null : values.batchId,
          sendInvitation: values.sendInvitation,
          custom: values.custom,
        },
      }),
    onSuccess: (student) => {
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(
        `${student.name} added as ${student.studentCode}${sendInvitation ? '; an invitation is on its way' : ''}`,
      );
      setOpen(false);
      form.reset({
        ...form.getValues(),
        name: '',
        email: '',
        mobile: '',
        custom: customFieldDefaults(active),
      });
    },
    onError: (error) => {
      if (isApiError(error) && error.code === 'email_taken') {
        form.setError('email', { message: 'An account with this email already exists' });
      } else if (isApiError(error) && error.problem?.errors?.length) {
        toast.error(error.problem.errors.map((e) => e.message).join(' '));
      } else {
        toast.error(isApiError(error) ? error.message : 'Could not add the student');
      }
    },
  });

  const { errors } = form.formState;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New student</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <form onSubmit={form.handleSubmit((v) => create.mutate(v))} noValidate>
          <DialogHeader>
            <DialogTitle>Add a student</DialogTitle>
            <DialogDescription>
              A student account and record are created. With an invitation, they set their own
              password.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student-name">Full name</Label>
              <Input id="student-name" {...form.register('name')} />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-email">Email</Label>
              <Input id="student-email" type="email" {...form.register('email')} />
              <FieldError message={errors.email?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-mobile">Mobile (optional)</Label>
              <Input id="student-mobile" placeholder="+919876543210" {...form.register('mobile')} />
              <FieldError message={errors.mobile?.message} />
            </div>
            <div className="space-y-2">
              <Label>Batch (optional)</Label>
              <Select
                value={batchValue}
                onValueChange={(v) => form.setValue('batchId', v, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Assign later</SelectItem>
                  {batches
                    .filter((b) => b.status === 'planned' || b.status === 'running')
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.code} — {b.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <CustomFieldInputs
              fields={active}
              values={customValues}
              onChange={(key, value) =>
                form.setValue(
                  'custom',
                  { ...form.getValues('custom'), [key]: value },
                  { shouldDirty: true },
                )
              }
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={sendInvitation}
                onCheckedChange={(v) => form.setValue('sendInvitation', v === true)}
              />
              Send an invitation email now
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add student'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { VERIFICATION_STATUSES };
