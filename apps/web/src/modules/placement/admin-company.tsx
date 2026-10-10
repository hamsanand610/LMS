'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ImageUp, Plus, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { CompanyDetail, KitCandidate } from '@lms/shared';
import { DifficultyBadge } from '@/components/difficulty-badge';
import { FieldError } from '@/components/field-error';
import { ErrorState, LoadingRows } from '@/components/page-states';
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
import { SearchInput } from '@/components/ui/search-input';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { uploadFile } from '@/lib/files/upload';
import { PageHeader } from '@/shell/page-header';
import { CompanyLogo } from './company-logo';

interface KitRow {
  questionId: string;
  title: string;
  difficulty: string;
  topic: string;
}

/** A company for staff: its profile and logo, and the ordered kit learners practise from. */
export function AdminCompany({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['company', 'staff', id],
    queryFn: () => api<CompanyDetail>(`/companies/${id}`),
  });
  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return <CompanyEditor key={query.dataUpdatedAt} company={query.data} />;
}

function CompanyEditor({ company }: { company: CompanyDetail }) {
  const router = useRouter();
  const client = useQueryClient();
  const logoInput = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState({
    name: company.name,
    industry: company.industry,
    website: company.website,
    description: company.description,
    technologies: company.technologies.join(', '),
    logoFileId: company.logoFileId,
  });
  const [logoPreview, setLogoPreview] = useState(company.logoUrl);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [kit, setKit] = useState<KitRow[]>(() =>
    company.kit.map((item) => ({
      questionId: item.questionId,
      title: item.title,
      difficulty: item.difficulty,
      topic: item.topic,
    })),
  );
  const [picking, setPicking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['company'] });
    void client.invalidateQueries({ queryKey: ['companies'] });
  };

  const saveProfile = useMutation({
    mutationFn: () =>
      api<CompanyDetail>(`/companies/${company.id}`, {
        method: 'PUT',
        body: {
          name: profile.name,
          industry: profile.industry,
          website: profile.website,
          description: profile.description,
          logoFileId: profile.logoFileId,
          technologies: [
            ...new Set(
              profile.technologies
                .split(',')
                .map((t) => t.trim().toLowerCase().replace(/\s+/g, '-'))
                .filter(Boolean),
            ),
          ],
        },
      }),
    onSuccess: () => {
      setErrors({});
      refresh();
      toast.success('Profile saved');
    },
    onError: (error: Error) => {
      if (isApiError(error)) setErrors(error.fieldErrors);
      toast.error(isApiError(error) ? error.message : 'The profile could not be saved');
    },
  });
  const uploadLogo = useMutation({
    mutationFn: (file: File) => uploadFile('company-logo', file),
    onSuccess: (file) => {
      setProfile((p) => ({ ...p, logoFileId: file.id }));
      setLogoPreview(file.url);
      toast.success('Logo uploaded. Save the profile to keep it.');
    },
    onError: (error: Error) =>
      toast.error(isApiError(error) ? error.message : 'The logo could not be uploaded'),
  });
  const saveKit = useMutation({
    mutationFn: () =>
      api<CompanyDetail>(`/companies/${company.id}/kit`, {
        method: 'PUT',
        body: { items: kit.map((row) => ({ questionId: row.questionId, topic: row.topic })) },
      }),
    onSuccess: () => {
      refresh();
      toast.success('Kit saved');
    },
    onError: (error: Error) =>
      toast.error(isApiError(error) ? error.message : 'The kit could not be saved'),
  });
  const remove = useMutation({
    mutationFn: () => api(`/companies/${company.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Company removed');
      router.push('/admin/companies');
    },
    onError: (error: Error) =>
      toast.error(isApiError(error) ? error.message : 'The company could not be removed'),
  });

  const move = (from: number, to: number) =>
    setKit((rows) => {
      const next = [...rows];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row!);
      return next;
    });

  return (
    <>
      <PageHeader
        back={{ href: '/admin/companies', label: 'Companies' }}
        eyebrow={company.industry || 'Company'}
        title={company.name}
        description={`${company.kitSize} kit questions · ${company.openDrives} open drives`}
        actions={
          <Button variant="ghost" onClick={() => setRemoving(true)}>
            <Trash2 aria-hidden="true" />
            Remove
          </Button>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>What learners read on the company’s kit page.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveProfile.mutate();
              }}
            >
              <div className="flex items-center gap-4">
                <CompanyLogo name={profile.name || company.name} logoUrl={logoPreview} size="lg" />
                <input
                  ref={logoInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) uploadLogo.mutate(file);
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadLogo.isPending}
                    onClick={() => logoInput.current?.click()}
                  >
                    <ImageUp aria-hidden="true" />
                    {uploadLogo.isPending ? 'Uploading…' : 'Upload logo'}
                  </Button>
                  {profile.logoFileId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setProfile((p) => ({ ...p, logoFileId: null }));
                        setLogoPreview(null);
                      }}
                    >
                      Remove logo
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Only a logo the company has allowed you to use. Up to 1 MB.
              </p>
              <div className="space-y-2">
                <Label htmlFor="c-name">Name</Label>
                <Input
                  id="c-name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                />
                <FieldError message={errors['name']} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-industry">Industry</Label>
                <Input
                  id="c-industry"
                  maxLength={80}
                  value={profile.industry}
                  onChange={(e) => setProfile((p) => ({ ...p, industry: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-website">Website</Label>
                <Input
                  id="c-website"
                  type="url"
                  value={profile.website}
                  onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))}
                  placeholder="https://"
                />
                <FieldError message={errors['website']} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-tech">Technologies the kit covers, separated by commas</Label>
                <Input
                  id="c-tech"
                  value={profile.technologies}
                  onChange={(e) => setProfile((p) => ({ ...p, technologies: e.target.value }))}
                  placeholder="core-java, sql, data-structures"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-description">About the company and how it hires</Label>
                <Textarea
                  id="c-description"
                  rows={5}
                  maxLength={2000}
                  value={profile.description}
                  onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <Button type="submit" disabled={saveProfile.isPending}>
                {saveProfile.isPending ? 'Saving…' : 'Save profile'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interview-prep kit</CardTitle>
            <CardDescription>
              Practice problems in the order learners should meet them, each with a topic. Only
              published practice problems can be added.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {kit.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                The kit is empty. Add practice problems to start it.
              </p>
            ) : (
              <ol className="divide-y divide-border rounded-lg border border-border">
                {kit.map((row, index) => (
                  <li
                    key={row.questionId}
                    className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-[1.5rem_minmax(0,1fr)_8.5rem_auto]"
                  >
                    <span className="text-center text-xs font-semibold text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium">{row.title}</span>
                      <DifficultyBadge value={row.difficulty} />
                    </span>
                    <Input
                      aria-label={`Topic for ${row.title}`}
                      className="col-start-2 h-8 sm:col-start-auto"
                      maxLength={80}
                      placeholder="Topic"
                      value={row.topic}
                      onChange={(e) =>
                        setKit((rows) =>
                          rows.map((r, i) => (i === index ? { ...r, topic: e.target.value } : r)),
                        )
                      }
                    />
                    <span className="col-start-2 flex gap-0.5 sm:col-start-auto">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === 0}
                        aria-label={`Move ${row.title} up`}
                        onClick={() => move(index, index - 1)}
                      >
                        <ArrowUp aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === kit.length - 1}
                        aria-label={`Move ${row.title} down`}
                        onClick={() => move(index, index + 1)}
                      >
                        <ArrowDown aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${row.title} from the kit`}
                        onClick={() => setKit((rows) => rows.filter((_, i) => i !== index))}
                      >
                        <X aria-hidden="true" />
                      </Button>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setPicking(true)}>
                <Plus aria-hidden="true" />
                Add problems
              </Button>
              <Button type="button" disabled={saveKit.isPending} onClick={() => saveKit.mutate()}>
                {saveKit.isPending ? 'Saving…' : 'Save kit'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {picking ? (
        <ProblemPicker
          taken={new Set(kit.map((r) => r.questionId))}
          onClose={() => setPicking(false)}
          onPick={(candidate) =>
            setKit((rows) => [
              ...rows,
              {
                questionId: candidate.questionId,
                title: candidate.title,
                difficulty: candidate.difficulty,
                topic: candidate.topic,
              },
            ])
          }
        />
      ) : null}

      <Dialog open={removing} onOpenChange={setRemoving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {company.name}?</DialogTitle>
            <DialogDescription>
              Its kit disappears for learners. A company with an open drive cannot be removed: close
              the drive first. Past drives and applications are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProblemPicker({
  taken,
  onPick,
  onClose,
}: {
  taken: Set<string>;
  onPick: (candidate: KitCandidate) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const query = useQuery({
    queryKey: ['kit-candidates', q.trim()],
    queryFn: () =>
      api<KitCandidate[]>(
        `/companies/kit-candidates${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`,
      ),
  });
  const [added, setAdded] = useState<Set<string>>(new Set());
  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add practice problems</DialogTitle>
          <DialogDescription>
            Published problems from the practice catalogue. Save the kit when you are done.
          </DialogDescription>
        </DialogHeader>
        <SearchInput
          placeholder="Search by title, subject or topic"
          aria-label="Search problems"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {query.isPending ? <LoadingRows rows={4} /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
        {query.data && query.data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No problem matches.</p>
        ) : null}
        <ul className="divide-y divide-border rounded-lg border border-border">
          {(query.data ?? []).map((candidate) => {
            const inKit = taken.has(candidate.questionId) || added.has(candidate.questionId);
            return (
              <li key={candidate.questionId} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{candidate.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[candidate.subject, candidate.topic].filter(Boolean).join(' · ') || '—'} ·{' '}
                    {candidate.points} points
                  </span>
                </span>
                <DifficultyBadge value={candidate.difficulty} />
                <Button
                  size="sm"
                  variant={inKit ? 'ghost' : 'outline'}
                  disabled={inKit}
                  onClick={() => {
                    onPick(candidate);
                    setAdded((current) => new Set(current).add(candidate.questionId));
                  }}
                >
                  {inKit ? 'In the kit' : 'Add'}
                </Button>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
