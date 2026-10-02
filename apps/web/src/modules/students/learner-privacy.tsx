'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import type { LearnerDataExport, PrivacyErasureResult, StudentDetail } from '@lms/shared';
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
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { saveFile } from '@/lib/files/save-file';

/**
 * Privacy operations on a learner (ADM-11), the Super Admin's: their data as a file to hand over,
 * and erasure by anonymisation, confirmed by typing their e-mail address. Both are audited.
 */
export function LearnerPrivacy({
  student,
  listHref,
}: {
  student: StudentDetail;
  listHref: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [reason, setReason] = useState('');

  const exportData = useMutation({
    mutationFn: () =>
      api<{ filename: string; data: LearnerDataExport }>(
        `/users/${student.userId}/privacy/export`,
        { method: 'POST' },
      ),
    onSuccess: ({ filename, data }) => {
      saveFile(filename, JSON.stringify(data, null, 2), 'application/json');
      toast.success('The learner’s data was exported');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The data could not be exported'),
  });

  const erase = useMutation({
    mutationFn: () =>
      api<PrivacyErasureResult>(`/users/${student.userId}/privacy/erase`, {
        body: { confirmEmail, reason },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('The learner’s data was erased');
      router.push(listHref);
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The data could not be erased'),
  });

  const confirmed =
    confirmEmail.trim().toLowerCase() === student.email.toLowerCase() && reason.trim().length >= 5;

  return (
    <div className="grid gap-4 pt-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>The learner’s data</CardTitle>
          <CardDescription>
            Everything the learner gave and did — profile, batches, courses, attendance, work,
            documents listed by name, doubts, certificates — as a JSON file to hand to them. Staff
            notes and staff-only fields are not included.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            disabled={exportData.isPending}
            onClick={() => exportData.mutate()}
          >
            {exportData.isPending ? 'Exporting…' : 'Export data'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Erase this learner</CardTitle>
          <CardDescription>
            Removes who they are: name, e-mail, mobile, sign-in, photo, profile, documents, résumés,
            notes and notifications; withdraws their certificates; ends their batch places; removes
            the text of what they wrote. Marks, attendance and progress stay, belonging to nobody,
            so the institute’s figures do not change. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setOpen(true)}>
            Erase…
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Erase {student.name}?</DialogTitle>
            <DialogDescription>
              Export their data first if they asked for it. Type their e-mail address to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="erase-email">E-mail address</Label>
              <Input
                id="erase-email"
                autoComplete="off"
                placeholder={student.email}
                value={confirmEmail}
                onChange={(event) => setConfirmEmail(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="erase-reason">Reason</Label>
              <Textarea
                id="erase-reason"
                maxLength={240}
                placeholder="The learner asked, by e-mail on …"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!confirmed || erase.isPending}
              onClick={() => erase.mutate()}
            >
              {erase.isPending ? 'Erasing…' : 'Erase permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
