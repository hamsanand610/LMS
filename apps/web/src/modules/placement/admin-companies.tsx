'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import type { CompanyCard, CompanyDetail } from '@lms/shared';
import { FieldError } from '@/components/field-error';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { humanise } from '@/lib/format';
import { PageHeader } from '@/shell/page-header';
import { CompanyLogo } from './company-logo';

/** The companies the institute works with, each with its interview-prep kit and its drives. */
export function AdminCompanies() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const params = new URLSearchParams({ view: 'all' });
  if (q.trim()) params.set('q', q.trim());
  const query = useQuery({
    queryKey: ['companies', params.toString()],
    queryFn: () => api<CompanyCard[]>(`/companies?${params.toString()}`),
  });
  const create = useMutation({
    mutationFn: () =>
      api<CompanyDetail>('/companies', { method: 'POST', body: { name, industry } }),
    onSuccess: (company) => {
      toast.success(`${company.name} added`);
      router.push(`/admin/companies/${company.id}`);
    },
    onError: (error: Error) => {
      if (isApiError(error)) setErrors(error.fieldErrors);
      toast.error(isApiError(error) ? error.message : 'The company could not be added');
    },
  });

  return (
    <>
      <PageHeader
        title="Companies"
        description="Company profiles, their interview-prep kits for learners, and the drives they run."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Add company
          </Button>
        }
      />
      <div className="space-y-4">
        <SearchInput
          wrapperClassName="w-full sm:w-72"
          placeholder="Search companies"
          aria-label="Search companies"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {query.isPending ? <LoadingRows rows={5} /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
        {query.data && query.data.length === 0 ? (
          <EmptyState
            title="No companies yet"
            description="Add a company to build its interview-prep kit and post its drives."
            action={<Button onClick={() => setCreating(true)}>Add company</Button>}
          />
        ) : null}
        {query.data && query.data.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Technologies</TableHead>
                  <TableHead className="text-right">Kit questions</TableHead>
                  <TableHead className="text-right">Open drives</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <CompanyLogo name={company.name} logoUrl={company.logoUrl} size="sm" />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/companies/${company.id}`}
                            className="font-medium text-foreground hover:text-brand hover:underline"
                          >
                            {company.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">{company.industry || '—'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-foreground-secondary">
                      {company.technologies.map(humanise).join(', ') || '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{company.kitSize}</TableCell>
                    <TableCell className="text-right tabular-nums">{company.openDrives}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a company</DialogTitle>
            <DialogDescription>
              Start with the name; the profile, logo and kit are on the next page.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setErrors({});
              create.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="company-name">Name</Label>
              <Input
                id="company-name"
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <FieldError message={errors['name']} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-industry">Industry</Label>
              <Input
                id="company-industry"
                maxLength={80}
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. IT services"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Adding…' : 'Add company'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
