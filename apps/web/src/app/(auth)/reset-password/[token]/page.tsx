import type { Metadata } from 'next';
import { ResetPasswordForm } from './reset-form';

export const metadata: Metadata = { title: 'Set a new password' };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Use at least 10 characters. All other sessions will be signed out.
      </p>
      <div className="mt-6">
        <ResetPasswordForm token={token} />
      </div>
    </>
  );
}
