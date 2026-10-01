'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { passwordSchema } from '@lms/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';

const formSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });
type FormValues = z.infer<typeof formSchema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api('/auth/password/reset', {
        body: { token, password: values.password },
        noRefresh: true,
      });
      setDone(true);
    } catch (e) {
      if (isApiError(e)) {
        if (e.status === 410) setError('This link has expired. Request a new one.');
        else if (e.code === 'token_used')
          setError('This link was already used. Request a new one if you still need it.');
        else if (e.code === 'password_too_common')
          setError('This password is too common. Choose a less predictable one.');
        else if (e.status === 404) setError('This link is not valid.');
        else setError(e.message);
      } else setError('Could not reach the server. Try again.');
    }
  });

  if (done) {
    return (
      <Alert>
        <AlertDescription>
          Your password has been updated.{' '}
          <Link href="/login" className="font-medium text-brand underline-offset-4 hover:underline">
            Sign in
          </Link>
        </AlertDescription>
      </Alert>
    );
  }
  const { errors, isSubmitting } = form.formState;
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {error}{' '}
            <Link href="/forgot-password" className="underline underline-offset-4">
              Request a new link
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
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
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        Update password
      </Button>
    </form>
  );
}
