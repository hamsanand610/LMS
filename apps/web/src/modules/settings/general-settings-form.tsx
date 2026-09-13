'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { type Path, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { type Settings, settingsSchema } from '@lms/shared';
import { FieldError } from '@/components/field-error';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';

type FormInput = z.input<typeof settingsSchema>;
type FormValues = z.output<typeof settingsSchema>;
const STATUSES = ['present', 'late', 'excused'] as const;

export function GeneralSettingsForm() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/settings') });
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(settingsSchema),
    values: query.data,
  });

  useEffect(() => {
    if (query.data) form.reset(query.data);
  }, [query.data, form]);

  const academic = useWatch({ control: form.control, name: 'academic' });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api<Settings>('/settings', { method: 'PATCH', body: values }),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      toast.success('Settings saved');
    },
    onError: (error) => {
      if (isApiError(error) && error.problem?.errors?.length) {
        for (const issue of error.problem.errors) {
          form.setError(issue.path as Path<FormInput>, { message: issue.message });
        }
        toast.error('Some fields need attention');
      } else {
        toast.error(isApiError(error) ? error.message : 'Could not save settings');
      }
    },
  });

  if (query.isPending) return <LoadingRows rows={8} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const { errors } = form.formState;
  const counted = academic?.attendanceCountedStatuses;

  return (
    <form
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      className="space-y-6"
      noValidate
    >
      <Card>
        <CardHeader>
          <CardTitle>Institute</CardTitle>
          <CardDescription>Shown in the app, emails and reports.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="instituteName">Institute name</Label>
            <Input id="instituteName" {...form.register('general.instituteName')} />
            <FieldError message={errors.general?.instituteName?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input
              id="contactEmail"
              type="email"
              {...form.register('general.contactEmail', {
                setValueAs: (v) => (v === '' ? null : v),
              })}
            />
            <FieldError message={errors.general?.contactEmail?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPhone">Contact phone</Label>
            <Input
              id="contactPhone"
              {...form.register('general.contactPhone', {
                setValueAs: (v) => (v === '' ? null : v),
              })}
            />
            <FieldError message={errors.general?.contactPhone?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              {...form.register('general.timezone')}
              placeholder="Asia/Kolkata"
            />
            <FieldError message={errors.general?.timezone?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="locale">Locale</Label>
            <Input id="locale" {...form.register('general.locale')} placeholder="en-IN" />
            <FieldError message={errors.general?.locale?.message} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Academic defaults</CardTitle>
          <CardDescription>
            Defaults used by attendance, lessons, assignments and tests. Individual items can
            override them.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="attendanceThresholdPct">Attendance threshold (%)</Label>
            <Input
              id="attendanceThresholdPct"
              type="number"
              min={0}
              max={100}
              {...form.register('academic.attendanceThresholdPct', { valueAsNumber: true })}
            />
            <FieldError message={errors.academic?.attendanceThresholdPct?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="attendanceCorrectionWindowHours">
              Attendance correction window (hours)
            </Label>
            <Input
              id="attendanceCorrectionWindowHours"
              type="number"
              min={0}
              max={720}
              {...form.register('academic.attendanceCorrectionWindowHours', {
                valueAsNumber: true,
              })}
            />
            <FieldError message={errors.academic?.attendanceCorrectionWindowHours?.message} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Statuses counted as attended</Label>
            <div className="flex flex-wrap gap-4">
              {STATUSES.map((status) => (
                <label key={status} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={counted?.includes(status) ?? false}
                    onCheckedChange={(checked) => {
                      const current = new Set(form.getValues('academic.attendanceCountedStatuses'));
                      if (checked === true) current.add(status);
                      else current.delete(status);
                      form.setValue('academic.attendanceCountedStatuses', [...current], {
                        shouldDirty: true,
                      });
                    }}
                  />
                  <span className="capitalize">{status}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lessonAutoCompletePct">Lesson auto-complete at (% watched)</Label>
            <Input
              id="lessonAutoCompletePct"
              type="number"
              min={50}
              max={100}
              {...form.register('academic.lessonAutoCompletePct', { valueAsNumber: true })}
            />
            <FieldError message={errors.academic?.lessonAutoCompletePct?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultAssignmentAttempts">
              Default assignment attempts (0 = unlimited)
            </Label>
            <Input
              id="defaultAssignmentAttempts"
              type="number"
              min={0}
              max={100}
              {...form.register('academic.defaultAssignmentAttempts', { valueAsNumber: true })}
            />
            <FieldError message={errors.academic?.defaultAssignmentAttempts?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultNegativeMarkingFraction">
              Default negative marking (fraction of marks)
            </Label>
            <Input
              id="defaultNegativeMarkingFraction"
              type="number"
              step={0.05}
              min={0}
              max={1}
              {...form.register('academic.defaultNegativeMarkingFraction', { valueAsNumber: true })}
            />
            <FieldError message={errors.academic?.defaultNegativeMarkingFraction?.message} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="autoReleaseResults">Release test results automatically</Label>
              <p className="text-xs text-muted-foreground">
                When off, a trainer or admin releases results explicitly.
              </p>
            </div>
            <Switch
              id="autoReleaseResults"
              checked={academic?.autoReleaseResults ?? false}
              onCheckedChange={(v) =>
                form.setValue('academic.autoReleaseResults', v, { shouldDirty: true })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legal and consent</CardTitle>
          <CardDescription>Wording shown when a user activates an account.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="termsPageSlug">Terms page slug</Label>
            <Input id="termsPageSlug" {...form.register('legal.termsPageSlug')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="privacyPageSlug">Privacy page slug</Label>
            <Input id="privacyPageSlug" {...form.register('legal.privacyPageSlug')} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="consentText">Consent text</Label>
            <Textarea id="consentText" rows={3} {...form.register('legal.consentText')} />
            <FieldError message={errors.legal?.consentText?.message} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => form.reset(query.data)}
          disabled={!form.formState.isDirty}
        >
          Discard changes
        </Button>
        <Button type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
