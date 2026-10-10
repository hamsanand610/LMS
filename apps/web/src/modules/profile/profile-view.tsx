'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Briefcase,
  Camera,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  ExternalLink,
  FileText,
  FolderGit2,
  FolderLock,
  GraduationCap,
  PenLine,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { toast } from 'sonner';
import type { ProfileLinks, ProfileView as ProfileViewData, StudentExperience } from '@lms/shared';
import { PROFILE_SECTION_LABELS, PROFILE_SECTIONS } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { ProgressRing } from '@/components/progress-ring';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { uploadFile } from '@/lib/files/upload';
import { PageHeader } from '@/shell/page-header';
import { initials } from '@/shell/user-menu';

/** Which editor section fills in each part of the completeness figure. */
const PART_SECTION: Record<string, string> = {
  mobile: 'personal',
  personal: 'personal',
  summary: 'personal',
  education: 'education',
  skills: 'skills',
  projects: 'projects',
};

/** The learner's photo, with a way to change or remove it. Images only, up to 2 MB. */
function ProfilePhoto({ name, url }: { name: string; url: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const router = useRouter();
  const change = useMutation({
    mutationFn: async (file: File | null) => {
      const fileId = file ? (await uploadFile('avatar', file)).id : null;
      return api('/me/profile/photo', { method: 'PUT', body: { fileId } });
    },
    onSuccess: async (_, file) => {
      await client.invalidateQueries({ queryKey: ['my-profile'] });
      router.refresh();
      toast.success(file ? 'Photo updated' : 'Photo removed');
    },
    onError: (error: Error) =>
      toast.error(isApiError(error) ? error.message : 'The photo could not be saved'),
  });
  return (
    <div className="flex shrink-0 flex-col items-start gap-2">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a user upload from object storage
        <img src={url} alt="" className="size-16 rounded-2xl object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-16 place-items-center rounded-2xl bg-nav text-xl font-semibold tracking-tight text-nav-foreground"
        >
          {initials(name) || '?'}
        </span>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          if (file.size > 2 * 1024 * 1024) {
            toast.error('Choose an image under 2 MB.');
            return;
          }
          change.mutate(file);
        }}
      />
      <div className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={change.isPending}
          onClick={() => input.current?.click()}
        >
          <Camera aria-hidden="true" />
          {change.isPending ? 'Saving…' : url ? 'Change photo' : 'Add photo'}
        </Button>
        {url ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={change.isPending}
            onClick={() => change.mutate(null)}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The learner's own record (plan DP-S17). The completeness figure is the same one staff see, and
 * the page says which part of it is still missing rather than only showing a number (AC-12.3);
 * each missing part links straight to the section that fills it.
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
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end">
        <ProfilePhoto name={profile.name} url={profile.avatarUrl} />
        <PageHeader
          className="mb-0 min-w-0 flex-1"
          eyebrow="Your profile"
          title={profile.name}
          description={`${profile.studentCode} · ${profile.email}`}
          actions={
            <>
              <Button variant="outline" asChild>
                <Link href="/profile/resumes">
                  <FileText aria-hidden="true" />
                  Resumes
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/profile/documents">
                  <FolderLock aria-hidden="true" />
                  Documents
                </Link>
              </Button>
            </>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Tabs defaultValue="overview" className="min-w-0">
          <TabsList aria-label="Profile sections" className="gap-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {PROFILE_SECTIONS.map((section) => (
              <TabsTrigger key={section} value={section}>
                {PROFILE_SECTION_LABELS[section]}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Section
              title="About you"
              description="A paragraph a trainer or a recruiter reads first."
              section="personal"
            >
              {profile.summary ? (
                <p className="max-w-(--reading-max) text-sm leading-relaxed whitespace-pre-wrap text-foreground-secondary">
                  {profile.summary}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing written yet.</p>
              )}
              {profile.skills.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2" aria-label="Skills">
                  {profile.skills.map((skill) => (
                    <li key={skill}>
                      <SkillChip>{skill}</SkillChip>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Section>

            {profile.pending.length > 0 ? (
              <section className="rounded-xl border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
                <h2 className="mb-2 text-sm font-semibold text-foreground-secondary">
                  Not available yet
                </h2>
                <ul className="space-y-1">
                  {profile.pending.map((item) => (
                    <li key={item.key}>
                      <span className="font-medium">{item.label}</span> — {item.reason}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </TabsContent>

          <TabsContent value="personal">
            <Section title="Personal" section="personal">
              <dl className="grid gap-x-8 sm:grid-cols-2">
                <Detail label="Date of birth" value={personal['dateOfBirth']} />
                <Detail label="Gender" value={personal['gender']} />
                <Detail label="Guardian" value={personal['guardianName']} />
                <Detail label="Guardian's mobile" value={personal['guardianMobile']} />
                <Detail label="Address" value={personal['addressLine']} />
                <Detail label="City" value={personal['city']} />
                <Detail label="State" value={personal['state']} />
                <Detail label="Postal code" value={personal['pincode']} />
              </dl>
            </Section>
          </TabsContent>

          <TabsContent value="education">
            <Section title="Education" section="education">
              {education.length === 0 ? (
                <p className="text-sm text-muted-foreground">No qualification added yet.</p>
              ) : (
                <ol className="space-y-4">
                  {education.map((entry, index) => (
                    <li key={`${entry.qualification}-${index}`} className="flex gap-3 text-sm">
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
                        <GraduationCap className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{entry.qualification}</p>
                        <p className="text-muted-foreground">
                          {[entry.institution, entry.specialisation].filter(Boolean).join(' · ')}
                          {entry.yearOfPassing ? ` · ${entry.yearOfPassing}` : ''}
                          {entry.scorePercentage !== null ? ` · ${entry.scorePercentage}%` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          </TabsContent>

          <TabsContent value="experience">
            <Section title="Experience" section="experience">
              {experience.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing added yet.</p>
              ) : (
                <ol className="space-y-4">
                  {experience.map((entry, index) => (
                    <li key={`${entry.role}-${index}`} className="flex gap-3 text-sm">
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
                        <Briefcase className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {entry.role}
                          {entry.organisation ? ` · ${entry.organisation}` : ''}
                        </p>
                        <p className="text-muted-foreground">
                          {entry.from ?? '—'} to {entry.current ? 'now' : (entry.to ?? '—')}
                        </p>
                        {entry.summary ? (
                          <p className="mt-1 leading-relaxed text-foreground-secondary">
                            {entry.summary}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          </TabsContent>

          <TabsContent value="projects">
            <Section
              title="Projects"
              description="What you have built, newest first."
              section="projects"
            >
              {profile.projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing added yet.</p>
              ) : (
                <ol className="space-y-5">
                  {profile.projects.map((project, index) => (
                    <li key={`${project.title}-${index}`} className="flex gap-3 text-sm">
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
                        <FolderGit2 className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {project.link ? (
                            <a
                              href={project.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 hover:text-brand hover:underline"
                            >
                              {project.title}
                              <ExternalLink className="size-3.5" aria-hidden="true" />
                              <span className="sr-only">(opens in a new tab)</span>
                            </a>
                          ) : (
                            project.title
                          )}
                        </p>
                        {project.description ? (
                          <p className="mt-1 leading-relaxed whitespace-pre-wrap text-foreground-secondary">
                            {project.description}
                          </p>
                        ) : null}
                        {project.technologies.length > 0 ? (
                          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Technologies">
                            {project.technologies.map((tech) => (
                              <li key={tech}>
                                <SkillChip>{tech}</SkillChip>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          </TabsContent>

          <TabsContent value="certifications">
            <Section
              title="Certificates"
              description="Earned outside the institute."
              section="certifications"
            >
              {profile.certifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing added yet.</p>
              ) : (
                <ol className="space-y-4">
                  {profile.certifications.map((cert, index) => (
                    <li key={`${cert.title}-${index}`} className="flex gap-3 text-sm">
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
                        <Award className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{cert.title}</p>
                        <p className="text-muted-foreground">
                          {[cert.issuer, cert.year].filter(Boolean).join(' · ') || '—'}
                        </p>
                        {cert.link ? (
                          <a
                            href={cert.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline"
                          >
                            Verify
                            <ExternalLink className="size-3.5" aria-hidden="true" />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          </TabsContent>

          <TabsContent value="skills">
            <Section title="Skills" section="skills">
              {profile.skills.length === 0 ? (
                <p className="text-sm text-muted-foreground">No skills listed yet.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {profile.skills.map((skill) => (
                    <li key={skill}>
                      <SkillChip>{skill}</SkillChip>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </TabsContent>

          <TabsContent value="links">
            <Section title="Links" section="links">
              <dl>
                <Detail label="GitHub" value={links.github} link />
                <Detail label="LinkedIn" value={links.linkedin} link />
                <Detail label="Portfolio" value={links.portfolio} link />
              </dl>
            </Section>
          </TabsContent>
        </Tabs>

        <aside className="space-y-4 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)]">
          <section
            aria-labelledby="completeness-heading"
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center gap-4">
              <ProgressRing
                value={profile.completeness}
                size={64}
                stroke={6}
                label={`${profile.completeness} per cent complete`}
              />
              <div className="min-w-0">
                <h2 id="completeness-heading" className="text-sm font-semibold text-foreground">
                  Profile completeness
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {missing.length === 0
                    ? 'Everything the institute asks for is filled in.'
                    : 'The same figure your trainers see.'}
                </p>
              </div>
            </div>
            {missing.length > 0 ? (
              <ul className="mt-4 space-y-0.5 border-t border-border pt-3">
                {profile.completenessParts.map((part) => (
                  <li key={part.key}>
                    {part.done ? (
                      <p className="flex items-center gap-2.5 px-2 py-1.5 text-sm text-muted-foreground">
                        <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
                        <span className="min-w-0 flex-1">{part.label}</span>
                        <span className="sr-only">(done)</span>
                      </p>
                    ) : (
                      <Link
                        href={`/profile/edit/${PART_SECTION[part.key] ?? 'personal'}`}
                        className="group/part flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-2"
                      >
                        <CircleDashed
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">{part.label}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          worth {part.weight}%
                        </span>
                        <ChevronRight
                          className="size-3.5 text-muted-foreground transition-transform group-hover/part:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section
            aria-labelledby="record-heading"
            className="rounded-xl border border-border bg-card p-5"
          >
            <h2 id="record-heading" className="text-sm font-semibold text-foreground">
              Your record
            </h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={profile.status} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Documents</dt>
                <dd>
                  <StatusBadge status={profile.verificationStatus} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Mobile</dt>
                <dd className="tabular-nums">{profile.mobile ?? 'Not given'}</dd>
              </div>
              {profile.batches.length > 0 ? (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Batch</dt>
                  <dd className="text-right">
                    {profile.batches.map((batch) => batch.code).join(', ')}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}

function SkillChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center rounded-full border border-border bg-surface-2/60 px-3 text-[13px] text-foreground-secondary">
      {children}
    </span>
  );
}

function Section({
  title,
  description,
  section,
  children,
}: {
  title: string;
  description?: string;
  section: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/profile/edit/${section}`}>
            <PenLine aria-hidden="true" />
            Edit<span className="sr-only"> {title.toLowerCase()}</span>
          </Link>
        </Button>
      </div>
      <div className="px-5 py-4 sm:px-6">{children}</div>
    </section>
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
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-border/70 py-2.5 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right break-words text-foreground">
        {value ? (
          link ? (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-brand underline-offset-4 hover:underline"
            >
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          <span className="text-muted-foreground">Not given</span>
        )}
      </dd>
    </div>
  );
}
