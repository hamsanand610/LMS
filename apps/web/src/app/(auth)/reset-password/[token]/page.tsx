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
      <h1 className="font-display text-[2rem] leading-[1.05] text-balance">Set a new password</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
        Use at least 10 characters. All other sessions will be signed out.
      </p>
      <div className="mt-8">
        <ResetPasswordForm token={token} />
      </div>
    </>
  );
}
