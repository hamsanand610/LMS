'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import type {
  ProfileLinks,
  ProfileSection,
  ProfileView as ProfileViewData,
  StudentEducation,
  StudentExperience,
} from '@lms/shared';
import { PROFILE_SECTION_LABELS } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import { PageHeader } from '@/shell/page-header';

const HELP: Record<ProfileSection, string> = {
  personal: 'Your contact details and where you are. Staff can see these; other learners cannot.',
  education: 'What you have studied. Add the most recent first.',
  experience:
    'Any work or internships. Leave the end date empty and tick "current" if it is ongoing.',
  skills: 'What you can do. Three or more counts towards your profile completeness.',
  links: 'Where somebody can see your work.',
};

/**
 * Editing one section of the learner's own record (plan DP-S18). The section is in the address, and
 * the API refuses a body that strays outside it, so a page can only change what it is showing.
 */
export function ProfileEditor({ section }: { section: ProfileSection }) {
  const router = useRouter();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api<ProfileViewData>('/me/profile'),
  });

  const save = useMutation({
    mutationFn: (body: unknown) =>
      api<ProfileViewData>(`/me/profile/${section}`, { method: 'PATCH', body }),
    onSuccess: (profile) => {
      client.setQueryData(['my-profile'], profile);
      toast.success('Saved');
      router.push('/profile');
    },
    onError: (error: Error) =>
      toast.error(isApiError(error) ? error.message : 'Could not save that'),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <>
      <PageHeader
        title={PROFILE_SECTION_LABELS[section]}
        description={HELP[section]}
        actions={
          <Button variant="outline" asChild>
            <Link href="/profile">Cancel</Link>
          </Button>
        }
      />
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          {section === 'personal' ? (
            <PersonalForm profile={query.data} onSave={save.mutate} saving={save.isPending} />
          ) : null}
          {section === 'education' ? (
            <EducationForm profile={query.data} onSave={save.mutate} saving={save.isPending} />
          ) : null}
          {section === 'experience' ? (
            <ExperienceForm profile={query.data} onSave={save.mutate} saving={save.isPending} />
          ) : null}
          {section === 'skills' ? (
            <SkillsForm profile={query.data} onSave={save.mutate} saving={save.isPending} />
          ) : null}
          {section === 'links' ? (
            <LinksForm profile={query.data} onSave={save.mutate} saving={save.isPending} />
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}

interface FormProps {
  profile: ProfileViewData;
  onSave: (body: unknown) => void;
  saving: boolean;
}

function SaveBar({ saving }: { saving: boolean }) {
  return (
    <div className="mt-6 flex gap-2">
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
      <Button variant="outline" asChild>
        <Link href="/profile">Cancel</Link>
      </Button>
    </div>
  );
}

function PersonalForm({ profile, onSave, saving }: FormProps) {
  const personal = profile.personal as Record<string, string | undefined>;
  const [values, setValues] = useState({
    mobile: profile.mobile ?? '',
    summary: profile.summary,
    dateOfBirth: personal['dateOfBirth'] ?? '',
    gender: personal['gender'] ?? 'undisclosed',
    guardianName: personal['guardianName'] ?? '',
    guardianMobile: personal['guardianMobile'] ?? '',
    addressLine: personal['addressLine'] ?? '',
    city: personal['city'] ?? '',
    state: personal['state'] ?? '',
    pincode: personal['pincode'] ?? '',
  });
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          mobile: values.mobile,
          summary: values.summary,
          personal: {
            dateOfBirth: values.dateOfBirth || null,
            gender: values.gender,
            guardianName: values.guardianName,
            guardianMobile: values.guardianMobile,
            addressLine: values.addressLine,
            city: values.city,
            state: values.state,
            pincode: values.pincode,
          },
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mobile" id="mobile">
          <Input
            id="mobile"
            value={values.mobile}
            onChange={(event) => set('mobile')(event.target.value)}
            placeholder="+919876543210"
          />
        </Field>
        <Field label="Date of birth" id="dateOfBirth">
          <Input
            id="dateOfBirth"
            type="date"
            value={values.dateOfBirth}
            onChange={(event) => set('dateOfBirth')(event.target.value)}
          />
        </Field>
        <Field label="Gender" id="gender">
          <select
            id="gender"
            value={values.gender}
            onChange={(event) => set('gender')(event.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="undisclosed">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Guardian's name" id="guardianName">
          <Input
            id="guardianName"
            value={values.guardianName}
            onChange={(event) => set('guardianName')(event.target.value)}
          />
        </Field>
        <Field label="Guardian's mobile" id="guardianMobile">
          <Input
            id="guardianMobile"
            value={values.guardianMobile}
            onChange={(event) => set('guardianMobile')(event.target.value)}
          />
        </Field>
        <Field label="City" id="city">
          <Input
            id="city"
            value={values.city}
            onChange={(event) => set('city')(event.target.value)}
          />
        </Field>
        <Field label="State" id="state">
          <Input
            id="state"
            value={values.state}
            onChange={(event) => set('state')(event.target.value)}
          />
        </Field>
        <Field label="Postal code" id="pincode">
          <Input
            id="pincode"
            value={values.pincode}
            onChange={(event) => set('pincode')(event.target.value)}
          />
        </Field>
      </div>
      <div className="mt-4 space-y-4">
        <Field label="Address" id="addressLine">
          <Input
            id="addressLine"
            value={values.addressLine}
            onChange={(event) => set('addressLine')(event.target.value)}
          />
        </Field>
        <Field label="About you" id="summary">
          <Textarea
            id="summary"
            rows={4}
            value={values.summary}
            onChange={(event) => set('summary')(event.target.value)}
            placeholder="A short paragraph about what you are studying and what you want to do next."
          />
        </Field>
      </div>
      <SaveBar saving={saving} />
    </form>
  );
}

function EducationForm({ profile, onSave, saving }: FormProps) {
  const [rows, setRows] = useState<StudentEducation[]>(
    () => (profile.education as StudentEducation[]) ?? [],
  );
  const update = (index: number, patch: Partial<StudentEducation>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ education: rows.filter((row) => row.qualification.trim().length > 0) });
      }}
    >
      <div className="space-y-4">
        {rows.map((row, index) => (
          <div key={index} className="rounded-lg border border-border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Qualification" id={`qualification-${index}`}>
                <Input
                  id={`qualification-${index}`}
                  value={row.qualification}
                  onChange={(event) => update(index, { qualification: event.target.value })}
                  placeholder="B.E. Computer Science"
                  required
                />
              </Field>
              <Field label="Institution" id={`institution-${index}`}>
                <Input
                  id={`institution-${index}`}
                  value={row.institution}
                  onChange={(event) => update(index, { institution: event.target.value })}
                />
              </Field>
              <Field label="Specialisation" id={`specialisation-${index}`}>
                <Input
                  id={`specialisation-${index}`}
                  value={row.specialisation}
                  onChange={(event) => update(index, { specialisation: event.target.value })}
                />
              </Field>
              <Field label="Year of passing" id={`year-${index}`}>
                <Input
                  id={`year-${index}`}
                  type="number"
                  value={row.yearOfPassing ?? ''}
                  onChange={(event) =>
                    update(index, {
                      yearOfPassing: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                />
              </Field>
              <Field label="Score (%)" id={`score-${index}`}>
                <Input
                  id={`score-${index}`}
                  type="number"
                  value={row.scorePercentage ?? ''}
                  onChange={(event) =>
                    update(index, {
                      scorePercentage: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                />
              </Field>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setRows((current) => [
              ...current,
              {
                qualification: '',
                institution: '',
                specialisation: '',
                yearOfPassing: null,
                scorePercentage: null,
              },
            ])
          }
        >
          Add a qualification
        </Button>
      </div>
      <SaveBar saving={saving} />
    </form>
  );
}

function ExperienceForm({ profile, onSave, saving }: FormProps) {
  const [rows, setRows] = useState<StudentExperience[]>(
    () => (profile.experience as StudentExperience[]) ?? [],
  );
  const update = (index: number, patch: Partial<StudentExperience>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ experience: rows.filter((row) => row.role.trim().length > 0) });
      }}
    >
      <div className="space-y-4">
        {rows.map((row, index) => (
          <div key={index} className="rounded-lg border border-border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Role" id={`role-${index}`}>
                <Input
                  id={`role-${index}`}
                  value={row.role}
                  onChange={(event) => update(index, { role: event.target.value })}
                  required
                />
              </Field>
              <Field label="Organisation" id={`organisation-${index}`}>
                <Input
                  id={`organisation-${index}`}
                  value={row.organisation}
                  onChange={(event) => update(index, { organisation: event.target.value })}
                />
              </Field>
              <Field label="From" id={`from-${index}`}>
                <Input
                  id={`from-${index}`}
                  type="date"
                  value={row.from ?? ''}
                  onChange={(event) => update(index, { from: event.target.value || null })}
                />
              </Field>
              <Field label="To" id={`to-${index}`}>
                <Input
                  id={`to-${index}`}
                  type="date"
                  value={row.to ?? ''}
                  disabled={row.current}
                  onChange={(event) => update(index, { to: event.target.value || null })}
                />
              </Field>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <Checkbox
                checked={row.current}
                onCheckedChange={(checked) =>
                  update(index, { current: checked === true, to: checked === true ? null : row.to })
                }
              />
              I am still doing this
            </label>
            <Field label="What you did" id={`summary-${index}`} className="mt-3">
              <Textarea
                id={`summary-${index}`}
                rows={2}
                value={row.summary}
                onChange={(event) => update(index, { summary: event.target.value })}
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setRows((current) => [
              ...current,
              { role: '', organisation: '', from: null, to: null, current: false, summary: '' },
            ])
          }
        >
          Add an entry
        </Button>
      </div>
      <SaveBar saving={saving} />
    </form>
  );
}

function SkillsForm({ profile, onSave, saving }: FormProps) {
  const [text, setText] = useState(() => profile.skills.join(', '));
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const skills = [
          ...new Set(
            text
              .split(',')
              .map((skill) => skill.trim())
              .filter(Boolean),
          ),
        ];
        onSave({ skills });
      }}
    >
      <Field label="Skills, separated by commas" id="skills">
        <Textarea
          id="skills"
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Java, SQL, HTML, Problem solving"
        />
      </Field>
      <SaveBar saving={saving} />
    </form>
  );
}

function LinksForm({ profile, onSave, saving }: FormProps) {
  const links = profile.links as Partial<ProfileLinks>;
  const [values, setValues] = useState({
    github: links.github ?? '',
    linkedin: links.linkedin ?? '',
    portfolio: links.portfolio ?? '',
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ links: values });
      }}
    >
      <div className="space-y-4">
        <Field label="GitHub" id="github">
          <Input
            id="github"
            type="url"
            value={values.github}
            onChange={(event) => setValues((v) => ({ ...v, github: event.target.value }))}
            placeholder="https://github.com/yourname"
          />
        </Field>
        <Field label="LinkedIn" id="linkedin">
          <Input
            id="linkedin"
            type="url"
            value={values.linkedin}
            onChange={(event) => setValues((v) => ({ ...v, linkedin: event.target.value }))}
          />
        </Field>
        <Field label="Portfolio" id="portfolio">
          <Input
            id="portfolio"
            type="url"
            value={values.portfolio}
            onChange={(event) => setValues((v) => ({ ...v, portfolio: event.target.value }))}
          />
        </Field>
      </div>
      <SaveBar saving={saving} />
    </form>
  );
}

function Field({
  label,
  id,
  className,
  children,
}: {
  label: string;
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
