import type { BrandingPublic } from '@lms/shared';
import { LoginArt } from './login-art';

/*
 * The sign-in picture (Task 3, direction A — "Cinematic Learner Workspace"). The institute's own
 * photograph is never shown as a rectangle: it is masked into the panel's charcoal on every edge,
 * the lamp's wine light is carried past the frame, and grain, a faint grid in the empty wall and the
 * Progress Arc tie it to the product. The words sit in the dark space above the learner.
 *
 * The same panel serves every width: a column beside the form from 640 px (the split layout), and
 * on phones a band above it — the photograph dissolving into the dark either way, never a cropped
 * strip. Without an uploaded photograph the panel falls back to the product arrangement (LoginArt).
 */

/** Where the photograph fades out: all four edges, the top one longest (it becomes the sky). */
const PHOTO_MASK =
  'linear-gradient(to bottom, transparent 0%, #000 38%, #000 82%, transparent 100%), linear-gradient(to right, transparent 0%, #000 16%, #000 84%, transparent 100%)';

/** A point on a quarter arc centred on the panel's top-right corner (viewBox units). */
function arcPoint(r: number, fraction: number): [number, number] {
  const angle = (Math.PI / 2) * fraction;
  return [100 - r * Math.cos(angle), r * Math.sin(angle)];
}

/**
 * The Progress Arc, the product's motif: three concentric quarter arcs in the empty wall at the
 * top-right, the middle one lit to about two thirds, with a bright head where the learner is now.
 */
function ProgressArcs() {
  const radii = [26, 44, 62];
  const lit = 44;
  const [hx, hy] = arcPoint(lit, 0.68);
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      // Hidden on the narrow column, where the statement runs the panel's full width.
      className="pointer-events-none absolute top-0 right-0 w-[44%] overflow-visible sm:hidden lg:block lg:w-[62%]"
    >
      <defs>
        <linearGradient id="login-arc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(245 185 187)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="rgb(255 214 214)" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      {radii.map((r) => (
        <path
          key={r}
          d={`M ${100 - r} 0 A ${r} ${r} 0 0 0 100 ${r}`}
          fill="none"
          stroke="rgb(245 185 187 / 0.13)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path
        d={`M ${100 - lit} 0 A ${lit} ${lit} 0 0 0 ${hx} ${hy}`}
        fill="none"
        stroke="url(#login-arc)"
        strokeWidth="1.6"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={hx}
        cy={hy}
        r="0.75"
        fill="rgb(255 228 228)"
        style={{ filter: 'drop-shadow(0 0 1.6px rgb(240 149 155 / 0.95))' }}
      />
    </svg>
  );
}

/** The picture panel: beside the form from 640 px, above it on phones. */
export function LoginVisual({ branding }: { branding: BrandingPublic }) {
  const photo = branding.login.backgroundUrl;
  return (
    <aside className="relative order-first m-3 mb-0 flex h-[clamp(13rem,36dvh,19rem)] flex-col overflow-hidden rounded-3xl bg-[#0d0908] text-[#f3ede6] sm:order-none sm:mb-3 sm:h-auto sm:rounded-[28px]">
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- client-uploaded branding asset, already optimised */}
          <img
            src={photo}
            alt=""
            fetchPriority="high"
            decoding="async"
            className="login-photo pointer-events-none select-none"
            style={{
              maskImage: PHOTO_MASK,
              WebkitMaskImage: PHOTO_MASK,
              maskComposite: 'intersect',
              WebkitMaskComposite: 'source-in',
            }}
          />
          {/* The lamp's wine light, carried past the frame and up into the empty wall. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(94% 55% at 8% 62%, rgb(173 42 60 / 0.30), transparent 62%), radial-gradient(76% 47% at 100% 0%, rgb(127 35 49 / 0.34), transparent 64%)',
            }}
          />
        </>
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 70% at 105% -5%, color-mix(in oklab, var(--brand-primary) 46%, transparent), transparent 62%), radial-gradient(90% 55% at -10% 110%, color-mix(in oklab, var(--brand-primary) 20%, transparent), transparent 60%)',
          }}
        />
      )}
      {/* A faint grid in the negative space only. */}
      <div
        aria-hidden="true"
        className="knowledge-grid pointer-events-none absolute inset-0 text-white/[0.035]"
        style={{
          maskImage: 'radial-gradient(76% 40% at 0% 0%, #000 0%, transparent 72%)',
          WebkitMaskImage: 'radial-gradient(76% 40% at 0% 0%, #000 0%, transparent 72%)',
        }}
      />
      {/* Vignette, then grain over everything. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 55% 55%, transparent 55%, rgb(5 3 3 / 0.62) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="grain pointer-events-none absolute inset-0 opacity-[0.09] mix-blend-overlay"
      />

      <ProgressArcs />

      <div className="relative z-10 flex flex-1 flex-col justify-between p-5 sm:p-7 lg:p-11 xl:p-14">
        <div>
          <p className="flex items-center gap-2.5 text-[10.5px] font-semibold tracking-[0.2em] text-[#f3ede6]/70 uppercase sm:gap-3 sm:text-[11px] sm:tracking-[0.22em]">
            <span aria-hidden="true" className="h-px w-6 bg-[#f0959b]/70 sm:w-8" />
            {branding.brandName}
          </p>
          <div className="max-w-[26rem]">
            <h2 className="font-display mt-3 max-w-[12.5rem] text-[1.5rem] leading-[1.05] text-balance text-[#f7f2ec] sm:mt-5 sm:max-w-none sm:text-[1.7rem] md:text-[2rem] lg:mt-6 lg:text-[2.35rem] lg:leading-[1.02] xl:text-[2.75rem] lg:[@media(max-height:760px)]:text-[2.1rem]">
              {branding.login.welcomeTitle}
            </h2>
            {branding.login.welcomeText ? (
              <p className="mt-3 hidden max-w-[24rem] text-[14px] leading-relaxed text-balance text-[#f3ede6]/72 sm:block lg:mt-4 lg:text-[15px]">
                {branding.login.welcomeText}
              </p>
            ) : null}
          </div>
        </div>

        {photo ? null : (
          // The product arrangement, only where there is width and height for it.
          <div className="relative my-6 hidden lg:[@media(min-height:660px)]:block">
            <LoginArt />
          </div>
        )}
      </div>
    </aside>
  );
}
