'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  DEFAULT_TIMEZONE,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  toLocalDateKey,
  zonedDateTimeToUtc,
  type BatchSummary,
  type CompanyCard,
  type DriveDetail,
  type EmploymentType,
  type Paginated,
  type ProgramSummary,
} from '@lms/shared';
import { FieldError } from '@/components/field-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';

/** "HH:MM" of an instant in the institute's zone, for a time input. */
function localTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: DEFAULT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
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

interface Values {
  companyId: string;
  role: string;
  employmentType: EmploymentType;
  location: string;
  packageText: string;
  description: string;
  applyUrl: string;
  date: string;
  time: string;
  batchIds: string[];
  programIds: string[];
  minAttendance: string;
}

function initialValues(drive: DriveDetail | null, companyId?: string): Values {
  return {
    companyId: drive?.company.id ?? companyId ?? '',
    role: drive?.role ?? '',
    employmentType: drive?.employmentType ?? 'full_time',
    location: drive?.location ?? '',
    packageText: drive?.packageText ?? '',
    description: drive?.description ?? '',
    applyUrl: drive?.applyUrl ?? '',
    date: drive ? toLocalDateKey(drive.applyBy) : '',
    time: drive ? localTime(drive.applyBy) : '18:00',
    batchIds: drive?.eligibility.batchIds ?? [],
    programIds: drive?.eligibility.programIds ?? [],
    minAttendance:
      drive?.eligibility.minAttendancePct === null || drive === null
        ? ''
        : String(drive.eligibility.minAttendancePct),
  };
}

/**
 * Creating or editing a drive. The closing time is entered in the institute's time zone (IST) and
 * stored as an instant. Empty eligibility lists mean the drive is open to everybody.
 */
