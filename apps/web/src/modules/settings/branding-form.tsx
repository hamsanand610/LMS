'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  BRANDING_FONTS,
  type BrandingIssue,
  type BrandingPublic,
  type BrandingSeeds,
  brandingSeedsSchema,
  type ComputedTokens,
  DENSITIES,
  LOGIN_LAYOUTS,
  RADII,
} from '@lms/shared';
import { FieldError } from '@/components/field-error';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import { uploadFile } from '@/lib/files/upload';

interface BrandingState {
  seeds: BrandingSeeds;
  tokens: ComputedTokens;
  version: number;
}

interface PreviewResult {
  seeds: BrandingSeeds;
  tokens: ComputedTokens;
  issues: BrandingIssue[];
}

const FONT_LABELS: Record<(typeof BRANDING_FONTS)[number], string> = {
  system: 'System default',
  'ibm-plex-sans': 'IBM Plex Sans',
  inter: 'Inter',
  manrope: 'Manrope',
  'source-sans-3': 'Source Sans 3',
  'noto-sans': 'Noto Sans',
};

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function BrandingForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['branding'],
    queryFn: () => api<BrandingState>('/branding'),
  });
  const form = useForm<z.input<typeof brandingSeedsSchema>, unknown, BrandingSeeds>({
    resolver: zodResolver(brandingSeedsSchema),
    values: query.data?.seeds,
  });

  useEffect(() => {
    if (query.data) form.reset(query.data.seeds);
  }, [query.data, form]);

  const watched = useWatch({ control: form.control });
  const previewInput = useDebounced(JSON.stringify(watched), 400);
  const preview = useQuery({
    queryKey: ['branding-preview', previewInput],
    queryFn: () =>
      api<PreviewResult>('/branding/preview', {
        body: JSON.parse(previewInput) as Partial<BrandingSeeds>,
      }),
    enabled: Boolean(query.data),
    retry: false,
  });

  const save = useMutation({
    mutationFn: (values: BrandingSeeds) =>
      api<BrandingPublic>('/branding', { method: 'PATCH', body: values }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['branding'] });
      toast.success('Branding saved — the new theme is live');
      router.refresh();
    },
    onError: (error) => {
      if (isApiError(error) && error.problem?.errors?.length) {
        toast.error(error.problem.detail ?? 'The colours do not meet the contrast requirement');
      } else {
        toast.error(isApiError(error) ? error.message : 'Could not save branding');
      }
    },
  });

  const [uploading, setUploading] = useState<string | null>(null);
  const handleUpload = async (
    field: 'logoLightFileId' | 'logoDarkFileId' | 'faviconFileId' | 'login.backgroundFileId',
    context: string,
    file: File | undefined,
  ) => {
    if (!file) return;
    setUploading(field);
    try {
      const uploaded = await uploadFile(context, file);
      form.setValue(field, uploaded.id, { shouldDirty: true });
      toast.success(`${file.name} uploaded`);
    } catch (error) {
      toast.error(
        isApiError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Upload failed',
      );
    } finally {
      setUploading(null);
    }
  };

  const swatches = useMemo(() => {
    const tokens = preview.data?.tokens ?? query.data?.tokens;
    if (!tokens) return null;
    const keys = [
      '--bg',
      '--surface',
      '--brand-primary',
      '--brand-primary-soft',
      '--text',
      '--text-muted',
      '--border',
    ];
    return {
      light: keys.map((k) => [k, tokens.light[k] ?? ''] as const),
      dark: keys.map((k) => [k, tokens.dark[k] ?? ''] as const),
    };
  }, [preview.data, query.data]);

  if (query.isPending) return <LoadingRows rows={8} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const { errors } = form.formState;
  const issues = preview.data?.issues ?? [];

  return (
    <form
      onSubmit={form.handleSubmit((values) => save.mutate(values))}
      className="grid gap-6 lg:grid-cols-[1fr_320px]"
      noValidate
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brandName">Brand name</Label>
              <Input id="brandName" {...form.register('brandName')} />
              <FieldError message={errors.brandName?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input id="tagline" {...form.register('tagline')} />
              <FieldError message={errors.tagline?.message} />
            </div>
            <UploadField
              label="Logo (light backgrounds)"
              hint="PNG, SVG, JPG or WebP up to 2 MB"
              busy={uploading === 'logoLightFileId'}
              current={watched.logoLightFileId}
              onFile={(f) => void handleUpload('logoLightFileId', 'branding-logo', f)}
              onClear={() => form.setValue('logoLightFileId', null, { shouldDirty: true })}
            />
            <UploadField
              label="Logo (dark backgrounds)"
              hint="Optional; used in dark theme"
              busy={uploading === 'logoDarkFileId'}
              current={watched.logoDarkFileId}
              onFile={(f) => void handleUpload('logoDarkFileId', 'branding-logo', f)}
              onClear={() => form.setValue('logoDarkFileId', null, { shouldDirty: true })}
            />
            <UploadField
              label="Favicon"
              hint="PNG, ICO or SVG up to 512 KB"
              busy={uploading === 'faviconFileId'}
              current={watched.faviconFileId}
              onFile={(f) => void handleUpload('faviconFileId', 'branding-favicon', f)}
              onClear={() => form.setValue('faviconFileId', null, { shouldDirty: true })}
            />
            <UploadField
              label="Sign-in background"
              hint="JPG, PNG or WebP up to 5 MB (split layout only)"
              busy={uploading === 'login.backgroundFileId'}
              current={watched.login?.backgroundFileId}
              onFile={(f) => void handleUpload('login.backgroundFileId', 'branding-background', f)}
              onClear={() => form.setValue('login.backgroundFileId', null, { shouldDirty: true })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Colours and type</CardTitle>
            <CardDescription>
              Neutrals, dark theme and chart colours are derived from the primary colour
              automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ColorField
              id="primaryColor"
              label="Primary colour"
              value={watched.primaryColor ?? ''}
              onChange={(v) =>
                form.setValue('primaryColor', v, { shouldDirty: true, shouldValidate: true })
              }
              error={errors.primaryColor?.message}
            />
            <ColorField
              id="accentColor"
              label="Accent colour (optional)"
              value={watched.accentColor ?? ''}
              onChange={(v) =>
                form.setValue('accentColor', v || null, { shouldDirty: true, shouldValidate: true })
              }
              error={errors.accentColor?.message}
              allowEmpty
            />
            <SelectField
              label="Interface font"
              value={watched.fontUi ?? 'ibm-plex-sans'}
              options={BRANDING_FONTS.map((f) => ({ value: f, label: FONT_LABELS[f] }))}
              onChange={(v) =>
                form.setValue('fontUi', v as BrandingSeeds['fontUi'], { shouldDirty: true })
              }
            />
            <SelectField
              label="Corner radius"
              value={watched.radius ?? 'md'}
              options={RADII.map((r) => ({ value: r, label: r }))}
              onChange={(v) =>
                form.setValue('radius', v as BrandingSeeds['radius'], { shouldDirty: true })
              }
            />
            <SelectField
              label="Density"
              value={watched.density ?? 'comfortable'}
              options={DENSITIES.map((d) => ({ value: d, label: d }))}
              onChange={(v) =>
                form.setValue('density', v as BrandingSeeds['density'], { shouldDirty: true })
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sign-in and dashboard</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Sign-in layout"
              value={watched.login?.layout ?? 'split'}
              options={LOGIN_LAYOUTS.map((l) => ({ value: l, label: l }))}
              onChange={(v) =>
                form.setValue('login.layout', v as BrandingSeeds['login']['layout'], {
                  shouldDirty: true,
                })
              }
            />
            <div className="space-y-2">
              <Label htmlFor="welcomeTitle">Welcome title</Label>
              <Input id="welcomeTitle" {...form.register('login.welcomeTitle')} />
              <FieldError message={errors.login?.welcomeTitle?.message} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="welcomeText">Welcome text</Label>
              <Textarea id="welcomeText" rows={2} {...form.register('login.welcomeText')} />
              <FieldError message={errors.login?.welcomeText?.message} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="dashboardWelcome">Dashboard welcome text</Label>
              <Input id="dashboardWelcome" {...form.register('dashboard.welcomeText')} />
              <FieldError message={errors.dashboard?.welcomeText?.message} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="footerText">Footer text</Label>
              <Input id="footerText" {...form.register('email.footerText')} />
              <FieldError message={errors.email?.footerText?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportEmail">Support email</Label>
              <Input
                id="supportEmail"
                type="email"
                {...form.register('email.supportEmail', {
                  setValueAs: (v) => (v === '' ? null : v),
                })}
              />
              <FieldError message={errors.email?.supportEmail?.message} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset(query.data?.seeds)}
            disabled={!form.formState.isDirty}
          >
            Discard changes
          </Button>
          <Button
            type="submit"
            disabled={
              save.isPending || !form.formState.isDirty || issues.length > 0 || uploading !== null
            }
          >
            {save.isPending ? 'Saving…' : 'Save branding'}
          </Button>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>
              Derived tokens for both themes (version {query.data.version}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {issues.length ? (
              <Alert variant="destructive">
                <AlertTitle>Contrast too low</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 text-xs">
                    {issues.map((i) => (
                      <li key={i.token}>{i.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}
            {swatches ? (
              <>
                <SwatchRow title="Light" entries={swatches.light} />
                <SwatchRow title="Dark" entries={swatches.dark} />
              </>
            ) : null}
            <div
              className="rounded-md border border-border p-3"
              style={{
                background: preview.data?.tokens.light['--surface'],
                color: preview.data?.tokens.light['--text'],
              }}
            >
              <p
                className="text-sm font-semibold"
                style={{ color: preview.data?.tokens.light['--brand-primary'] }}
              >
                {watched.brandName || 'Brand name'}
              </p>
              <p className="text-xs" style={{ color: preview.data?.tokens.light['--text-muted'] }}>
                {watched.tagline || 'Tagline'}
              </p>
              <span
                className="mt-2 inline-block rounded-md px-3 py-1 text-xs font-medium"
                style={{
                  background: preview.data?.tokens.light['--brand-primary'],
                  color: preview.data?.tokens.light['--brand-primary-foreground'],
                }}
              >
                Primary button
              </span>
            </div>
          </CardContent>
        </Card>
      </aside>
    </form>
  );
}

function SwatchRow({
  title,
  entries,
}: {
  title: string;
  entries: readonly (readonly [string, string])[];
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([name, value]) => (
          <span
            key={name}
            title={`${name}: ${value}`}
            className="h-6 w-6 rounded border border-border"
            style={{ background: value }}
          />
        ))}
      </div>
    </div>
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
  error,
  allowEmpty,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  allowEmpty?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={allowEmpty ? 'Same as primary' : '#0B6E4F'}
          className="font-mono"
        />
      </div>
      <FieldError message={error} />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function UploadField({
  label,
  hint,
  busy,
  current,
  onFile,
  onClear,
}: {
  label: string;
  hint: string;
  busy: boolean;
  current: string | null | undefined;
  onFile: (file: File | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {current ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Remove
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {busy ? 'Uploading…' : current ? 'File attached' : hint}
      </p>
    </div>
  );
}
