/**
 * A learner's figure across several courses (Phase 2, D1): each course counts once and the mean is
 * rounded, which is how the staff reports average course completion, so the learner and their
 * trainer see the same number. Every input is held to 0..100; nothing to average gives 0.
 */
export function overallPercent(coursePercents: readonly number[]): number {
  if (coursePercents.length === 0) return 0;
  const bounded = coursePercents.map((pct) => Math.min(100, Math.max(0, pct)));
  return Math.round(bounded.reduce((total, pct) => total + pct, 0) / bounded.length);
}
