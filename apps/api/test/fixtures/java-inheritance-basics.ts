/**
 * A small synthetic knowledge document for the knowledge base's tests (Roadmap Phase 8A): written
 * for them, from no book, course or web page. Its sections are its chunks, as Phase 8B's ingestion
 * would cut them.
 */
export const JAVA_INHERITANCE_SECTIONS = [
  {
    heading: 'Definition',
    content:
      'Inheritance lets one class take on the fields and methods of another, so shared behaviour is written once and reused.',
  },
  {
    heading: 'Parent class',
    content:
      'The class whose members are inherited is the parent, or superclass. It describes what every child has in common.',
  },
  {
    heading: 'Child class',
    content:
      'A child, or subclass, is declared with extends. It gains the parent’s members and may add its own.',
  },
  {
    heading: 'Method overriding',
    content:
      'A child may give its own body to a method it inherits, keeping the same name and parameters. The @Override annotation asks the compiler to check it.',
  },
  {
    heading: 'Example',
    content:
      'class Animal { String sound() { return "..."; } }\nclass Dog extends Animal { @Override String sound() { return "Woof"; } }',
  },
] as const;

/** The whole document, as an author would write it. */
export const JAVA_INHERITANCE_TEXT = [
  '# Java Inheritance Basics',
  ...JAVA_INHERITANCE_SECTIONS.flatMap((section) => [
    '',
    `## ${section.heading}`,
    '',
    section.content,
  ]),
].join('\n');
