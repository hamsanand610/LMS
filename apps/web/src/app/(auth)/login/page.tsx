import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/api/server';
import { portalHome, safeNext } from '@/lib/auth/portals';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const me = await getMe();
  if (me) redirect(safeNext(next) ?? portalHome(me.homePortal));
  return (
    <>
      <h1 className="font-display text-[2.25rem] leading-none text-balance">Sign in</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        Use the email and password of your account.
      </p>
      <div className="mt-8">
        <LoginForm next={safeNext(next)} />
      </div>
    </>
  );
}
