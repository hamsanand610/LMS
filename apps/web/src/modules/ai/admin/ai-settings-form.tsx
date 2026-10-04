'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eraser, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, type Path, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  AI_TASKS,
  type AiAdminStatus,
  type AiApprovableDataClass,
  type AiCachePurgeResult,
  type AiSettingsView,
  type AiTask,
  aiSettingsSchema,
} from '@lms/shared';
import { FieldError } from '@/components/field-error';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { formatNumber } from '@/lib/format';
import { AI_KEYS } from '../queries';

type FormInput = z.input<typeof aiSettingsSchema>;
type FormValues = z.output<typeof aiSettingsSchema>;

const SERVICE_LABEL: Record<AiAdminStatus['service'], { label: string; tone: string }> = {
  ready: { label: 'Answering', tone: 'text-success' },
  degraded: { label: 'Answering through the stand-in model', tone: 'text-warning' },
  unavailable: { label: 'Not answering now', tone: 'text-danger' },
  off: { label: 'Not set up', tone: 'text-muted-foreground' },
};

export const DATA_CLASS_LABEL: Record<AiApprovableDataClass, { label: string; detail: string }> = {
  public: {
    label: 'General questions',
    detail: 'Questions on their own, with no course material.',
  },
  course: {
    label: 'Course material',
    detail: 'A course’s outline or a lesson’s text, from the assistant beside it.',
  },
  personal: {
    label: 'Learners’ own work',
    detail: 'A lab’s statement with the learner’s own submission, for AI Hint.',
  },
};

const TASK_LABEL: Record<AiTask, string> = {
  chat: 'Questions',
  hint: 'Lab hints',
  classify: 'Classifying',
  title: 'Conversation titles',
  summarize: 'Conversation notes',
};

const whole = (value: unknown) => (value === '' || value === null ? null : Number(value));

/**
 * SI Academy AI's settings for the institute (Phase 7E over Phase 7D's API), for the Super Admin
 * alone (`ai:manage`): allowances, budget, retention, which data the provider may receive, models
 * and the answer cache. A blank field keeps the deployment's own setting. No key, address or
 * provider account is shown or asked for: those stay in the server's environment.
 */
