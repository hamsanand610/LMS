import type { Metadata } from 'next';
import { ForgotPasswordForm } from './forgot-form';

export const metadata: Metadata = { title: 'Forgot password' };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your email and we will send you a link to set a new password.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
    </>
  );
}
