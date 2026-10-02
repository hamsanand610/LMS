import { FEEDBACK_MIN_RESPONSES, toLocalDateKey } from '@lms/shared';

/** One round of a feedback form: its answers for one period (a week, or the form's one time). */
export interface FeedbackRound {
  period: string;
  /** The round's date: its week's Friday, or the day a one-time form opened. */
  dateKey: string;
  responses: number;
  /** Every rating given in the round; none at all below five answers (D10). */
  ratings: number[];
}

/**
 * A form's answers as whole rounds, those whose date falls in the range (D10). A range never cuts
 * a round by the day each answer came in, and a round under five answers gives no ratings, so no
 * choice of dates or filters can narrow a figure to fewer than five people's answers — two ranges
 * that differ by one answer would otherwise give that answer away.
 */
export function feedbackRoundsOf(
  form: {
    opensAt: Date;
    questions: unknown;
    responses: { period: string; answers: unknown }[];
  },
  range: { from?: string | undefined; to?: string | undefined },
  timezone: string,
): FeedbackRound[] {
  const ratingIds = (form.questions as { id: string; kind: string }[])
    .filter((question) => question.kind === 'rating')
    .map((question) => question.id);
  const byPeriod = new Map<string, Record<string, unknown>[]>();
  for (const response of form.responses) {
    const answers = byPeriod.get(response.period) ?? [];
    answers.push(response.answers as Record<string, unknown>);
    byPeriod.set(response.period, answers);
  }
  const rounds: FeedbackRound[] = [];
  for (const [period, answers] of byPeriod) {
    const dateKey = period === 'once' ? toLocalDateKey(form.opensAt, timezone) : period;
    if ((range.from && dateKey < range.from) || (range.to && dateKey > range.to)) continue;
    rounds.push({
      period,
      dateKey,
      responses: answers.length,
      ratings:
        answers.length >= FEEDBACK_MIN_RESPONSES
          ? answers.flatMap((given) =>
              ratingIds.map((id) => given[id]).filter((v): v is number => typeof v === 'number'),
            )
          : [],
    });
  }
  return rounds;
}

/** The mean of every rating the rounds give, or null when they give none. */
export function meanRating(rounds: FeedbackRound[]): number | null {
  const ratings = rounds.flatMap((round) => round.ratings);
  return ratings.length === 0 ? null : ratings.reduce((sum, v) => sum + v, 0) / ratings.length;
}
