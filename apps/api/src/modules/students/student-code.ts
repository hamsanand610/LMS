/** Student codes are human-readable and stable: STU-<year>-<sequence>, e.g. STU-2026-0042. */
export function formatStudentCode(year: number, sequence: number): string {
  return `STU-${year}-${String(sequence).padStart(4, '0')}`;
}

/** Reads the sequence back out of a code, or null when the code has another shape. */
export function parseStudentCode(code: string): { year: number; sequence: number } | null {
  const match = /^STU-(\d{4})-(\d{4,})$/.exec(code);
  if (!match) return null;
  return { year: Number(match[1]), sequence: Number(match[2]) };
}

/** Next free sequence for a year, given the codes already used in that year. */
export function nextSequence(existingCodes: string[], year: number): number {
  let highest = 0;
  for (const code of existingCodes) {
    const parsed = parseStudentCode(code);
    if (parsed && parsed.year === year && parsed.sequence > highest) highest = parsed.sequence;
  }
  return highest + 1;
}
