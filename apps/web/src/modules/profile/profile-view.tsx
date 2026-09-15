'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ProfileLinks, ProfileView as ProfileViewData, StudentExperience } from '@lms/shared';
import { PROFILE_SECTION_LABELS, PROFILE_SECTIONS } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/http';
import { PageHeader } from '@/shell/page-header';

/**
 * The learner's own record (plan DP-S17). The completeness figure is the same one staff see, and
 * the page says which part of it is still missing rather than only showing a number (AC-12.3).
 */
export function ProfileView() {
  const query = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api<ProfileViewData>('/me/profile'),
  });

  if (query.isPending) return <LoadingRows rows={8} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const profile = query.data;

  const personal = profile.personal as Record<string, string | null | undefined>;
  const education = profile.education as {
    qualification: string;
    institution: string;
    specialisation: string;
    yearOfPassing: number | null;
    scorePercentage: number | null;
  }[];
  const experience = profile.experience as StudentExperience[];
  const links = profile.links as Partial<ProfileLinks>;
  const missing = profile.completenessParts.filter((part) => !part.done);

  return (
    <>
      <PageHeader
        title={profile.name}
        description={`${profile.studentCode} · ${profile.email}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/profile/resumes">Resumes</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/profile/documents">Documents</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Profile completeness</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{profile.completeness}%</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress
              value={profile.completeness}
              aria-label={`${profile.completeness} per cent complete`}
            />
            {missing.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Everything the institute asks for is filled in.
              </p>
            ) : (
              <div className="text-sm">
                <p className="text-muted-foreground">Still to add:</p>
                <ul className="mt-1 space-y-1">
                  {missing.map((part) => (
                    <li key={part.key} className="flex items-center gap-2">
                      <span aria-hidden>·</span>
                      {part.label}
                      <span className="text-xs text-muted-foreground">(worth {part.weight}%)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your record</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={profile.status} />
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Documents</span>
              <StatusBadge status={profile.verificationStatus} />
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Mobile</span>
              <span>{profile.mobile ?? 'Not given'}</span>
            </p>
            {profile.batches.length > 0 ? (
              <p className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Batch</span>
                <span>{profile.batches.map((batch) => batch.code).join(', ')}</span>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {PROFILE_SECTIONS.map((section) => (
            <TabsTrigger key={section} value={section}>
              {PROFILE_SECTION_LABELS[section]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">About you</CardTitle>
                <CardDescription>A paragraph a trainer or a recruiter reads first.</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/profile/edit/personal">Edit</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {profile.summary ? (
                <p className="whitespace-pre-wrap text-sm">{profile.summary}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing written yet.</p>
              )}
              {profile.skills.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.skills.map((skill) => (
                    <Badge key={skill} className="bg-muted text-muted-foreground">
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {profile.pending.length > 0 ? (
            <Card className="mt-4 border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-muted-foreground">Not in this build</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {profile.pending.map((item) => (
                  <p key={item.key}>
                    <span className="font-medium">{item.label}</span> — {item.reason}
                  </p>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="personal" className="pt-4">
          <Section title="Personal" section="personal">
            <Detail label="Date of birth" value={personal['dateOfBirth']} />
            <Detail label="Gender" value={personal['gender']} />
            <Detail label="Guardian" value={personal['guardianName']} />
            <Detail label="Guardian's mobile" value={personal['guardianMobile']} />
            <Detail label="Address" value={personal['addressLine']} />
            <Detail label="City" value={personal['city']} />
            <Detail label="State" value={personal['state']} />
            <Detail label="Postal code" value={personal['pincode']} />
          </Section>
        </TabsContent>

        <TabsContent value="education" className="pt-4">
          <Section title="Education" section="education">
            {education.length === 0 ? (
              <p className="text-sm text-muted-foreground">No qualification added yet.</p>
            ) : (
              <ul className="space-y-3">
                {education.map((entry, index) => (
                  <li key={`${entry.qualification}-${index}`} className="text-sm">
                    <p className="font-medium">{entry.qualification}</p>
                    <p className="text-muted-foreground">
                      {[entry.institution, entry.specialisation].filter(Boolean).join(' · ')}
                      {entry.yearOfPassing ? ` · ${entry.yearOfPassing}` : ''}
                      {entry.scorePercentage !== null ? ` · ${entry.scorePercentage}%` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="experience" className="pt-4">
          <Section title="Experience" section="experience">
            {experience.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing added yet.</p>
            ) : (
              <ul className="space-y-3">
                {experience.map((entry, index) => (
                  <li key={`${entry.role}-${index}`} className="text-sm">
                    <p className="font-medium">
                      {entry.role}
                      {entry.organisation ? ` · ${entry.organisation}` : ''}
                    </p>
                    <p className="text-muted-foreground">
                      {entry.from ?? '—'} to {entry.current ? 'now' : (entry.to ?? '—')}
                    </p>
                    {entry.summary ? <p className="mt-1">{entry.summary}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="skills" className="pt-4">
          <Section title="Skills" section="skills">
            {profile.skills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skills listed yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <Badge key={skill} className="bg-muted text-muted-foreground">
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="links" className="pt-4">
          <Section title="Links" section="links">
            <Detail label="GitHub" value={links.github} link />
            <Detail label="LinkedIn" value={links.linkedin} link />
            <Detail label="Portfolio" value={links.portfolio} link />
          </Section>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Section({
  title,
  section,
  children,
}: {
  title: string;
  section: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/profile/edit/${section}`}>Edit</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function Detail({
  label,
  value,
  link = false,
}: {
  label: string;
  value: string | null | undefined;
  link?: boolean;
}) {
  return (
    <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {value ? (
        link ? (
          <a href={value} target="_blank" rel="noreferrer" className="underline">
            {value}
          </a>
        ) : (
          <span>{value}</span>
        )
      ) : (
        <span className="text-muted-foreground">Not given</span>
      )}
    </p>
  );
}
