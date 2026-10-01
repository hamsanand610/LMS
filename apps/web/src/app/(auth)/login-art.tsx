import { Check, Flame, Radio } from 'lucide-react';

/**
 * The sign-in panel's picture: an original arrangement of the product's own surfaces — a solution
 * passing its tests, a course moving along, today's live class — rather than a stock photograph.
 * Purely decorative, so it is hidden from assistive technology.
 */
export function LoginArt() {
  const accent = 'color-mix(in oklab, var(--brand-primary) 55%, white)';
  const card =
    'rounded-2xl border border-white/10 bg-white/[0.06] shadow-[0_24px_60px_-24px_rgb(0_0_0/0.6)] backdrop-blur-md';
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-[min(23rem,42vh)] w-full max-w-[30rem] select-none"
    >
      {/* A solution in the practice workspace, with its verdict. */}
      <div className={`${card} absolute top-0 left-0 w-[19.5rem] p-4`}>
        <div className="mb-3 flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-white/20" />
          <span className="size-2 rounded-full bg-white/20" />
          <span className="size-2 rounded-full bg-white/20" />
          <span className="ml-2 font-mono text-[10px] text-nav-muted">Streak.java</span>
        </div>
        <pre className="font-mono text-[11.5px] leading-[1.7] text-nav-foreground/90">
          <span style={{ color: accent }}>int</span> days(List&lt;Day&gt; log) {'{'}
          {'\n'}
          {'  '}
          <span style={{ color: accent }}>int</span> run = <span className="text-sky-300">0</span>;
          {'\n'}
          {'  '}
          <span style={{ color: accent }}>for</span> (Day d : log.reversed())
          {'\n'}
          {'    '}
          <span style={{ color: accent }}>if</span> (d.learned()) run++;
          {'\n'}
          {'    '}
          <span style={{ color: accent }}>else break</span>;{'\n'}
          {'  '}
          <span style={{ color: accent }}>return</span> run;{'\n'}
          {'}'}
        </pre>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
          <Check className="size-3" />5 of 5 tests passed
        </div>
      </div>

      {/* A course on its way, and the learning streak beside it. */}
      <div className={`${card} absolute top-[37%] right-0 z-10 w-[16.5rem] p-4`}>
        <p className="text-[10px] font-semibold tracking-[0.08em] text-nav-muted uppercase">
          Module 3 · Collections
        </p>
        <p className="mt-1 text-sm font-semibold text-nav-foreground">Core Java</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[68%] rounded-full" style={{ background: accent }} />
        </div>
        <p className="mt-1.5 text-[11px] text-nav-muted">68% complete</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-nav-foreground">
            <Flame className="size-3.5" style={{ color: accent }} />
            12-day streak
          </span>
          <span className="flex gap-1">
            {[1, 1, 1, 1, 1, 1, 0].map((on, i) => (
              <span
                key={i}
                className="size-2.5 rounded-full"
                style={{ background: on ? accent : 'rgb(255 255 255 / 0.14)' }}
              />
            ))}
          </span>
        </div>
      </div>

      {/* Today's live class. */}
      <div
        className={`${card} absolute bottom-0 left-8 z-20 flex w-[17rem] items-center gap-3 px-4 py-3`}
      >
        <span
          className="flex size-9 items-center justify-center rounded-xl"
          style={{ background: 'color-mix(in oklab, var(--brand-primary) 45%, transparent)' }}
        >
          <Radio className="size-4 text-nav-foreground" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold text-nav-foreground">
            Data Structures
          </span>
          <span className="block text-[11px] text-nav-muted">Today · 10:00 – 11:30 am</span>
        </span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-nav-foreground">
          Live
        </span>
      </div>
    </div>
  );
}
