'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  formatDateTime,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationItem,
  type NotificationPreference,
  type Paginated,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import { useMe } from '@/shell/me-context';

const ALL = 'all';

export function NotificationCentre() {
  return (
    <Tabs defaultValue="inbox">
      <TabsList>
        <TabsTrigger value="inbox">Inbox</TabsTrigger>
        <TabsTrigger value="preferences">Preferences</TabsTrigger>
      </TabsList>
      <TabsContent value="inbox">
        <Inbox />
      </TabsContent>
      <TabsContent value="preferences">
        <Preferences />
      </TabsContent>
    </Tabs>
  );
}

function Inbox() {
  const me = useMe();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState(ALL);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (category !== ALL) params.set('category', category);
  if (unreadOnly) params.set('unread', 'true');

  const query = useQuery({
    queryKey: ['notifications', params.toString()],
    queryFn: () => api<Paginated<NotificationItem>>(`/me/notifications?${params.toString()}`),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    void queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/me/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: refresh,
  });
  const markAll = useMutation({
    mutationFn: () => api<{ marked: number }>('/me/notifications/read-all', { method: 'POST' }),
    onSuccess: (result) => {
      refresh();
      toast.success(`${result.marked} marked as read`);
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Could not mark them read'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {NOTIFICATION_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={unreadOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setUnreadOnly((v) => !v);
            setPage(1);
          }}
        >
          Unread only
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          disabled={markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          Mark all read
        </Button>
      </div>

      {query.isPending ? (
        <LoadingRows rows={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          title={unreadOnly ? 'Nothing unread' : 'No notifications yet'}
          description="Messages about your batch, your work and announcements appear here."
        />
      ) : (
        <>
          <ul className="space-y-2">
            {query.data.data.map((item) => (
              <li
                key={item.id}
                className={cn(
                  'rounded-lg border border-border p-4',
                  item.readAt ? 'bg-card' : 'border-primary/30 bg-primary-soft/30',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={cn('text-sm', item.readAt ? '' : 'font-semibold')}>
                      {item.title}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                      {item.body}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="mr-2 capitalize">
                        {item.category}
                      </Badge>
                      {formatDateTime(item.createdAt, { timeZone: me.organization.timezone })}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {item.link ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={item.link}>Open</Link>
                      </Button>
                    ) : null}
                    {item.readAt ? null : (
                      <Button variant="ghost" size="sm" onClick={() => markRead.mutate(item.id)}>
                        Mark read
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <PaginationBar
            page={query.data.meta.page}
            pageSize={query.data.meta.pageSize}
            total={query.data.meta.total}
            onPageChange={setPage}
            noun="notifications"
          />
        </>
      )}
    </div>
  );
}

const CATEGORY_HELP: Record<NotificationCategory, string> = {
  account: 'Invitations, password changes and sign-in alerts.',
  batch: 'Your batch starting, joining or changing.',
  announcement: 'Broadcasts from the institute.',
  content: 'New courses and lessons published to you.',
  assessment: 'Assignments, tests and results.',
  attendance: 'Attendance marks and threshold warnings.',
};

export function Preferences() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => api<NotificationPreference[]>('/me/notifications/preferences'),
  });
  const save = useMutation({
    mutationFn: (preference: NotificationPreference) =>
      api<NotificationPreference[]>('/me/notifications/preferences', {
        method: 'PATCH',
        body: { preferences: [preference] },
      }),
    onSuccess: (preferences) => {
      queryClient.setQueryData(['notification-preferences'], preferences);
      toast.success('Preference saved');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'Could not save the preference'),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">How you are told</CardTitle>
        <CardDescription>
          Account messages always reach you in the app; email can be switched off per category.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.data.map((preference) => (
          <div
            key={preference.category}
            className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border p-3"
          >
            <div className="min-w-48">
              <p className="text-sm font-medium capitalize">{preference.category}</p>
              <p className="text-xs text-muted-foreground">{CATEGORY_HELP[preference.category]}</p>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                In app
                <Switch
                  checked={preference.inApp}
                  onCheckedChange={(v) => save.mutate({ ...preference, inApp: v })}
                  aria-label={`In-app notifications for ${preference.category}`}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                Email
                <Switch
                  checked={preference.email}
                  onCheckedChange={(v) => save.mutate({ ...preference, email: v })}
                  aria-label={`Email notifications for ${preference.category}`}
                />
              </label>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
