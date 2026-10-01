'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { loginSchema, type MeResponse } from '@lms/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import { portalHome } from '@/lib/auth/portals';

/** Form schema: the shared schema with an explicit boolean (no default) so input and output types match. */
const formSchema = loginSchema.extend({ rememberMe: z.boolean() });
type LoginFormValues = z.infer<typeof formSchema>;

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  // A page load after the 15-minute access token expired lands here although the refresh cookie is
  // still valid (it is only sent to /api/v1/auth, so server components cannot see it). Restore the
  // session silently when a previous sign-in left its CSRF cookie behind.
  useEffect(() => {
    if (typeof document === 'undefined' || !document.cookie.includes('lms_csrf=')) return;
    let cancelled = false;
    api<MeResponse>('/auth/refresh', { method: 'POST', noRefresh: true })
      .then(() => api<MeResponse>('/me', { noRefresh: true }))
      .then((me) => {
        if (cancelled) return;
        router.replace(next ?? portalHome(me.homePortal));
        router.refresh();
      })
      .catch(() => {
        // No valid session: stay on the form.
      });
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api('/auth/login', { body: values, noRefresh: true });
      const me = await api<MeResponse>('/me');
      router.replace(next ?? portalHome(me.homePortal));
      router.refresh();
    } catch (e) {
      if (isApiError(e)) {
        if (e.code === 'account_inactive')
          setError('This account is not active. Contact your administrator.');
        else if (e.status === 429)
          setError('Too many sign-in attempts. Wait 15 minutes, then try again.');
        else setError('The email or password is incorrect.');
      } else {
        setError('Could not reach the server. Check your connection and try again.');
      }
    }
  });

  const { errors, isSubmitting } = form.formState;
  const rememberMe = useWatch({ control: form.control, name: 'rememberMe' });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          {...form.register('email')}
          aria-invalid={!!errors.email}
        />
        {errors.email ? <p className="text-sm text-danger">{errors.email.message}</p> : null}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-[13px] font-medium text-brand underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          {...form.register('password')}
          aria-invalid={!!errors.password}
        />
        {errors.password ? <p className="text-sm text-danger">{errors.password.message}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="rememberMe"
          checked={rememberMe}
          onCheckedChange={(v) => form.setValue('rememberMe', v === true)}
        />
        <Label htmlFor="rememberMe" className="font-normal">
          Keep me signed in on this device
        </Label>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
