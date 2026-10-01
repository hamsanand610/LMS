'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { passwordSchema, type MeResponse } from '@lms/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import { portalHome } from '@/lib/auth/portals';

const formSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
    terms: z.boolean(),
    privacy: z.boolean(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })
  .refine((v) => v.terms, { path: ['terms'], message: 'You must accept the terms of use' })
  .refine((v) => v.privacy, { path: ['privacy'], message: 'You must accept the privacy notice' });
type FormValues = z.infer<typeof formSchema>;

export function InviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '', confirm: '', terms: false, privacy: false },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api(`/auth/invitations/${encodeURIComponent(token)}/accept`, {
        body: { password: values.password, consents: { terms: true, privacy: true } },
        noRefresh: true,
      });
      const me = await api<MeResponse>('/me');
      router.replace(portalHome(me.homePortal));
      router.refresh();
    } catch (e) {
      if (isApiError(e)) {
        if (e.status === 410)
          setError('This invitation has expired. Ask your administrator to send a new one.');
        else if (e.code === 'token_used')
          setError('This invitation was already used. Sign in instead.');
        else if (e.code === 'password_too_common')
          setError('This password is too common. Choose a less predictable one.');
        else if (e.status === 404) setError('This invitation link is not valid.');
        else setError(e.message);
      } else setError('Could not reach the server. Try again.');
    }
  });

  const { errors, isSubmitting } = form.formState;
  const [terms, privacy] = useWatch({ control: form.control, name: ['terms', 'privacy'] });
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          {...form.register('password')}
          aria-invalid={!!errors.password}
        />
        {errors.password ? <p className="text-sm text-danger">{errors.password.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          {...form.register('confirm')}
          aria-invalid={!!errors.confirm}
        />
        {errors.confirm ? <p className="text-sm text-danger">{errors.confirm.message}</p> : null}
      </div>
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <Checkbox
            id="terms"
            checked={terms}
            onCheckedChange={(v) => form.setValue('terms', v === true, { shouldValidate: true })}
          />
          <Label htmlFor="terms" className="font-normal leading-snug">
            I accept the{' '}
            <Link
              href="/pages/terms"
              className="font-medium text-brand underline-offset-4 hover:underline"
              target="_blank"
            >
              terms of use
            </Link>
          </Label>
        </div>
        {errors.terms ? <p className="text-sm text-danger">{errors.terms.message}</p> : null}
        <div className="flex items-start gap-2">
          <Checkbox
            id="privacy"
            checked={privacy}
            onCheckedChange={(v) => form.setValue('privacy', v === true, { shouldValidate: true })}
          />
          <Label htmlFor="privacy" className="font-normal leading-snug">
            I have read the{' '}
            <Link
              href="/pages/privacy"
              className="font-medium text-brand underline-offset-4 hover:underline"
              target="_blank"
            >
              privacy notice
            </Link>
          </Label>
        </div>
        {errors.privacy ? <p className="text-sm text-danger">{errors.privacy.message}</p> : null}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Activating…' : 'Activate my account'}
      </Button>
    </form>
  );
}
