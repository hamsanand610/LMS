import { ArrowLeft, BadgeCheck, CircleX, SearchX } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  certificateCodeSchema,
  formatCertificateCode,
  type CertificateVerification,
} from '@lms/shared';
import { Button } from '@/components/ui/button';
import { getBranding, serverApi } from '@/lib/api/server';
import { formatDate } from '@/lib/format';
import { BrandLogo } from '@/shell/brand-logo';

// The page names a learner: confirmable by anyone who has the code, but not for search engines.
export const metadata: Metadata = {
  title: 'Verify a certificate',
  robots: { index: false, follow: false },
};

async function load(code: string): Promise<CertificateVerification | null> {
  // Only a well-formed code is looked up, and without the visitor's session.
  let typed: string;
  try {
    typed = decodeURIComponent(code);
  } catch {
    return null;
  }
  const parsed = certificateCodeSchema.safeParse(typed);
  if (!parsed.success) return null;
  try {
    return await serverApi<CertificateVerification>(`/public/certificates/${parsed.data}`, {
      anonymous: true,
    });
  } catch {
    // An unknown code, a malformed one or certificates switched off all read the same to a visitor.
    return null;
  }
}

/**
 * The public check behind the code on a certificate (ADR-0022, AC-10.2 and AC-10.3): who it was
 * awarded to, for which course, when, and whether it still stands. Readable without signing in.
 */
export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const [certificate, branding] = await Promise.all([load(code), getBranding()]);
  const revoked = certificate?.status === 'revoked';

  return (
    <main className="flex-1 bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-6 py-4">
          <BrandLogo branding={branding} />
          <Button variant="ghost" asChild>
            <Link href="/">
              <ArrowLeft aria-hidden="true" />
              Home
            </Link>
          </Button>
        </div>
      </header>
      <section className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
        <p className="eyebrow">Certificate check</p>
        {certificate ? (
          <div className="mt-4 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-4">
              <span
                className={
                  revoked
                    ? 'grid size-11 shrink-0 place-items-center rounded-full bg-danger-soft text-danger'
                    : 'grid size-11 shrink-0 place-items-center rounded-full bg-success-soft text-success'
                }
              >
                {revoked ? (
                  <CircleX className="size-6" aria-hidden="true" />
                ) : (
                  <BadgeCheck className="size-6" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  {revoked ? 'This certificate has been revoked' : 'This certificate is genuine'}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {revoked && certificate.revokedAt
                    ? `It was revoked on ${formatDate(certificate.revokedAt)} and no longer stands.`
                    : `Issued by ${certificate.institute}.`}
                </p>
              </div>
            </div>
            <dl className="mt-6 divide-y divide-border border-t border-border text-sm">
              <Fact label="Awarded to" value={certificate.learnerName} />
              <Fact label="Course" value={certificate.courseTitle} />
              <Fact label="Completed on" value={formatDate(certificate.completedAt)} />
              <Fact label="Issued on" value={formatDate(certificate.issuedAt)} />
              <Fact label="Code" value={formatCertificateCode(certificate.code)} />
            </dl>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-foreground-secondary">
                <SearchX className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  No certificate has this code
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Check the code printed at the foot of the certificate. It has twelve letters and
                  digits, in three groups of four.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground sm:text-right">{value}</dd>
    </div>
  );
}
