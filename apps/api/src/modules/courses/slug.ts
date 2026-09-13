/** Turns a course title into a URL-safe slug: lowercase words joined by hyphens. */
export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Appends -2, -3 … until the slug is free. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const root = base || 'course';
  if (!taken.has(root)) return root;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${root}-${suffix}`.slice(0, 140);
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`Could not find a free slug for "${base}"`);
}
