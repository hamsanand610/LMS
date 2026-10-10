'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ContentPageRecord, EmailTemplateKey, EmailTemplateRecord } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';

/** Email wording and the institute's own pages (plan DP-A33). */
export function TemplatesEditor() {
  return (
    <Tabs defaultValue="emails">
      <TabsList>
        <TabsTrigger value="emails">Emails</TabsTrigger>
        <TabsTrigger value="pages">Pages</TabsTrigger>
      </TabsList>
      <TabsContent value="emails" className="pt-4">
        <EmailTemplates />
      </TabsContent>
      <TabsContent value="pages" className="pt-4">
        <ContentPages />
      </TabsContent>
    </Tabs>
  );
}

function EmailTemplates() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => api<EmailTemplateRecord[]>('/templates'),
  });

  const write = (records: EmailTemplateRecord[]) =>
    client.setQueryData(['email-templates'], records);
  const fail = (error: Error) =>
    toast.error(isApiError(error) ? error.message : 'Could not save that');

  const save = useMutation({
    mutationFn: (input: { key: EmailTemplateKey; subject: string; body: string }) =>
      api<EmailTemplateRecord[]>(`/templates/${input.key}`, {
        method: 'PATCH',
        body: { subject: input.subject, body: input.body },
      }),
    onSuccess: (records) => {
      write(records);
      toast.success('Wording saved');
    },
    onError: fail,
  });

  const reset = useMutation({
    mutationFn: (key: EmailTemplateKey) =>
      api<EmailTemplateRecord[]>(`/templates/${key}`, { method: 'DELETE' }),
    onSuccess: (records) => {
      write(records);
      toast.success('Back to the platform’s own wording');
    },
    onError: fail,
  });

  const test = useMutation({
    mutationFn: (input: { key: EmailTemplateKey; to: string }) =>
      api(`/templates/${input.key}/test`, { method: 'POST', body: { to: input.to } }),
    onSuccess: (_data, input) => toast.success(`Test sent to ${input.to}.`),
    onError: fail,
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <div className="space-y-4">
      {query.data.map((template) => (
        <TemplateCard
          key={template.key}
          template={template}
          onSave={(subject, body) => save.mutate({ key: template.key, subject, body })}
          onReset={() => reset.mutate(template.key)}
          onTest={(to) => test.mutate({ key: template.key, to })}
          busy={save.isPending || reset.isPending || test.isPending}
        />
      ))}
    </div>
  );
}

function TemplateCard({
  template,
  onSave,
  onReset,
  onTest,
  busy,
}: {
  template: EmailTemplateRecord;
  onSave: (subject: string, body: string) => void;
  onReset: () => void;
  onTest: (to: string) => void;
  busy: boolean;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [to, setTo] = useState('');

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{template.label}</CardTitle>
          {template.isCustomised ? (
            <Badge className="bg-muted text-muted-foreground">Edited</Badge>
          ) : null}
        </div>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor={`subject-${template.key}`}>Subject</Label>
          <Input
            id={`subject-${template.key}`}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`body-${template.key}`}>Message</Label>
          <Textarea
            id={`body-${template.key}`}
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            You can use: {template.variables.map((name) => `{{${name}}}`).join(', ')}. The layout,
            the button and the footer stay the platform&apos;s.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button size="sm" onClick={() => onSave(subject, body)} disabled={busy}>
            Save
          </Button>
          {template.isCustomised ? (
            <Button variant="outline" size="sm" onClick={onReset} disabled={busy}>
              Reset to default
            </Button>
          ) : null}
          <div className="ml-auto flex items-end gap-2">
            <div>
              <Label htmlFor={`test-${template.key}`} className="text-xs">
                Send a test to
              </Label>
              <Input
                id={`test-${template.key}`}
                type="email"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="you@example.com"
                className="h-9 w-56"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTest(to)}
              disabled={busy || to.trim().length === 0}
            >
              Send test
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ContentPages() {
  const client = useQueryClient();
  const [draft, setDraft] = useState({ slug: '', title: '' });
  const query = useQuery({
    queryKey: ['content-pages'],
    queryFn: () => api<ContentPageRecord[]>('/content-pages'),
  });

  const invalidate = () => client.invalidateQueries({ queryKey: ['content-pages'] });
  const fail = (error: Error) =>
    toast.error(isApiError(error) ? error.message : 'Could not save that');

  const create = useMutation({
    mutationFn: () =>
      api<ContentPageRecord>('/content-pages', {
        method: 'POST',
        body: { slug: draft.slug.trim(), title: draft.title.trim(), body: '', isPublished: false },
      }),
    onSuccess: () => {
      setDraft({ slug: '', title: '' });
      toast.success('Page created');
      void invalidate();
    },
    onError: fail,
  });

  if (query.isPending) return <LoadingRows rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <div className="space-y-4">
      {query.data.map((page) => (
        <PageCard key={page.id} page={page} onChanged={invalidate} />
      ))}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Add a page</CardTitle>
          <CardDescription>
            It appears at <code>/pages/&lt;address&gt;</code> once it is published. Until a page at{' '}
            <code>privacy</code> or <code>terms</code> is published, those addresses show the
            platform&apos;s built-in Privacy Policy and Terms of Service drafts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <div>
              <Label htmlFor="new-slug">Address</Label>
              <Input
                id="new-slug"
                value={draft.slug}
                onChange={(event) => setDraft((d) => ({ ...d, slug: event.target.value }))}
                placeholder="refund-policy"
              />
            </div>
            <div className="min-w-48 flex-1">
              <Label htmlFor="new-title">Title</Label>
              <Input
                id="new-title"
                value={draft.title}
                onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
                placeholder="Refund policy"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={create.isPending || !draft.slug.trim() || !draft.title.trim()}
            >
              Create
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function PageCard({ page, onChanged }: { page: ContentPageRecord; onChanged: () => void }) {
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [isPublished, setPublished] = useState(page.isPublished);

  const save = useMutation({
    mutationFn: () =>
      api<ContentPageRecord>(`/content-pages/${page.id}`, {
        method: 'PATCH',
        body: { title, body, isPublished },
      }),
    onSuccess: () => {
      toast.success('Page saved');
      onChanged();
    },
    onError: (error: Error) =>
      toast.error(isApiError(error) ? error.message : 'Could not save that'),
  });

  const remove = useMutation({
    mutationFn: () => api(`/content-pages/${page.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Page removed');
      onChanged();
    },
    onError: (error: Error) =>
      toast.error(isApiError(error) ? error.message : 'Could not remove that'),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{page.title}</CardTitle>
          <code className="text-xs text-muted-foreground">/pages/{page.slug}</code>
          {page.isPublished ? (
            <Badge className="bg-success-soft text-success">Published</Badge>
          ) : (
            <Badge className="bg-muted text-muted-foreground">Draft</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor={`title-${page.id}`}>Title</Label>
          <Input
            id={`title-${page.id}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`body-${page.id}`}>Words</Label>
          <Textarea
            id={`body-${page.id}`}
            rows={8}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            aria-describedby={`body-hint-${page.id}`}
          />
          <p id={`body-hint-${page.id}`} className="mt-1.5 text-xs text-muted-foreground">
            A blank line starts a paragraph; <code>## </code> and <code>### </code> start headings;{' '}
            <code>- </code> starts a list item; <code>**words**</code> are bold.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={isPublished}
            onCheckedChange={(checked) => setPublished(checked === true)}
          />
          Anybody may read it
        </label>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
          >
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
