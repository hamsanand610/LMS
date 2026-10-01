import type { Metadata } from 'next';
import { ForgotPasswordForm } from './forgot-form';

export const metadata: Metadata = { title: 'Forgot password' };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-[2rem] leading-[1.05] text-balance">Reset your password</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
        Enter your email and we will send you a link to set a new password.
      </p>
      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
    </>
  );
}
