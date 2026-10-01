/** Keys whose words are names or acronyms, written the way people write them. */
const LABEL_PHRASES: Record<string, string> = { 'html-css': 'HTML/CSS' };
const LABEL_WORDS: Record<string, string> = {
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  jdbc: 'JDBC',
  api: 'API',
  apis: 'APIs',
  dsa: 'DSA',
  oop: 'OOP',
  java: 'Java',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  spring: 'Spring',
  react: 'React',
};

/**
 * A stored key in words for a label: `mock_test` → "Mock test", `data-structures` → "Data
 * structures", `core-java` → "Core Java", `sql` → "SQL". The web and the API use the same one, so a
 * subject reads the same on a page and in a search result.
 */
export function humaniseKey(value: string): string {
  const phrase = LABEL_PHRASES[value.toLowerCase()];
  if (phrase) return phrase;
  return value
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      const known = LABEL_WORDS[word.toLowerCase()];
      if (known) return known;
      return index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    })
    .join(' ');
}
