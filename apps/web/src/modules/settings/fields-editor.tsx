'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type { TaxonomyKey, TaxonomyTerm } from '@lms/shared';
import { TAXONOMY_KEYS, TAXONOMY_LABELS } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import { CustomFieldsEditor } from './custom-fields-table';

/**
 * The two kinds of "field" a client controls (plan DP-A32): the vocabularies records choose from,
 * and the extra fields an institute needs on its own forms. A record stores the term's key, so
 * renaming a label never touches the records that use it.
 */
export function FieldsEditor() {
  return (
    <Tabs defaultValue="taxonomies">
      <TabsList>
        <TabsTrigger value="taxonomies">Vocabularies</TabsTrigger>
        <TabsTrigger value="custom">Custom fields</TabsTrigger>
      </TabsList>
      <TabsContent value="taxonomies" className="pt-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {TAXONOMY_KEYS.map((key) => (
            <TaxonomyCard key={key} taxonomy={key} />
          ))}
        </div>
      </TabsContent>
      <TabsContent value="custom" className="pt-4">
        <CustomFieldsEditor />
      </TabsContent>
    </Tabs>
  );
}

function TaxonomyCard({ taxonomy }: { taxonomy: TaxonomyKey }) {
  const client = useQueryClient();
  const [label, setLabel] = useState('');
  const query = useQuery({
    queryKey: ['taxonomy', taxonomy],
    queryFn: () => api<TaxonomyTerm[]>(`/taxonomies/${taxonomy}/terms`),
  });

  const invalidate = () => client.invalidateQueries({ queryKey: ['taxonomy', taxonomy] });
  const fail = (error: Error) =>
    toast.error(isApiError(error) ? error.message : 'Could not save that');

  const add = useMutation({
    mutationFn: () =>
      api<TaxonomyTerm>(`/taxonomies/${taxonomy}/terms`, {
        method: 'POST',
        body: { label: label.trim() },
      }),
    onSuccess: () => {
      setLabel('');
      toast.success('Term added');
      void invalidate();
    },
    onError: fail,
  });

  const archive = useMutation({
    mutationFn: (id: string) => api(`/taxonomies/${taxonomy}/terms/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Term archived');
      void invalidate();
    },
    onError: fail,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{TAXONOMY_LABELS[taxonomy]}</CardTitle>
        <CardDescription>
          Records store the term&apos;s key, so renaming a label never touches what uses it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isPending ? <LoadingRows rows={3} /> : null}
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : null}
        {query.data ? (
          <ul className="space-y-1">
            {query.data.map((term) => (
              <li
                key={term.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{term.label}</span>
                <code className="text-xs text-muted-foreground">{term.key}</code>
                {term.archived ? (
                  <Badge className="bg-muted text-muted-foreground">Archived</Badge>
                ) : null}
                {term.archived ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => archive.mutate(term.id)}
                    disabled={archive.isPending}
                  >
                    Archive
                  </Button>
                )}
              </li>
            ))}
            {query.data.length === 0 ? (
              <li className="text-sm text-muted-foreground">No terms yet.</li>
            ) : null}
          </ul>
        ) : null}

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate();
          }}
        >
          <div className="flex-1">
            <Label htmlFor={`term-${taxonomy}`} className="sr-only">
              New {TAXONOMY_LABELS[taxonomy]} term
            </Label>
            <Input
              id={`term-${taxonomy}`}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={`Add to ${TAXONOMY_LABELS[taxonomy].toLowerCase()}`}
            />
          </div>
          <Button type="submit" size="sm" disabled={add.isPending || label.trim().length === 0}>
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
