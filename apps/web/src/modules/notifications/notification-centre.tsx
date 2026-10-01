'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BookOpen,
  Briefcase,
  CalendarCheck,
  Check,
  CheckCheck,
  ClipboardCheck,
  KeyRound,
  Megaphone,
  MessageCircleQuestion,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  formatDateTime,
  NOTIFICATION_CATEGORIES,
  toLocalDateKey,
  type NotificationCategory,
  type NotificationItem,
  type NotificationPreference,
  type Paginated,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { PaginationBar } from '@/components/pagination-bar';
import { Button } from '@/components/ui/button';
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
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';
import { useMe } from '@/shell/me-context';

const ALL = 'all';

const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
  account: KeyRound,
  batch: Users,
  announcement: Megaphone,
  content: BookOpen,
  assessment: ClipboardCheck,
  attendance: CalendarCheck,
  placement: Briefcase,
  support: MessageCircleQuestion,
};

export function NotificationCentre() {
  return (
    <Tabs defaultValue="inbox">
      <TabsList aria-label="Notifications">
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

/** Today, yesterday, earlier this week, older — by calendar day in the institute's zone. */
function periodGroups(
  items: NotificationItem[],
  now: number | null,
): { label: string; items: NotificationItem[] }[] {
  if (now === null) return [{ label: 'Notifications', items }];
  const today = toLocalDateKey(new Date(now));
  const labels = ['Today', 'Yesterday', 'Earlier this week', 'Older'];
  const buckets = new Map<string, NotificationItem[]>();
  for (const item of items) {
    const days = Math.round(
      (Date.parse(`${today}T00:00:00Z`) -
        Date.parse(`${toLocalDateKey(new Date(item.createdAt))}T00:00:00Z`)) /
        86_400_000,
    );
    const label = labels[days <= 0 ? 0 : days === 1 ? 1 : days < 7 ? 2 : 3]!;
    buckets.set(label, [...(buckets.get(label) ?? []), item]);
  }
  return labels
    .filter((label) => buckets.has(label))
    .map((label) => ({ label, items: buckets.get(label)! }));
}

function Inbox() {
  const me = useMe();
  const now = useNow();
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
          variant="outline"
          aria-pressed={unreadOnly}
          className={cn(
            unreadOnly && 'border-primary/50 bg-primary-soft text-brand hover:bg-primary-soft',
          )}
          onClick={() => {
            setUnreadOnly((v) => !v);
            setPage(1);
          }}
        >
          {unreadOnly ? <Check aria-hidden="true" /> : null}
          Unread only
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" disabled={markAll.isPending} onClick={() => markAll.mutate()}>
          <CheckCheck aria-hidden="true" />
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
          <div className="space-y-5">
            {periodGroups(query.data.data, now).map((group) => (
              <section key={group.label} aria-label={group.label}>
                <h3 className="eyebrow mb-2">{group.label}</h3>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {group.items.map((item) => {
                    const Icon = CATEGORY_ICON[item.category] ?? Megaphone;
                    const unread = !item.readAt;
                    return (
                      <li
                        key={item.id}
                        className={cn(
                          'flex gap-3.5 px-4 py-4 sm:px-5',
                          unread && 'bg-primary-soft/35 dark:bg-primary-soft/40',
                        )}
                      >
                        <span
                          className={cn(
                            'relative grid size-9 shrink-0 place-items-center rounded-full',
                            unread
                              ? 'bg-primary-soft text-brand'
                              : 'bg-surface-2 text-muted-foreground',
                          )}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                          {unread ? (
                            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card" />
                          ) : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                            <p
                              className={cn(
                                'min-w-0 text-sm text-foreground',
                                unread ? 'font-semibold' : 'font-medium',
                              )}
                            >
                              {unread ? <span className="sr-only">Unread: </span> : null}
                              {item.title}
                            </p>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {item.link ? (
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={item.link}>
                                    Open
                                    <ArrowUpRight aria-hidden="true" />
                                  </Link>
                                </Button>
                              ) : null}
                              {unread ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => markRead.mutate(item.id)}
                                >
                                  Mark read
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          <p className="mt-1 max-w-(--reading-max) text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                            {item.body}
                          </p>
                          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium capitalize">
                              {item.category}
                            </span>
                            <span className="tabular-nums">
                              {formatDateTime(item.createdAt, {
                                timeZone: me.organization.timezone,
                              })}
                            </span>
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
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
  placement: 'Drives opening to you and changes to your applications.',
  support: 'Doubts: new questions for staff, answers for learners.',
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
    <section
      aria-labelledby="preferences-heading"
      className="max-w-3xl overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <h2 id="preferences-heading" className="text-[15px] font-semibold text-foreground">
          How you are told
        </h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Account messages always reach you in the app; email can be switched off per category.
        </p>
      </div>
      <div
        aria-hidden="true"
        className="hidden grid-cols-[minmax(0,1fr)_5rem_5rem] gap-4 border-b border-border bg-surface-2 px-5 py-2 text-xs font-medium text-muted-foreground sm:grid sm:px-6"
      >
        <span>Category</span>
        <span className="text-center">In app</span>
        <span className="text-center">Email</span>
      </div>
      <ul className="divide-y divide-border">
        {query.data.map((preference) => {
          const Icon = CATEGORY_ICON[preference.category] ?? Megaphone;
          return (
            <li
              key={preference.category}
              className="grid grid-cols-[auto_auto] items-center justify-start gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_5rem_5rem] sm:justify-stretch sm:gap-x-4 sm:px-6"
            >
              <div className="col-span-2 flex min-w-0 gap-3 sm:col-span-1">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground capitalize">
                    {preference.category}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {CATEGORY_HELP[preference.category]}
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground-secondary sm:justify-center">
                <span className="sm:sr-only">In app</span>
                <Switch
                  checked={preference.inApp}
                  onCheckedChange={(v) => save.mutate({ ...preference, inApp: v })}
                  aria-label={`In-app notifications for ${preference.category}`}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground-secondary sm:justify-center">
                <span className="sm:sr-only">Email</span>
                <Switch
                  checked={preference.email}
                  onCheckedChange={(v) => save.mutate({ ...preference, email: v })}
                  aria-label={`Email notifications for ${preference.category}`}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