export function AiSettingsForm() {
  const queryClient = useQueryClient();
  const [purging, setPurging] = useState(false);
  const status = useQuery({
    queryKey: AI_KEYS.adminStatus,
    queryFn: () => api<AiAdminStatus>('/ai/admin/status'),
  });
  const query = useQuery({
    queryKey: AI_KEYS.adminSettings,
    queryFn: () => api<AiSettingsView>('/ai/admin/settings'),
  });
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(aiSettingsSchema),
    values: query.data?.settings,
  });
  useEffect(() => {
    if (query.data) form.reset(query.data.settings);
  }, [query.data, form]);

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      api<AiSettingsView>('/ai/admin/settings', { method: 'PATCH', body: values }),
    onSuccess: (view) => {
      queryClient.setQueryData(AI_KEYS.adminSettings, view);
      void queryClient.invalidateQueries({ queryKey: AI_KEYS.adminStatus });
      void queryClient.invalidateQueries({ queryKey: AI_KEYS.availability });
      toast.success('AI settings saved.');
    },
    onError: (error) => {
      if (isApiError(error) && error.problem?.errors?.length) {
        for (const issue of error.problem.errors) {
          form.setError(issue.path as Path<FormInput>, { message: issue.message });
        }
        toast.error('Some fields need attention.');
      } else {
        toast.error(isApiError(error) ? error.message : 'The AI settings could not be saved.');
      }
    },
  });
  const purge = useMutation({
    mutationFn: () => api<AiCachePurgeResult>('/ai/admin/cache/purge', { method: 'POST' }),
    onSuccess: ({ purged }) =>
      toast.success(
        purged === 1
          ? 'One kept answer was removed.'
          : `${formatNumber(purged)} kept answers were removed.`,
      ),
    onError: () => toast.error('The answer cache could not be emptied. Try again.'),
  });

  if (query.isPending) return <LoadingRows rows={8} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const view = query.data;
  const { effective } = view;
  const { errors } = form.formState;
  const models = view.models;
  const service = status.data ? SERVICE_LABEL[status.data.service] : null;

  return (
    <form
      onSubmit={form.handleSubmit((values) => save.mutate(values))}
      className="space-y-6"
      noValidate
    >
      <Card>
        <CardHeader>
          <CardTitle>Model service</CardTitle>
          <CardDescription>
            Whether SI Academy AI can answer now. The provider and its key are set in the server’s
            environment, never here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status.isError ? (
            <p className="text-sm text-muted-foreground">The service’s state could not be read.</p>
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">State</dt>
                <dd className={`mt-1 font-medium ${service?.tone ?? ''}`}>
                  {service?.label ?? '…'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Provider configured</dt>
                <dd className="mt-1 font-medium">
                  {status.data ? (status.data.configured ? 'Yes' : 'No') : '…'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Answering questions</dt>
                <dd className="mt-1 font-medium">
                  {status.data ? (status.data.gatewayReady ? 'Yes' : 'No') : '…'}
                </dd>
              </div>
            </dl>
          )}
          {view.ignored.length > 0 ? (
            <div
              role="status"
              className="mt-4 flex gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-[13px] text-foreground"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <div>
                <p className="font-medium">Some saved choices are not applied now:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {view.ignored.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allowances and budget</CardTitle>
          <CardDescription>
            Leave a field blank to keep the deployment’s setting. Costs are estimates from the
            configured prices.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="dailyQuestions"
            label="Questions per person per day"
            now={formatNumber(effective.dailyQuestions)}
            error={errors.dailyQuestions?.message}
            {...form.register('dailyQuestions', { setValueAs: whole })}
          />
          <NumberField
            id="dailyTokens"
            label="Tokens per person per day"
            now={formatNumber(effective.dailyTokens)}
            error={errors.dailyTokens?.message}
            {...form.register('dailyTokens', { setValueAs: whole })}
          />
          <NumberField
            id="monthlyBudgetUsd"
            label="Monthly budget (US dollars)"
            step="0.01"
            now={effective.monthlyBudgetUsd === null ? 'none' : `$${effective.monthlyBudgetUsd}`}
            error={errors.monthlyBudgetUsd?.message}
            {...form.register('monthlyBudgetUsd', { setValueAs: whole })}
          />
          <NumberField
            id="budgetWarningPercent"
            label="Warn the Super Admin at (% of the budget)"
            error={errors.budgetWarningPercent?.message}
            {...form.register('budgetWarningPercent', { valueAsNumber: true })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What the provider may receive</CardTitle>
          <CardDescription>
            Passwords, keys and anything restricted are never sent, whatever is chosen here. The
            deployment approved:{' '}
            {view.approvableDataClasses.map((c) => DATA_CLASS_LABEL[c].label).join(', ')}. This
            institute can narrow that, never widen it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Controller
            control={form.control}
            name="dataClasses"
            render={({ field }) => {
              const own = field.value ?? null;
              return (
                <div className="space-y-4">
                  <label className="flex items-center gap-3 text-sm">
                    <Switch
                      checked={own === null}
                      onCheckedChange={(deployment) =>
                        field.onChange(deployment ? null : [...effective.dataClasses])
                      }
                      aria-label="Use everything the deployment approved"
                    />
                    Use everything the deployment approved
                  </label>
                  {own !== null ? (
                    <fieldset className="space-y-3">
                      <legend className="sr-only">Approved for this institute</legend>
                      {view.approvableDataClasses.map((dataClass) => {
                        const checked = own.includes(dataClass);
                        return (
                          <label key={dataClass} className="flex items-start gap-3 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(next) =>
                                field.onChange(
                                  next
                                    ? [...own, dataClass]
                                    : own.filter((value) => value !== dataClass),
                                )
                              }
                              className="mt-0.5"
                            />
                            <span>
                              <span className="block font-medium">
                                {DATA_CLASS_LABEL[dataClass].label}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {DATA_CLASS_LABEL[dataClass].detail}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </fieldset>
                  ) : null}
                  <FieldError message={errors.dataClasses?.message} />
                </div>
              );
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Models</CardTitle>
          <CardDescription>
            Among the models this installation can call. Blank keeps the deployment’s choice.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="model">Default model</Label>
            <NativeSelect
              id="model"
              {...form.register('model', { setValueAs: (v) => (v ? v : null) })}
            >
              <option value="">Deployment’s ({effective.model ?? 'none'})</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.id}
                </option>
              ))}
            </NativeSelect>
            <FieldError message={errors.model?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fallbackModel">Stand-in model</Label>
            <NativeSelect
              id="fallbackModel"
              {...form.register('fallbackModel', { setValueAs: (v) => (v ? v : null) })}
            >
              <option value="">Deployment’s ({effective.fallbackModel ?? 'none'})</option>
              {models
                .filter((model) => model.mayStandIn)
                .map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.id}
                  </option>
                ))}
            </NativeSelect>
            <FieldError message={errors.fallbackModel?.message} />
          </div>
          {AI_TASKS.map((task) => (
            <div key={task} className="space-y-2">
              <Label htmlFor={`task-${task}`}>{TASK_LABEL[task]}</Label>
              <NativeSelect
                id={`task-${task}`}
                {...form.register(`taskModels.${task}`, {
                  setValueAs: (v) => (v ? v : undefined),
                })}
              >
                <option value="">Default ({effective.taskModels[task] ?? 'none'})</option>
                {models
                  .filter((model) => model.tasks.includes(task))
                  .map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.id}
                      {model.priced ? '' : ' (no price set)'}
                    </option>
                  ))}
              </NativeSelect>
              <FieldError message={errors.taskModels?.[task]?.message} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keeping and reusing</CardTitle>
          <CardDescription>
            How long conversations and usage details are kept, and how long a kept answer may be
            reused for the same question.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <NumberField
            id="conversationRetentionDays"
            label="Keep conversations (days)"
            error={errors.conversationRetentionDays?.message}
            {...form.register('conversationRetentionDays', { valueAsNumber: true })}
          />
          <NumberField
            id="usageDetailRetentionDays"
            label="Keep usage details (days)"
            error={errors.usageDetailRetentionDays?.message}
            {...form.register('usageDetailRetentionDays', { valueAsNumber: true })}
          />
          <NumberField
            id="cacheTtlHours"
            label="Reuse a kept answer for (hours)"
            error={errors.cacheTtlHours?.message}
            {...form.register('cacheTtlHours', { valueAsNumber: true })}
          />
          <div className="sm:col-span-3">
            <Button type="button" variant="outline" onClick={() => setPurging(true)}>
              <Eraser aria-hidden="true" />
              Empty the answer cache
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save AI settings'}
        </Button>
      </div>

      <Dialog open={purging} onOpenChange={setPurging}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Empty the answer cache?</DialogTitle>
            <DialogDescription>
              Every kept answer is removed. Questions are answered afresh, and kept again, from now
              on. Conversations are not touched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurging(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                purge.mutate();
                setPurging(false);
              }}
            >
              Empty the cache
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

function NumberField({
  id,
  label,
  now,
  error,
  step = '1',
  ...field
}: {
  id: string;
  label: string;
  now?: string;
  error?: string;
  step?: string;
} & React.ComponentProps<'input'>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" inputMode="decimal" step={step} {...field} />
      {now ? <p className="text-xs text-muted-foreground">Applies now: {now}</p> : null}
      <FieldError message={error} />
    </div>
  );
}
