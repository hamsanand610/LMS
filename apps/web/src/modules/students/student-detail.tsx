'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  DOCUMENT_TYPES,
  type DocumentType,
  formatDateTime,
  STUDENT_STATUS_TRANSITIONS,
  type StudentDetail as StudentDetailData,
  type StudentNoteRecord,
  type StudentStatus,
} from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { StatusBadge } from '@/components/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LearnerPrivacy } from './learner-privacy';
import { LearnerRecord } from './trainer-student';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/http';
import { useParentPath } from '@/lib/use-parent-path';
import { isApiError } from '@/lib/api/errors';
import { uploadFile } from '@/lib/files/upload';
import { useCan, useMe } from '@/shell/me-context';
import { PageHeader } from '@/shell/page-header';

interface BatchRow {
  batchId: string;
  code: string;
  name: string;
  programName: string;
  status: string;
  joinedAt: string;
  leftAt: string | null;
  isActive: boolean;
}

interface DocumentRow {
  id: string;
  type: DocumentType;
  title: string;
  status: 'pending' | 'verified' | 'rejected';
  reason: string;
  fileName: string;
  fileSize: number;
  mime: string;
  reviewedAt: string | null;
  createdAt: string;
}

export function StudentDetail({ studentId }: { studentId: string }) {
  const listHref = useParentPath();
  const me = useMe();
  const canManage = useCan('students:manage');
  const canSeeSensitive = useCan('students:read_sensitive');
  const canManagePrivacy = useCan('privacy:manage');
  const query = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => api<StudentDetailData>(`/students/${studentId}`),
  });

  if (query.isPending) return <LoadingRows rows={8} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const student = query.data;

  return (
    <>
      <PageHeader
        back={{ href: listHref, label: 'All students' }}
        eyebrow="Student"
        title={student.name}
        description={`${student.studentCode} · ${student.email}${student.mobile ? ` · ${student.mobile}` : ''}`}
        actions={canManage ? <StatusControl student={student} /> : null}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge status={student.status} />
        <StatusBadge status={student.accountStatus} />
        <StatusBadge status={student.verificationStatus} />
        <div className="flex w-48 items-center gap-2">
          <Progress
            value={student.completeness}
            tone="neutral"
            className="h-2"
            aria-label={`Profile ${student.completeness}% complete`}
          />
          <span className="text-xs tabular-nums text-muted-foreground">
            {student.completeness}% complete
          </span>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="learning">Learning</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          {canManagePrivacy ? <TabsTrigger value="privacy">Privacy</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab student={student} canManage={canManage} canSeeSensitive={canSeeSensitive} />
        </TabsContent>
        <TabsContent value="learning" className="pt-4">
          <LearnerRecord studentId={studentId} />
        </TabsContent>
        <TabsContent value="batches">
          <BatchesTab studentId={studentId} timezone={me.organization.timezone} />
        </TabsContent>
        <TabsContent value="documents">
          {canSeeSensitive ? (
            <DocumentsTab
              studentId={studentId}
              canManage={canManage}
              timezone={me.organization.timezone}
            />
          ) : (
            <Alert>
              <AlertDescription>
                Documents hold personal data. Ask an administrator for the “see personal details”
                permission to open them.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab studentId={studentId} timezone={me.organization.timezone} />
        </TabsContent>
        {canManagePrivacy ? (
          <TabsContent value="privacy">
            <LearnerPrivacy student={student} listHref={listHref} />
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  );
}

function StatusControl({ student }: { student: StudentDetailData }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState<StudentStatus | ''>('');
  const [reason, setReason] = useState('');
  const options = STUDENT_STATUS_TRANSITIONS[student.status];

  const change = useMutation({
    mutationFn: () => api(`/students/${student.id}/status`, { body: { status: next, reason } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student', student.id] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(`Status changed to ${next}`);
      setOpen(false);
      setReason('');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'Could not change the status'),
  });

  if (options.length === 0) {
    return <span className="text-sm text-muted-foreground">No further status changes</span>;
  }
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Change status
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change status</DialogTitle>
            <DialogDescription>
              {student.name} is currently {student.status}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student-next-status">New status</Label>
              <Select value={next} onValueChange={(v) => setNext(v as StudentStatus)}>
                <SelectTrigger id="student-next-status">
                  <SelectValue placeholder="Choose a status" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option} value={option} className="capitalize">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-reason">Reason (kept in the audit log)</Label>
              <Input
                id="status-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!next || change.isPending} onClick={() => change.mutate()}>
              Change status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProfileTab({
  student,
  canManage,
  canSeeSensitive,
}: {
  student: StudentDetailData;
  canManage: boolean;
  canSeeSensitive: boolean;
}) {
  const queryClient = useQueryClient();
  const [summary, setSummary] = useState(student.summary);
  const [skills, setSkills] = useState(student.skills.join(', '));

  const save = useMutation({
    mutationFn: () =>
      api(`/students/${student.id}`, {
        method: 'PATCH',
        body: {
          summary,
          skills: skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student', student.id] });
      toast.success('Profile saved');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'Could not save the profile'),
  });

  const personal = Object.entries(student.personal).filter(([, v]) => v !== null && v !== '');
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal</CardTitle>
          {!canSeeSensitive ? (
            <CardDescription>
              Some fields are hidden without the personal-details permission.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {personal.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
              {personal.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="capitalize text-muted-foreground">
                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Education</CardTitle>
        </CardHeader>
        <CardContent>
          {student.education.length === 0 ? (
            <p className="text-sm text-muted-foreground">No qualifications recorded.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {student.education.map((entry, index) => (
                <li key={index}>
                  <p className="font-medium">{entry.qualification}</p>
                  <p className="text-muted-foreground">
                    {[entry.institution, entry.yearOfPassing].filter(Boolean).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {Object.keys(student.custom).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Institute fields</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
              {Object.entries(student.custom).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd>{Array.isArray(value) ? value.join(', ') : String(value)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Summary and skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="student-summary">Summary</Label>
            <Textarea
              id="student-summary"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={!canManage}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="student-skills">Skills (comma separated)</Label>
            <Input
              id="student-skills"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              disabled={!canManage}
            />
          </div>
          {canManage ? (
            <Button
              onClick={() => save.mutate()}
              disabled={
                save.isPending ||
                (summary === student.summary && skills === student.skills.join(', '))
              }
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function BatchesTab({ studentId, timezone }: { studentId: string; timezone: string }) {
  const query = useQuery({
    queryKey: ['student-batches', studentId],
    queryFn: () => api<BatchRow[]>(`/students/${studentId}/batches`),
  });
  if (query.isPending) return <LoadingRows rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">This student is not in any batch yet.</p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Batch</TableHead>
            <TableHead>Programme</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Left</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.data.map((row) => (
            <TableRow key={`${row.batchId}-${row.joinedAt}`}>
              <TableCell>
                <Link
                  href={`/admin/batches/${row.batchId}`}
                  className="font-medium hover:underline"
                >
                  {row.code}
                </Link>
                <p className="text-xs text-muted-foreground">{row.name}</p>
              </TableCell>
              <TableCell className="text-sm">{row.programName}</TableCell>
              <TableCell className="text-xs tabular-nums">
                {formatDateTime(row.joinedAt, { timeZone: timezone })}
              </TableCell>
              <TableCell className="text-xs tabular-nums">
                {row.leftAt ? formatDateTime(row.leftAt, { timeZone: timezone }) : '—'}
              </TableCell>
              <TableCell>
                <StatusBadge status={row.isActive ? row.status : 'left'} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DocumentsTab({
  studentId,
  canManage,
  timezone,
}: {
  studentId: string;
  canManage: boolean;
  timezone: string;
}) {
  const queryClient = useQueryClient();
  const canVerify = useCan('students:verify_documents');
  const [uploading, setUploading] = useState(false);
  const [type, setType] = useState<DocumentType>('id_proof');
  const [rejecting, setRejecting] = useState<DocumentRow | null>(null);
  const [reason, setReason] = useState('');

  const query = useQuery({
    queryKey: ['student-documents', studentId],
    queryFn: () => api<DocumentRow[]>(`/students/${studentId}/documents`),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['student-documents', studentId] });
    void queryClient.invalidateQueries({ queryKey: ['student', studentId] });
  };

  const decide = useMutation({
    mutationFn: ({
      id,
      decision,
      why,
    }: {
      id: string;
      decision: 'verified' | 'rejected';
      why: string;
    }) => api(`/students/${studentId}/documents/${id}/verify`, { body: { decision, reason: why } }),
    onSuccess: (_data, vars) => {
      refresh();
      toast.success(`Document ${vars.decision}`);
      setRejecting(null);
      setReason('');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'Could not record the decision'),
  });

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile('student-document', file);
      await api(`/students/${studentId}/documents`, {
        body: { type, fileId: uploaded.id, title: file.name },
      });
      refresh();
      toast.success(`${file.name} attached`);
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const download = async (id: string) => {
    try {
      const { url } = await api<{ url: string }>(`/students/${studentId}/documents/${id}/url`);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'Could not open the document');
    }
  };

  if (query.isPending) return <LoadingRows rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
          <div className="space-y-2">
            <Label htmlFor="staff-document-type">Document type</Label>
            <Select value={type} onValueChange={(v) => setType(v as DocumentType)}>
              <SelectTrigger id="staff-document-type" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="document-file">File (PDF or image, up to 10 MB)</Label>
            <Input
              id="document-file"
              type="file"
              accept="application/pdf,image/*"
              disabled={uploading}
              onChange={(e) => void onUpload(e.target.files?.[0])}
            />
          </div>
          {uploading ? <span className="text-sm text-muted-foreground">Uploading…</span> : null}
        </div>
      ) : null}

      {query.data.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No documents submitted yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reviewed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="capitalize">{row.type.replace(/_/g, ' ')}</TableCell>
                  <TableCell className="text-sm">
                    {row.fileName}
                    <p className="text-xs text-muted-foreground">
                      {Math.round(row.fileSize / 1024)} KB
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                    {row.reason ? (
                      <p className="mt-1 text-xs text-muted-foreground">{row.reason}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-muted-foreground">
                    {row.reviewedAt ? formatDateTime(row.reviewedAt, { timeZone: timezone }) : '—'}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button variant="ghost" size="sm" onClick={() => void download(row.id)}>
                      Open
                    </Button>
                    {canVerify && row.status !== 'verified' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => decide.mutate({ id: row.id, decision: 'verified', why: '' })}
                      >
                        Verify
                      </Button>
                    ) : null}
                    {canVerify && row.status !== 'rejected' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        onClick={() => setRejecting(row)}
                      >
                        Reject
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={rejecting !== null} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this document</DialogTitle>
            <DialogDescription>The student sees the reason, so be specific.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="The scan is cut off at the bottom; upload the full page."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              disabled={reason.trim().length === 0 || decide.isPending}
              onClick={() =>
                rejecting &&
                decide.mutate({ id: rejecting.id, decision: 'rejected', why: reason.trim() })
              }
            >
              Reject document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotesTab({ studentId, timezone }: { studentId: string; timezone: string }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const query = useQuery({
    queryKey: ['student-notes', studentId],
    queryFn: () => api<StudentNoteRecord[]>(`/students/${studentId}/notes`),
  });
  const add = useMutation({
    mutationFn: () => api(`/students/${studentId}/notes`, { body: { text: text.trim() } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-notes', studentId] });
      setText('');
      toast.success('Note added');
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not add the note'),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="note-text">New note</Label>
        <Textarea
          id="note-text"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Internal note; the student never sees this."
        />
        <Button disabled={text.trim().length === 0 || add.isPending} onClick={() => add.mutate()}>
          Add note
        </Button>
      </div>
      {query.isPending ? (
        <LoadingRows rows={3} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {query.data.map((note) => (
            <li key={note.id} className="rounded-lg border border-border p-3">
              <p className="text-sm">{note.text}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {note.author.name} · {formatDateTime(note.createdAt, { timeZone: timezone })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
