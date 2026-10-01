'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@lms/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api('/auth/password/forgot', { body: values, noRefresh: true });
      setSent(true);
    } catch (e) {
      setError(
        isApiError(e) && e.status === 429
          ? 'Too many requests. Please wait a few minutes.'
          : 'Could not send the email. Try again.',
      );
    }
  });

  if (sent) {
    return (
      <Alert>
        <AlertDescription>
          If an account exists for that email, a reset link is on its way. It expires in 30 minutes.{' '}
          <Link href="/login" className="font-medium text-brand underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

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
          {...form.register('email')}
          aria-invalid={!!form.formState.errors.email}
        />
        {form.formState.errors.email ? (
          <p className="text-sm text-danger">{form.formState.errors.email.message}</p>
        ) : null}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
        Send reset link
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-brand underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
