import type { Metadata } from 'next';
import { getBranding } from '@/lib/api/server';
import { InviteForm } from './invite-form';

export const metadata: Metadata = { title: 'Activate your account' };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const branding = await getBranding();
  return (
    <>
      <h1 className="font-display text-[2rem] leading-[1.05] text-balance">
        Welcome to {branding.brandName}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
        Set a password to activate your account.
      </p>
      <div className="mt-8">
        <InviteForm token={token} />
      </div>
    </>
  );
}