export function DriveForm({
  drive,
  companyId,
  onSaved,
  onCancel,
}: {
  drive: DriveDetail | null;
  companyId?: string;
  onSaved: (drive: DriveDetail) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Values>(() => initialValues(drive, companyId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const companies = useQuery({
    queryKey: ['companies', 'view=all'],
    queryFn: () => api<CompanyCard[]>('/companies?view=all'),
  });
  const batches = useQuery({
    queryKey: ['batches', 'all-for-drives'],
    queryFn: () => api<Paginated<BatchSummary>>('/batches?pageSize=100'),
  });
  const programs = useQuery({
    queryKey: ['programs', 'all'],
    queryFn: () => api<Paginated<ProgramSummary>>('/programs?pageSize=100'),
  });

  const save = useMutation({
    mutationFn: () => {
      const applyBy = values.date
        ? zonedDateTimeToUtc(values.date, values.time || '18:00', DEFAULT_TIMEZONE).toISOString()
        : '';
      const body = {
        companyId: values.companyId,
        role: values.role,
        employmentType: values.employmentType,
        location: values.location,
        packageText: values.packageText,
        description: values.description,
        applyUrl: values.applyUrl,
        applyBy,
        eligibility: {
          batchIds: values.batchIds,
          programIds: values.programIds,
          minAttendancePct: values.minAttendance === '' ? null : Number(values.minAttendance),
        },
      };
      return drive
        ? api<DriveDetail>(`/drives/${drive.id}`, { method: 'PUT', body })
        : api<DriveDetail>('/drives', { method: 'POST', body });
    },
    onSuccess: (saved) => {
      toast.success(drive ? 'Drive saved' : 'Drive created as a draft');
      onSaved(saved);
    },
    onError: (error: Error) => {
      if (isApiError(error)) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
      } else {
        toast.error('The drive could not be saved');
      }
    },
  });

  const toggle = (key: 'batchIds' | 'programIds', id: string, on: boolean) =>
    set(key, on ? [...values[key], id] : values[key].filter((v) => v !== id));

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setErrors({});
        save.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="drive-company">Company</Label>
          <NativeSelect
            id="drive-company"
            className="w-full"
            required
            disabled={companies.isPending}
            value={values.companyId}
            onChange={(e) => set('companyId', e.target.value)}
          >
            <option value="">{companies.isPending ? 'Loading…' : 'Choose a company'}</option>
            {(companies.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
          {companies.isError ? (
            <OptionsProblem what="companies" onRetry={() => void companies.refetch()} />
          ) : null}
          <FieldError message={errors['companyId']} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="drive-role">Role</Label>
          <Input
            id="drive-role"
            required
            minLength={2}
            maxLength={120}
            value={values.role}
            onChange={(e) => set('role', e.target.value)}
            placeholder="e.g. Associate Software Engineer"
          />
          <FieldError message={errors['role']} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="drive-type">Type</Label>
          <NativeSelect
            id="drive-type"
            className="w-full"
            value={values.employmentType}
            onChange={(e) => set('employmentType', e.target.value as EmploymentType)}
          >
            {EMPLOYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EMPLOYMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="drive-location">Location</Label>
          <Input
            id="drive-location"
            maxLength={120}
            value={values.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="e.g. Chennai, or Remote"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="drive-package">Package, as the company states it</Label>
          <Input
            id="drive-package"
            maxLength={80}
            value={values.packageText}
            onChange={(e) => set('packageText', e.target.value)}
            placeholder="e.g. 4.5 – 6 LPA"
          />
        </div>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <div className="space-y-2">
            <Label htmlFor="drive-date">Applications close (IST)</Label>
            <Input
              id="drive-date"
              type="date"
              required
              value={values.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="drive-time">Time</Label>
            <Input
              id="drive-time"
              type="time"
              required
              value={values.time}
              onChange={(e) => set('time', e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <FieldError message={errors['applyBy']} />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="drive-description">About the role</Label>
        <Textarea
          id="drive-description"
          rows={5}
          maxLength={4000}
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="What the job is, the selection rounds, anything to bring."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="drive-apply-url">Official application link (optional)</Label>
        <Input
          id="drive-apply-url"
          type="url"
          inputMode="url"
          maxLength={500}
          value={values.applyUrl}
          onChange={(e) => set('applyUrl', e.target.value)}
          placeholder="https://careers.example.com/jobs/1234"
          aria-describedby="drive-apply-url-hint"
        />
        <p id="drive-apply-url-hint" className="text-xs text-muted-foreground">
          The company&apos;s own page for this opening, as it published it (https only). Learners
          see it beside the platform&apos;s Apply. Leave it empty when learners apply through the
          platform alone.
        </p>
        <FieldError message={errors['applyUrl']} />
      </div>

      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Who can apply</legend>
        <p className="text-xs text-muted-foreground">
          Leave a list empty to allow everybody. A learner must meet every rule you set.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[13px] font-medium">Batches</p>
            <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
              {batches.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
              {batches.isError ? (
                <OptionsProblem what="batches" onRetry={() => void batches.refetch()} />
              ) : null}
              {(batches.data?.data ?? []).map((batch) => (
                <label key={batch.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={values.batchIds.includes(batch.id)}
                    onCheckedChange={(checked) => toggle('batchIds', batch.id, checked === true)}
                  />
                  <span className="truncate">
                    {batch.code} <span className="text-muted-foreground">· {batch.name}</span>
                  </span>
                </label>
              ))}
            </div>
            <FieldError message={errors['eligibility.batchIds']} />
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium">Programmes</p>
            <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
              {programs.isPending ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : null}
              {programs.isError ? (
                <OptionsProblem what="programmes" onRetry={() => void programs.refetch()} />
              ) : null}
              {(programs.data?.data ?? []).map((program) => (
                <label key={program.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={values.programIds.includes(program.id)}
                    onCheckedChange={(checked) =>
                      toggle('programIds', program.id, checked === true)
                    }
                  />
                  <span className="truncate">{program.name}</span>
                </label>
              ))}
            </div>
            <FieldError message={errors['eligibility.programIds']} />
          </div>
        </div>
        <div className="max-w-56 space-y-2">
          <Label htmlFor="drive-attendance">Minimum attendance (%)</Label>
          <Input
            id="drive-attendance"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={values.minAttendance}
            onChange={(e) => set('minAttendance', e.target.value)}
            placeholder="No minimum"
          />
        </div>
      </fieldset>

      <div className="flex gap-2 border-t border-border pt-5">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : drive ? 'Save changes' : 'Create draft'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
