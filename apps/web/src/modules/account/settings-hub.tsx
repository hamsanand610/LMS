'use client';

import {
  BellRing,
  ChevronRight,
  FileText,
  KeyRound,
  Monitor,
  Moon,
  Sun,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useMe } from '@/shell/me-context';
import { type ThemeMode, useThemeMode } from '@/shell/theme/theme-store';

const THEMES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Match my device', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

function Row({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Sun;
  title: string;
  description: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group/row flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2/60"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-foreground-secondary">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-foreground">{title}</span>
          <span className="block text-[13px] text-muted-foreground">{description}</span>
        </span>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/row:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

/** Everything a person can set for themselves, in one place. */
export function SettingsHub() {
  const me = useMe();
  const [mode, setMode] = useThemeMode();
  return (
    <div className="max-w-3xl space-y-6">
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        <Row
          href="/account"
          icon={KeyRound}
          title="Account and sign-in"
          description="Your name, your password and the devices you are signed in on."
        />
        <Row
          href="/settings/notifications"
          icon={BellRing}
          title="Notifications"
          description="Which messages reach you in the portal and by email."
        />
        {me.person.studentId ? (
          <Row
            href="/profile"
            icon={UserRound}
            title="Your profile"
            description="Photo, education, projects, skills and resumes — what trainers and recruiters see."
          />
        ) : null}
      </ul>

      <section
        aria-labelledby="appearance-heading"
        className="rounded-xl border border-border bg-card px-5 py-4"
      >
        <h2 id="appearance-heading" className="font-medium text-foreground">
          Appearance
        </h2>
        <p className="text-[13px] text-muted-foreground">Kept on this device.</p>
        <div
          role="radiogroup"
          aria-labelledby="appearance-heading"
          className="mt-3 flex flex-wrap gap-2"
        >
          {THEMES.map((theme) => {
            const Icon = theme.icon;
            const active = mode === theme.value;
            return (
              <button
                key={theme.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(theme.value)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus',
                  active
                    ? 'border-primary bg-primary-soft text-brand'
                    : 'border-border text-foreground-secondary hover:border-border-strong hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {theme.label}
              </button>
            );
          })}
        </div>
      </section>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        <Row
          href="/pages/privacy"
          icon={FileText}
          title="Privacy Policy"
          description={`What ${me.organization.name} holds about you and why.`}
        />
        <Row
          href="/pages/terms"
          icon={FileText}
          title="Terms of Service"
          description="The rules for using the portal."
        />
      </ul>
    </div>
  );
}
