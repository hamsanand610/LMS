/**
 * The synthetic evaluation set for knowledge retrieval (Roadmap Phase 8D; ADR-0036): short course
 * notes written for these tests from no book, course or web page, and questions about them with the
 * passages that answer them. No learner's data. Every passage and question carries the corpus's own
 * word, so the evaluation measures this corpus whatever else the test database holds.
 *
 * Kinds of question: an exact sentence; a paraphrase; two topics at once; one asked from a course;
 * one asked from a lesson; one about nothing in the corpus; one whose answer is written twice; and
 * the boundary — one that matches, word for word, a passage the person may not draw on.
 */

/** Where a passage lives, and who may draw on it. */
export type EvaluationPlacement =
  | { kind: 'institute' }
  | { kind: 'staff' }
  | { kind: 'course'; course: 'alpha' | 'beta'; lesson?: 'alpha-1' | 'alpha-2' }
  | { kind: 'draft' }
  | { kind: 'archived' }
  | { kind: 'personal' }
  | { kind: 'other-institute' };

export interface EvaluationDocument {
  key: string;
  title: string;
  text: string;
  placement: EvaluationPlacement;
}

export type EvaluationKind =
  | 'exact'
  | 'paraphrase'
  | 'multi-topic'
  | 'course'
  | 'lesson'
  | 'irrelevant'
  | 'duplicate'
  | 'boundary';

export interface EvaluationQuery {
  id: string;
  kind: EvaluationKind;
  query: string;
  /** The documents that answer it; for a duplicate, either one of them does. */
  relevant: string[];
  /** Documents the person may not draw on, which the question matches. */
  forbidden?: string[];
  context?: { course?: 'alpha' | 'beta'; lesson?: 'alpha-1' | 'alpha-2' };
}

export const EVALUATION_DOCUMENTS: readonly EvaluationDocument[] = [
  {
    key: 'inheritance',
    title: 'Inheritance',
    text: 'Inheritance lets a subclass extend a superclass. The subclass reuses the superclass fields and methods, and may override a method to change its behaviour.',
    placement: { kind: 'institute' },
  },
  {
    key: 'interfaces',
    title: 'Interfaces',
    text: 'An interface declares abstract methods that a class promises to implement. A class may implement several interfaces but extends only one superclass.',
    placement: { kind: 'institute' },
  },
  {
    key: 'loops',
    title: 'Loops',
    text: 'A for loop repeats a block a counted number of times. A while loop repeats while its condition stays true, and a do-while loop runs its block at least once.',
    placement: { kind: 'institute' },
  },
  {
    key: 'recursion',
    title: 'Recursion',
    text: 'Recursion is a method calling itself. Every recursive method needs a base case that stops the calls, or the call stack overflows.',
    placement: { kind: 'institute' },
  },
  {
    key: 'exceptions',
    title: 'Exceptions',
    text: 'Exceptions signal errors. A try block runs code that may throw, a catch block handles the exception, and a finally block always runs for cleanup.',
    placement: { kind: 'institute' },
  },
  {
    key: 'collections',
    title: 'Collections',
    text: 'The collections framework provides lists, sets and maps. An ArrayList keeps insertion order, a HashSet keeps unique elements, and a HashMap stores key and value pairs.',
    placement: { kind: 'institute' },
  },
  {
    key: 'generics',
    title: 'Generics',
    text: 'Generics give a collection or a method a type parameter, so the compiler checks the types and no casts are needed.',
    placement: { kind: 'institute' },
  },
  {
    key: 'strings',
    title: 'Strings',
    text: 'Strings are immutable objects. A StringBuilder appends characters efficiently when a string is built inside a loop.',
    placement: { kind: 'institute' },
  },
  {
    key: 'streams',
    title: 'Streams',
    text: 'Streams process collections as a pipeline: filter selects elements, map transforms each element, and collect gathers the results.',
    placement: { kind: 'institute' },
  },
  {
    key: 'threads',
    title: 'Threads',
    text: 'Threads run code concurrently. Synchronized blocks protect shared state, so two threads never corrupt the same object.',
    placement: { kind: 'institute' },
  },
  {
    key: 'alpha-arrays',
    title: 'Arrays (alpha)',
    text: 'Arrays store a fixed number of elements of one type, indexed from zero, in the alpha course.',
    placement: { kind: 'course', course: 'alpha' },
  },
  {
    key: 'alpha-lesson-1',
    title: 'Variables (alpha, lesson 1)',
    text: 'Variables hold values, and every variable has a declared type that fixes what it may hold.',
    placement: { kind: 'course', course: 'alpha', lesson: 'alpha-1' },
  },
  {
    key: 'alpha-lesson-2',
    title: 'Methods (alpha, lesson 2)',
    text: 'Methods take parameters and return a value to their caller; a void method returns nothing.',
    placement: { kind: 'course', course: 'alpha', lesson: 'alpha-2' },
  },
  {
    key: 'beta-polymorphism',
    title: 'Polymorphism (beta)',
    text: 'Polymorphism means one method call reaches the right override at run time through dynamic dispatch.',
    placement: { kind: 'course', course: 'beta' },
  },
  {
    key: 'staff-rubric',
    title: 'Marking rubric',
    text: 'Grade each submission against the marking scheme, and moderate borderline grades with a second assessor.',
    placement: { kind: 'staff' },
  },
  {
    key: 'encapsulation-a',
    title: 'Encapsulation',
    text: 'Encapsulation hides fields behind getter and setter methods, so an object controls its own state.',
    placement: { kind: 'institute' },
  },
  {
    key: 'encapsulation-b',
    title: 'Encapsulation, again',
    text: 'Encapsulation hides fields behind getter and setter methods, so an object controls its own state.',
    placement: { kind: 'institute' },
  },
  {
    key: 'draft-hashing',
    title: 'Hashing (draft)',
    text: 'Hashing maps keys to buckets, and a good hash function spreads the keys evenly.',
    placement: { kind: 'draft' },
  },
  {
    key: 'archived-annotations',
    title: 'Annotations (archived)',
    text: 'Annotations add metadata to classes and methods for tools and frameworks to read.',
    placement: { kind: 'archived' },
  },
  {
    key: 'personal-notes',
    title: 'Personal notes',
    text: 'Personal notes on weak topics: binary search trees and their balancing rotations.',
    placement: { kind: 'personal' },
  },
  {
    key: 'other-lambdas',
    title: 'Lambdas (another institute)',
    text: 'Lambdas are anonymous functions passed as arguments to higher order methods.',
    placement: { kind: 'other-institute' },
  },
];

