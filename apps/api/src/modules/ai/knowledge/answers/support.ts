/**
 * Whether the passages a sentence cites support it, as far as a deterministic check can tell (Phase
 * 8F; ADR-0037): every number the sentence states appears in them, and at least half of its content
 * words do. It catches a citation of an unrelated passage, a figure the passages do not give and a
 * claim mostly made of words they do not hold. It does not understand meaning: a faithful paraphrase
 * in other words can fail it, and a false claim built from the passage's own words can pass it —
 * the limits the Phase 8 closure records.
 */
export interface Support {
  supported: boolean;
  /** The sentence's numbers that none of the cited passages states. */
  missingNumbers: string[];
  /** Of the sentence's content words, the share the cited passages hold (1 when it has none). */
  wordShare: number;
}

/** The least share of a sentence's content words its cited passages must hold. */
export const SUPPORT_MIN_WORD_SHARE = 0.5;

/** Whether `sources` — the cited passages' text — support `sentence` (its citations ignored). */
export function supportOf(sentence: string, sources: readonly string[]): Support {
  const claim = sentence.replace(CITATIONS, ' ');
  const source = sources.join('\n');
  const known = numbersIn(source, true);
  const missingNumbers = [...new Set(numbersIn(claim, false))].filter((n) => !known.has(n));
  const wanted = [...new Set(wordsIn(claim))];
  const held = new Set(wordsIn(source));
  const wordShare =
    wanted.length === 0 ? 1 : wanted.filter((word) => held.has(word)).length / wanted.length;
  return {
    supported: missingNumbers.length === 0 && wordShare >= SUPPORT_MIN_WORD_SHARE,
    missingNumbers,
    wordShare,
  };
}

const CITATIONS = /\[S[1-9][0-9]?\]/g;

/** Numbers as written (`1,200`, `17:00`, `3.5`), and, in passages, small numbers in words. */
function numbersIn(text: string, withWords: true): Set<string>;
function numbersIn(text: string, withWords: false): string[];
function numbersIn(text: string, withWords: boolean): Set<string> | string[] {
  const found = (text.match(/\d+(?:[.,:]\d+)*/g) ?? []).map((n) =>
    // A thousands separator is not part of the number: 1,200 and 1200 are one figure.
    /^\d{1,3}(?:,\d{3})+$/.test(n) ? n.replace(/,/g, '') : n,
  );
  if (!withWords) return found;
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  return new Set([
    ...found,
    ...words.flatMap((word) => (NUMBER_WORDS[word] === undefined ? [] : [NUMBER_WORDS[word]!])),
  ]);
}

const NUMBER_WORDS: Record<string, string> = Object.fromEntries(
  [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
    'twenty',
  ]
    .map((word, value) => [word, String(value)] as const)
    .concat([
      ['thirty', '30'],
      ['forty', '40'],
      ['fifty', '50'],
      ['sixty', '60'],
      ['seventy', '70'],
      ['eighty', '80'],
      ['ninety', '90'],
      ['hundred', '100'],
    ]),
);

/** A text's content words: lower-cased, without numbers or the commonest words, lightly stemmed. */
function wordsIn(text: string): string[] {
  return (
    text
      .normalize('NFKC')
      .toLowerCase()
      .match(/\p{L}+/gu) ?? []
  )
    .filter((word) => word.length > 1 && !COMMON.has(word))
    .map(stem);
}

/** One form for a word's forms: approve, approves, approved and approving are one word. */
function stem(word: string): string {
  let root = word;
  if (root.length > 5 && root.endsWith('ing')) root = root.slice(0, -3);
  else if (root.length > 4 && /(?:ies|ied)$/.test(root)) root = `${root.slice(0, -3)}y`;
  else if (root.length > 4 && /(?:ed|es)$/.test(root)) root = root.slice(0, -2);
  else if (root.length > 3 && root.endsWith('s') && !root.endsWith('ss')) root = root.slice(0, -1);
  return root.length > 3 && root.endsWith('e') ? root.slice(0, -1) : root;
}

/** Words that carry no claim of their own: articles, pronouns, auxiliaries, connectives. */
const COMMON = new Set(
  (
    'a an and are as at be been being but by can could did do does each for from had has have he her ' +
    'here his how i if in into is it its may might more most must no not of on or our over shall she ' +
    'should so such than that the their them then there these they this those through to under up ' +
    'upon very was we were what when where which while who whom why will with within would you your ' +
    'also any all only just per both either neither other another same about after before'
  ).split(' '),
);