export const EVALUATION_QUERIES: readonly EvaluationQuery[] = [
  // Exact sentences.
  {
    id: 'exact-inheritance',
    kind: 'exact',
    query: 'Inheritance lets a subclass extend a superclass.',
    relevant: ['inheritance'],
  },
  {
    id: 'exact-interfaces',
    kind: 'exact',
    query: 'An interface declares abstract methods that a class promises to implement.',
    relevant: ['interfaces'],
  },
  {
    id: 'exact-loops',
    kind: 'exact',
    query: 'A while loop repeats while its condition stays true.',
    relevant: ['loops'],
  },
  {
    id: 'exact-recursion',
    kind: 'exact',
    query: 'Every recursive method needs a base case that stops the calls.',
    relevant: ['recursion'],
  },
  {
    id: 'exact-exceptions',
    kind: 'exact',
    query: 'A try block runs code that may throw, a catch block handles the exception.',
    relevant: ['exceptions'],
  },
  {
    id: 'exact-collections',
    kind: 'exact',
    query: 'A HashMap stores key and value pairs.',
    relevant: ['collections'],
  },
  {
    id: 'exact-generics',
    kind: 'exact',
    query: 'Generics give a collection or a method a type parameter.',
    relevant: ['generics'],
  },
  {
    id: 'exact-strings',
    kind: 'exact',
    query: 'Strings are immutable objects.',
    relevant: ['strings'],
  },
  {
    id: 'exact-streams',
    kind: 'exact',
    query: 'filter selects elements, map transforms each element, and collect gathers the results',
    relevant: ['streams'],
  },
  {
    id: 'exact-threads',
    kind: 'exact',
    query: 'Synchronized blocks protect shared state.',
    relevant: ['threads'],
  },
  // Paraphrases: the same question in other words, sharing some.
  {
    id: 'para-inheritance',
    kind: 'paraphrase',
    query: 'How can a subclass reuse and override the methods of its superclass?',
    relevant: ['inheritance'],
  },
  {
    id: 'para-collections',
    kind: 'paraphrase',
    query: 'Which type keeps unique elements, and which keeps key value pairs?',
    relevant: ['collections'],
  },
  {
    id: 'para-recursion',
    kind: 'paraphrase',
    query: 'What stops a recursive call from overflowing the stack?',
    relevant: ['recursion'],
  },
  {
    id: 'para-exceptions',
    kind: 'paraphrase',
    query: 'Handling an exception thrown inside a try block, with cleanup afterwards',
    relevant: ['exceptions'],
  },
  {
    id: 'para-strings',
    kind: 'paraphrase',
    query: 'Appending characters efficiently while building a string in a loop',
    relevant: ['strings'],
  },
  {
    id: 'para-threads',
    kind: 'paraphrase',
    query: 'Two threads running concurrently must not corrupt shared state',
    relevant: ['threads'],
  },
  {
    id: 'para-streams',
    kind: 'paraphrase',
    query: 'A pipeline that filters, maps and collects the elements of a collection',
    relevant: ['streams'],
  },
  {
    id: 'para-generics',
    kind: 'paraphrase',
    query: 'Letting the compiler check types with a type parameter instead of casts',
    relevant: ['generics'],
  },
  // Two topics at once.
  {
    id: 'multi-loops-recursion',
    kind: 'multi-topic',
    query: 'Repeating work with a loop or with a recursive method and its base case',
    relevant: ['loops', 'recursion'],
  },
  {
    id: 'multi-collections-generics',
    kind: 'multi-topic',
    query: 'Collections with a type parameter: lists, sets and maps checked by the compiler',
    relevant: ['collections', 'generics'],
  },
  // Asked from a course, and from a lesson.
  {
    id: 'course-arrays',
    kind: 'course',
    query: 'Elements of one type stored in a fixed number of slots indexed from zero',
    relevant: ['alpha-arrays'],
    context: { course: 'alpha' },
  },
  {
    id: 'lesson-variables',
    kind: 'lesson',
    query: 'Every variable has a declared type that fixes the values it may hold',
    relevant: ['alpha-lesson-1'],
    context: { lesson: 'alpha-1' },
  },
  // About nothing here.
  {
    id: 'irrelevant-soup',
    kind: 'irrelevant',
    query: 'A recipe for tomato soup with basil and croutons',
    relevant: [],
  },
  {
    id: 'irrelevant-football',
    kind: 'irrelevant',
    query: 'Who scored the winning goal in the football final',
    relevant: [],
  },
  // Written twice.
  {
    id: 'duplicate-encapsulation',
    kind: 'duplicate',
    query: 'Encapsulation hides fields behind getter and setter methods.',
    relevant: ['encapsulation-a', 'encapsulation-b'],
  },
  // The boundary: word for word, passages the person may not draw on.
  {
    id: 'boundary-beta',
    kind: 'boundary',
    query: 'Polymorphism means one method call reaches the right override at run time.',
    relevant: [],
    forbidden: ['beta-polymorphism'],
  },
  {
    id: 'boundary-staff',
    kind: 'boundary',
    query: 'Grade each submission against the marking scheme and moderate borderline grades.',
    relevant: [],
    forbidden: ['staff-rubric'],
  },
  {
    id: 'boundary-draft',
    kind: 'boundary',
    query: 'Hashing maps keys to buckets, a good hash function spreads keys evenly.',
    relevant: [],
    forbidden: ['draft-hashing'],
  },
  {
    id: 'boundary-archived',
    kind: 'boundary',
    query: 'Annotations add metadata to classes and methods for tools.',
    relevant: [],
    forbidden: ['archived-annotations'],
  },
  {
    id: 'boundary-personal',
    kind: 'boundary',
    query: 'Personal notes on weak topics: binary search trees and balancing rotations.',
    relevant: [],
    forbidden: ['personal-notes'],
  },
  {
    id: 'boundary-institute',
    kind: 'boundary',
    query: 'Lambdas are anonymous functions passed as arguments to higher order methods.',
    relevant: [],
    forbidden: ['other-lambdas'],
  },
  {
    id: 'boundary-locked-lesson',
    kind: 'boundary',
    query: 'Methods take parameters and return a value to their caller.',
    relevant: [],
    forbidden: ['alpha-lesson-2'],
  },
];
