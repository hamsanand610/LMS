/**
 * The Java track, SI Academy's strongest: the language, objects, collections, exceptions, streams
 * and concurrency, from first programs to interview and company-round problems.
 */
import type { BankQuestion } from './types.js';

const code = String.raw;

const JAVA_START = code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        // your code here
    }
}
`;
const JAVA_LINES = code`import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        // your code here
    }
}
`;
const PY_START = code`import sys

data = sys.stdin.read()
# your code here
`;
const JS_START = code`const input = require('fs').readFileSync(0, 'utf8');
// your code here
`;

export const JAVA: BankQuestion[] = [
  // ───────────── concepts ─────────────
  {
    slug: 'java-jdk-jre-jvm',
    type: 'mcq_single',
    title: 'What turns Main.java into something the JVM can run?',
    body: 'You have written `Main.java`. Which tool produces the `.class` file the JVM executes?',
    technology: 'core-java',
    topic: 'java-basics',
    level: 'beginner',
    marks: 1,
    options: [
      [
        'The JVM, when it starts',
        false,
        'The JVM runs bytecode; it does not compile source files.',
      ],
      [
        'javac, the compiler in the JDK',
        true,
        'javac compiles source into bytecode (.class files).',
      ],
      ['The JRE’s class loader', false, 'The class loader loads .class files that already exist.'],
      ['The operating system', false, 'The OS runs the JVM process, not Java source.'],
    ],
    explanation:
      '`javac Main.java` compiles to `Main.class`; `java Main` then starts a JVM that loads and runs it.',
  },
  {
    slug: 'java-final-class',
    type: 'mcq_single',
    title: 'Which keyword stops a class from being extended?',
    body: 'Choose the modifier that stops any other class inheriting from this one.',
    technology: 'core-java',
    topic: 'inheritance',
    level: 'foundation',
    marks: 1,
    options: [
      ['static', false],
      ['final', true],
      ['abstract', false, 'An abstract class exists to be extended.'],
      ['private', false, 'A top-level class cannot be private.'],
    ],
    explanation:
      '`final class Money { … }` cannot have subclasses; `String` is final for the same reason.',
  },
  {
    slug: 'java-string-equals',
    type: 'mcq_single',
    title: 'Comparing two strings in Java',
    body: 'Two `String` variables hold the same characters. Which expression reliably tells you so?\n\n```\nString a = new String("batch");\nString b = "batch";\n```',
    technology: 'core-java',
    topic: 'strings',
    level: 'easy',
    marks: 2,
    options: [
      ['a == b', false, '`==` compares references; here they are different objects.'],
      ['a.equals(b)', true, '`equals` compares the characters.'],
      ['a.compareTo(b) == 1', false, 'compareTo returns 0 for equal strings.'],
      ['a.hashCode() == b.hashCode()', false, 'Equal hash codes do not prove equal strings.'],
    ],
    explanation:
      '`==` asks whether two references point at the same object. `equals` compares contents, which is what you nearly always mean for strings.',
  },
  {
    slug: 'java-string-immutable',
    type: 'true_false',
    title: 'Java strings can be changed in place.',
    body: 'Decide whether calling `s.toUpperCase()` changes the string `s` refers to.',
    technology: 'core-java',
    topic: 'strings',
    level: 'foundation',
    marks: 1,
    answer: false,
    explanation:
      '`String` is immutable. `toUpperCase()` returns a new string; `s` still refers to the original unless you assign the result.',
  },
  {
    slug: 'java-overloading-vs-overriding',
    type: 'mcq_single',
    title: 'Overloading or overriding?',
    body: 'A subclass declares a method with the same name, the same parameter types and the same return type as a method in its parent class. What is this?',
    technology: 'core-java',
    topic: 'oop',
    level: 'easy',
    marks: 2,
    options: [
      ['Overloading', false, 'Overloading needs different parameter lists.'],
      ['Overriding', true],
      ['Hiding', false, 'Hiding applies to static methods.'],
      ['A compile error', false],
    ],
    explanation:
      'Same signature in a subclass is overriding: the subclass version runs for objects of the subclass, which is what makes polymorphism work.',
  },
  {
    slug: 'java-interface-default',
    type: 'mcq_multi',
    title: 'What can a Java interface contain?',
    body: 'Select everything a Java 17 interface may declare.',
    technology: 'core-java',
    topic: 'interfaces',
    level: 'medium',
    marks: 2,
    options: [
      ['Abstract methods', true],
      ['Default methods with a body', true],
      ['Static methods', true],
      [
        'Instance fields that each object gets its own copy of',
        false,
        'Fields in an interface are implicitly public static final constants.',
      ],
    ],
    explanation:
      'Since Java 8 interfaces can hold default and static methods; since Java 9, private methods too. Any field is a constant shared by all.',
  },
  {
    slug: 'java-arraylist-vs-linkedlist',
    type: 'mcq_single',
    title: 'Reading by index from a list',
    body: 'You read elements by position (`list.get(i)`) far more often than you insert in the middle. Which implementation fits?',
    technology: 'core-java',
    topic: 'collections',
    level: 'easy',
    marks: 2,
    options: [
      ['ArrayList', true, 'Index access is constant time.'],
      ['LinkedList', false, '`get(i)` walks the links, so it is linear.'],
      ['TreeSet', false, 'A set has no positions.'],
      ['HashMap', false],
    ],
    explanation:
      '`ArrayList` is backed by an array, so `get(i)` is O(1). `LinkedList` only wins for frequent insertion and removal at the ends through an iterator.',
  },
  {
    slug: 'java-hashmap-order',
    type: 'mcq_single',
    title: 'A map that remembers insertion order',
    body: 'You need a `Map` whose iteration order is the order entries were first put in.',
    technology: 'core-java',
    topic: 'collections',
    level: 'easy',
    marks: 2,
    options: [
      ['HashMap', false, 'Its iteration order is not specified.'],
      ['TreeMap', false, 'TreeMap iterates in key order.'],
      ['LinkedHashMap', true],
      ['Hashtable', false],
    ],
    explanation:
      '`LinkedHashMap` keeps a linked list through its entries in insertion order (or access order, if you ask for it).',
  },
  {
    slug: 'java-equals-hashcode',
    type: 'mcq_single',
    title: 'Overriding equals in a class used as a map key',
    body: 'You override `equals` in `StudentCode` and use it as a `HashMap` key. What else must you do?',
    technology: 'core-java',
    topic: 'collections',
    level: 'medium',
    marks: 2,
    options: [
      ['Nothing else', false, 'Equal keys would land in different buckets.'],
      ['Override hashCode consistently with equals', true],
      ['Implement Comparable', false, 'Only sorted structures need an ordering.'],
      ['Make the class final', false],
    ],
    explanation:
      'Objects that are equal must have equal hash codes, or `get` looks in the wrong bucket and misses the entry. Records generate both for you.',
  },
  {
    slug: 'java-checked-exceptions',
    type: 'mcq_single',
    title: 'Which of these is a checked exception?',
    body: 'Choose the exception the compiler forces you to catch or declare.',
    technology: 'core-java',
    topic: 'exceptions',
    level: 'easy',
    marks: 2,
    options: [
      ['NullPointerException', false],
      ['IOException', true],
      ['ArrayIndexOutOfBoundsException', false],
      ['IllegalArgumentException', false],
    ],
    explanation:
      '`IOException` extends `Exception` but not `RuntimeException`, so it is checked. The others are runtime exceptions.',
  },
  {
    slug: 'java-finally',
    type: 'true_false',
    title: 'A finally block runs even when the try block returns.',
    body: 'A method returns from inside its `try` block. Decide whether the `finally` block still runs.',
    technology: 'core-java',
    topic: 'exceptions',
    level: 'easy',
    marks: 1,
    answer: true,
    explanation:
      '`finally` runs on the way out whether the block returns, throws, or completes normally; only the JVM stopping (for example `System.exit`) skips it.',
  },
  {
    slug: 'java-stream-output',
    type: 'mcq_single',
    title: 'What does this stream print?',
    body: '```\nList<Integer> marks = List.of(35, 72, 58, 91, 40);\nlong passed = marks.stream().filter(m -> m >= 40).count();\nSystem.out.println(passed);\n```',
    technology: 'core-java',
    topic: 'streams',
    level: 'medium',
    marks: 2,
    options: [
      ['3', false],
      ['4', true, '72, 58, 91 and 40 are at least 40.'],
      ['5', false],
      ['2', false],
    ],
    explanation:
      '`filter` keeps marks of 40 or more (72, 58, 91, 40) and `count` returns 4. 35 is the only one dropped.',
  },
  {
    slug: 'java-optional',
    type: 'mcq_single',
    title: 'What is Optional for?',
    body: 'Why does `findFirst()` on a stream return an `Optional<T>` rather than `T`?',
    technology: 'core-java',
    topic: 'streams',
    level: 'medium',
    marks: 2,
    options: [
      ['To make the stream run in parallel', false],
      ['To say in the type that there may be no result', true],
      ['To copy the element safely', false],
      ['Because generics cannot return T', false],
    ],
    explanation:
      'An empty stream has no first element. `Optional` makes that possibility visible so the caller decides what to do instead of receiving `null`.',
  },
  {
    slug: 'java-thread-safety',
    type: 'mcq_single',
    title: 'Two threads increment one counter',
    body: 'Two threads each run `count++` on a shared `int` field 1 000 times. Why can the final value be less than 2 000?',
    technology: 'core-java',
    topic: 'multithreading',
    level: 'hard',
    marks: 3,
    options: [
      ['`int` overflows', false],
      ['`count++` is a read, an add and a write, which can interleave', true],
      ['Threads run one after another', false],
      ['The JVM drops updates on purpose', false],
    ],
    explanation:
      'Both threads can read the same old value and write back the same new value, losing an update. Use `AtomicInteger`, `synchronized`, or a lock.',
  },
  {
    slug: 'java-record',
    type: 'mcq_single',
    title: 'What does a record give you?',
    body: '`record Student(String code, String name) {}` — what do you get without writing it?',
    technology: 'core-java',
    topic: 'oop',
    level: 'medium',
    marks: 2,
    options: [
      ['Setters for both fields', false, 'Record fields are final; there are no setters.'],
      ['A constructor, accessors, equals, hashCode and toString', true],
      ['A database table', false],
      ['A mutable copy method', false],
    ],
    explanation:
      'Records are immutable data carriers: the canonical constructor, `code()` and `name()` accessors, and value-based `equals`, `hashCode` and `toString`.',
  },
  {
    slug: 'java-generics-erasure',
    type: 'mcq_single',
    title: 'Generics at run time',
    body: 'Why can you not write `new T()` inside a generic class `Box<T>`?',
    technology: 'core-java',
    topic: 'generics',
    level: 'interview',
    marks: 3,
    options: [
      ['T might be abstract', false, 'That is true but not the reason.'],
      ['Type arguments are erased at compile time, so T is unknown at run time', true],
      ['Generics only work with interfaces', false],
      ['Constructors cannot be generic', false],
    ],
    explanation:
      'Java implements generics by erasure: at run time a `Box<String>` is just a `Box`. Pass a `Supplier<T>` or a `Class<T>` if you need to create instances.',
  },
  {
    slug: 'java-explain-polymorphism',
    type: 'descriptive',
    title: 'Explain polymorphism with an example from a fee system',
    body: 'An institute charges fees differently for classroom, online and weekend learners. Explain how polymorphism lets the billing code treat them all the same way. Include a short class sketch in Java.',
    technology: 'core-java',
    topic: 'oop',
    level: 'medium',
    marks: 5,
    rubric:
      'Full marks (5): a common type (interface or abstract class) with a fee method; at least two implementations with different behaviour; billing code that calls the method through the common type without instanceof checks; a correct one-line definition of runtime dispatch. Take 1 off for each missing part; 0 if it only defines the word.',
  },
  {
    slug: 'java-explain-hashmap',
    type: 'descriptive',
    title: 'How does a HashMap find a value?',
    body: 'Describe what happens inside a `HashMap` when you call `get(key)`: hashing, buckets, and what happens when two keys land in the same bucket.',
    technology: 'core-java',
    topic: 'collections',
    level: 'interview',
    marks: 5,
    rubric:
      'Full marks (5): hashCode computes the bucket; equals confirms the key within the bucket; collisions are chained (a list, turned into a balanced tree past a threshold in Java 8+); average O(1), worst case degraded; resizing when the load factor is exceeded. 1 mark each.',
  },

  // ───────────── coding ─────────────
  {
    slug: 'java-grade-from-marks',
    type: 'coding',
    title: 'Grade from marks',
    body: 'Read a mark out of 100 and print the grade: `A` for 90 and above, `B` for 75 to 89, `C` for 60 to 74, `D` for 40 to 59, and `F` below 40.',
    technology: 'core-java',
    topic: 'conditions',
    level: 'beginner',
    marks: 5,
    practicePoints: 10,
    inputFormat: 'One whole number m.',
    outputFormat: 'One capital letter: the grade.',
    constraints: '0 ≤ m ≤ 100',
    hints: ['Test the highest band first and work down with else-if.'],
    explanation:
      'Check the bands from the top: once `m >= 90` fails, the next test only needs `m >= 75`, and so on.',
    languages: ['java', 'python', 'javascript'],
    starter: { java: JAVA_START, python: PY_START, javascript: JS_START },
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int m = in.nextInt();
        String grade;
        if (m >= 90) grade = "A";
        else if (m >= 75) grade = "B";
        else if (m >= 60) grade = "C";
        else if (m >= 40) grade = "D";
        else grade = "F";
        System.out.println(grade);
    }
}
`,
      python: code`m = int(input())
if m >= 90:
    print('A')
elif m >= 75:
    print('B')
elif m >= 60:
    print('C')
elif m >= 40:
    print('D')
else:
    print('F')
`,
      javascript: code`const m = Number(require('fs').readFileSync(0, 'utf8').trim());
console.log(m >= 90 ? 'A' : m >= 75 ? 'B' : m >= 60 ? 'C' : m >= 40 ? 'D' : 'F');
`,
    },
    cases: [
      { input: '95', expected: 'A', sample: true },
      { input: '62', expected: 'C', sample: true },
      { input: '90', expected: 'A', label: 'On the A boundary' },
      { input: '89', expected: 'B', label: 'Just under A' },
      { input: '40', expected: 'D', label: 'Pass mark' },
      { input: '39', expected: 'F' },
      { input: '0', expected: 'F' },
    ],
  },
  {
    slug: 'java-multiplication-table',
    type: 'coding',
    title: 'Multiplication table',
    body: 'Read a whole number n and print its multiplication table from 1 to 10, one line each, in the form `n x i = product`.',
    technology: 'core-java',
    topic: 'loops',
    level: 'beginner',
    marks: 5,
    practicePoints: 10,
    inputFormat: 'One whole number n.',
    outputFormat: 'Ten lines, for i from 1 to 10: `n x i = n*i`.',
    constraints: '-1 000 ≤ n ≤ 1 000',
    explanation: 'A `for` loop from 1 to 10 printing one formatted line each time.',
    languages: ['java', 'python', 'javascript'],
    starter: { java: JAVA_START, python: PY_START, javascript: JS_START },
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        for (int i = 1; i <= 10; i++) {
            System.out.println(n + " x " + i + " = " + (n * i));
        }
    }
}
`,
      python: code`n = int(input())
for i in range(1, 11):
    print(f'{n} x {i} = {n * i}')
`,
      javascript: code`const n = Number(require('fs').readFileSync(0, 'utf8').trim());
for (let i = 1; i <= 10; i += 1) console.log(n + ' x ' + i + ' = ' + n * i);
`,
    },
    cases: [
      {
        input: '7',
        expected:
          '7 x 1 = 7\n7 x 2 = 14\n7 x 3 = 21\n7 x 4 = 28\n7 x 5 = 35\n7 x 6 = 42\n7 x 7 = 49\n7 x 8 = 56\n7 x 9 = 63\n7 x 10 = 70',
        sample: true,
      },
      {
        input: '0',
        expected:
          '0 x 1 = 0\n0 x 2 = 0\n0 x 3 = 0\n0 x 4 = 0\n0 x 5 = 0\n0 x 6 = 0\n0 x 7 = 0\n0 x 8 = 0\n0 x 9 = 0\n0 x 10 = 0',
      },
      {
        input: '-3',
        expected:
          '-3 x 1 = -3\n-3 x 2 = -6\n-3 x 3 = -9\n-3 x 4 = -12\n-3 x 5 = -15\n-3 x 6 = -18\n-3 x 7 = -21\n-3 x 8 = -24\n-3 x 9 = -27\n-3 x 10 = -30',
        label: 'Negative',
      },
    ],
  },
  {
    slug: 'java-character-frequency',
    type: 'coding',
    title: 'Character frequency',
    body: 'Read one word of lower-case letters and print each letter that appears, in alphabetical order, with how many times it appears.',
    technology: 'core-java',
    topic: 'hashing',
    level: 'easy',
    marks: 10,
    practicePoints: 15,
    inputFormat: 'One word of lower-case letters a–z.',
    outputFormat:
      'One line per distinct letter, in alphabetical order: the letter, a space, and its count.',
    constraints: '1 ≤ length ≤ 100 000',
    hints: ["An `int[26]` indexed by `c - 'a'` counts every letter in one pass."],
    explanation:
      'Count into 26 slots, then print the slots that are not zero from a to z. A `TreeMap<Character, Integer>` also gives alphabetical order.',
    languages: ['java', 'python', 'javascript'],
    starter: { java: JAVA_START, python: PY_START, javascript: JS_START },
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String word = in.next();
        int[] counts = new int[26];
        for (char c : word.toCharArray()) {
            counts[c - 'a']++;
        }
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < 26; i++) {
            if (counts[i] > 0) {
                out.append((char) ('a' + i)).append(' ').append(counts[i]).append('\n');
            }
        }
        System.out.print(out);
    }
}
`,
      python: code`from collections import Counter

word = input().strip()
for letter, count in sorted(Counter(word).items()):
    print(letter, count)
`,
      javascript: code`const word = require('fs').readFileSync(0, 'utf8').trim();
const counts = {};
for (const c of word) counts[c] = (counts[c] || 0) + 1;
for (const c of Object.keys(counts).sort()) console.log(c + ' ' + counts[c]);
`,
    },
    cases: [
      { input: 'banana', expected: 'a 3\nb 1\nn 2', sample: true },
      { input: 'java', expected: 'a 2\nj 1\nv 1', sample: true },
      { input: 'z', expected: 'z 1', label: 'One letter' },
      { input: 'mississippi', expected: 'i 4\nm 1\np 2\ns 4' },
    ],
  },
  {
    slug: 'java-rotate-array',
    type: 'coding',
    title: 'Rotate an array to the right',
    body: 'Read n and k, then n whole numbers. Rotate the numbers k places to the right (the last k move to the front) and print them.',
    technology: 'core-java',
    topic: 'arrays',
    level: 'medium',
    marks: 10,
    practicePoints: 20,
    inputFormat: 'The first line holds n and k. The second line holds n whole numbers.',
    outputFormat: 'The rotated numbers on one line, separated by single spaces.',
    constraints: '1 ≤ n ≤ 100 000; 0 ≤ k ≤ 1 000 000 000',
    hints: [
      'k can be larger than n: only `k % n` matters.',
      'The element at index i ends up at index `(i + k) % n`.',
    ],
    explanation:
      'Reduce k modulo n, then place each element at `(i + k) % n` in a new array (or use three reversals for O(1) extra space).',
    languages: ['java', 'python', 'javascript'],
    starter: { java: JAVA_START, python: PY_START, javascript: JS_START },
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        long k = in.nextLong();
        long[] values = new long[n];
        for (int i = 0; i < n; i++) values[i] = in.nextLong();
        int shift = (int) (k % n);
        long[] rotated = new long[n];
        for (int i = 0; i < n; i++) rotated[(i + shift) % n] = values[i];
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < n; i++) {
            if (i > 0) out.append(' ');
            out.append(rotated[i]);
        }
        System.out.println(out);
    }
}
`,
      python: code`import sys

data = sys.stdin.read().split()
n, k = int(data[0]), int(data[1])
values = data[2:2 + n]
k %= n
print(' '.join(values[n - k:] + values[:n - k]))
`,
      javascript: code`const data = require('fs').readFileSync(0, 'utf8').trim().split(/\s+/);
const n = Number(data[0]);
const k = Number(data[1]) % n;
const values = data.slice(2, 2 + n);
console.log(values.slice(n - k).concat(values.slice(0, n - k)).join(' '));
`,
    },
    cases: [
      { input: '5 2\n1 2 3 4 5', expected: '4 5 1 2 3', sample: true },
      { input: '3 0\n7 8 9', expected: '7 8 9', sample: true, label: 'No rotation' },
      { input: '4 6\n10 20 30 40', expected: '30 40 10 20', label: 'k larger than n' },
      { input: '1 999999999\n42', expected: '42', label: 'One element' },
      { input: '6 3\n-1 -2 -3 4 5 6', expected: '4 5 6 -1 -2 -3' },
    ],
  },
  {
    slug: 'java-matrix-transpose',
    type: 'coding',
    title: 'Transpose a matrix',
    body: 'Read a matrix of r rows and c columns and print its transpose (rows become columns).',
    technology: 'core-java',
    topic: 'arrays',
    level: 'easy',
    marks: 10,
    practicePoints: 15,
    inputFormat: 'The first line holds r and c. Then r lines of c whole numbers.',
    outputFormat: 'c lines of r numbers each, separated by single spaces.',
    constraints: '1 ≤ r, c ≤ 200',
    explanation:
      'Element `[i][j]` of the input becomes `[j][i]` of the output: loop over columns outside, rows inside.',
    languages: ['java', 'python', 'javascript'],
    starter: { java: JAVA_START, python: PY_START, javascript: JS_START },
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int r = in.nextInt();
        int c = in.nextInt();
        int[][] m = new int[r][c];
        for (int i = 0; i < r; i++)
            for (int j = 0; j < c; j++)
                m[i][j] = in.nextInt();
        StringBuilder out = new StringBuilder();
        for (int j = 0; j < c; j++) {
            for (int i = 0; i < r; i++) {
                if (i > 0) out.append(' ');
                out.append(m[i][j]);
            }
            out.append('\n');
        }
        System.out.print(out);
    }
}
`,
      python: code`import sys

data = list(map(int, sys.stdin.read().split()))
r, c = data[0], data[1]
cells = data[2:]
for j in range(c):
    print(' '.join(str(cells[i * c + j]) for i in range(r)))
`,
      javascript: code`const data = require('fs').readFileSync(0, 'utf8').trim().split(/\s+/).map(Number);
const [r, c] = data;
const cells = data.slice(2);
for (let j = 0; j < c; j += 1) {
  const row = [];
  for (let i = 0; i < r; i += 1) row.push(cells[i * c + j]);
  console.log(row.join(' '));
}
`,
    },
    cases: [
      { input: '2 3\n1 2 3\n4 5 6', expected: '1 4\n2 5\n3 6', sample: true },
      { input: '1 1\n9', expected: '9', sample: true },
      { input: '3 1\n5\n6\n7', expected: '5 6 7', label: 'One column' },
      { input: '2 2\n-1 0\n0 -1', expected: '-1 0\n0 -1' },
    ],
  },
  {
    slug: 'java-bank-ledger',
    type: 'coding',
    title: 'Account ledger',
    body: 'Model a bank account. Read an opening balance and a list of transactions. `DEPOSIT x` adds x. `WITHDRAW x` takes x out only when the balance covers it; otherwise the withdrawal is refused and the balance stays the same. Print the final balance and the number of refused withdrawals.',
    technology: 'core-java',
    topic: 'oop',
    level: 'medium',
    marks: 10,
    practicePoints: 20,
    inputFormat:
      'The first line holds the opening balance and n. Then n lines, each `DEPOSIT x` or `WITHDRAW x`.',
    outputFormat: 'Two lines: the final balance, then the number of refused withdrawals.',
    constraints: '0 ≤ amounts ≤ 1 000 000 000; 0 ≤ n ≤ 10 000. Amounts are whole rupees.',
    hints: [
      'A small `Account` class with `deposit` and `withdraw` methods keeps the rules in one place.',
      'Use `long` for the balance.',
    ],
    explanation:
      'Keep the balance inside an `Account` object; `withdraw` returns whether it succeeded so the caller can count refusals. Rules live with the data they protect.',
    languages: ['java', 'python', 'javascript'],
    starter: {
      java: code`import java.util.*;

public class Main {
    static class Account {
        private long balance;

        Account(long opening) {
            this.balance = opening;
        }

        // add deposit(long amount) and boolean withdraw(long amount)
    }

    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        // read the opening balance and the transactions
    }
}
`,
      python: PY_START,
      javascript: JS_START,
    },
    solution: {
      java: code`import java.util.*;

public class Main {
    static class Account {
        private long balance;

        Account(long opening) {
            this.balance = opening;
        }

        void deposit(long amount) {
            balance += amount;
        }

        boolean withdraw(long amount) {
            if (amount > balance) return false;
            balance -= amount;
            return true;
        }

        long balance() {
            return balance;
        }
    }

    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        Account account = new Account(in.nextLong());
        int n = in.nextInt();
        int refused = 0;
        for (int i = 0; i < n; i++) {
            String kind = in.next();
            long amount = in.nextLong();
            if (kind.equals("DEPOSIT")) {
                account.deposit(amount);
            } else if (!account.withdraw(amount)) {
                refused++;
            }
        }
        System.out.println(account.balance());
        System.out.println(refused);
    }
}
`,
      python: code`import sys


class Account:
    def __init__(self, opening):
        self.balance = opening

    def deposit(self, amount):
        self.balance += amount

    def withdraw(self, amount):
        if amount > self.balance:
            return False
        self.balance -= amount
        return True


data = sys.stdin.read().split()
account = Account(int(data[0]))
n = int(data[1])
refused = 0
for i in range(n):
    kind, amount = data[2 + 2 * i], int(data[3 + 2 * i])
    if kind == 'DEPOSIT':
        account.deposit(amount)
    elif not account.withdraw(amount):
        refused += 1
print(account.balance)
print(refused)
`,
      javascript: code`class Account {
  constructor(opening) {
    this.balance = opening;
  }
  deposit(amount) {
    this.balance += amount;
  }
  withdraw(amount) {
    if (amount > this.balance) return false;
    this.balance -= amount;
    return true;
  }
}

const data = require('fs').readFileSync(0, 'utf8').trim().split(/\s+/);
const account = new Account(BigInt(data[0]));
const n = Number(data[1]);
let refused = 0;
for (let i = 0; i < n; i += 1) {
  const kind = data[2 + 2 * i];
  const amount = BigInt(data[3 + 2 * i]);
  if (kind === 'DEPOSIT') account.deposit(amount);
  else if (!account.withdraw(amount)) refused += 1;
}
console.log(account.balance.toString());
console.log(refused);
`,
    },
    cases: [
      {
        input: '1000 3\nDEPOSIT 500\nWITHDRAW 2000\nWITHDRAW 300',
        expected: '1200\n1',
        sample: true,
      },
      { input: '0 0', expected: '0\n0', sample: true, label: 'No transactions' },
      { input: '100 2\nWITHDRAW 100\nWITHDRAW 1', expected: '0\n1', label: 'Exactly to zero' },
      {
        input: '5000000000 4\nDEPOSIT 1000000000\nWITHDRAW 6000000000\nWITHDRAW 1\nDEPOSIT 7',
        expected: '7\n1',
        label: 'Large amounts',
      },
    ],
  },
  {
    slug: 'java-most-frequent-word',
    type: 'coding',
    title: 'Most frequent word',
    body: 'Read a line of text and print the word that appears most often, with its count. Compare words without regard to case and print them in lower case. If several words tie, print the one that comes first alphabetically.',
    technology: 'core-java',
    topic: 'hashing',
    level: 'interview',
    marks: 10,
    practicePoints: 25,
    inputFormat: 'One line of words made of letters, separated by single spaces.',
    outputFormat: 'The word in lower case, a space, and its count.',
    constraints: 'At most 100 000 words.',
    hints: [
      'Count with a map from word to count.',
      'Break ties by comparing the words themselves.',
    ],
    explanation:
      'Count lower-cased words in a `HashMap`, then pick the entry with the highest count, breaking ties with `compareTo` on the word.',
    languages: ['java', 'python', 'javascript'],
    starter: { java: JAVA_LINES, python: PY_START, javascript: JS_START },
    solution: {
      java: code`import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        String line = in.readLine();
        Map<String, Integer> counts = new HashMap<>();
        for (String word : line.strip().toLowerCase().split("\\s+")) {
            counts.merge(word, 1, Integer::sum);
        }
        String best = null;
        int bestCount = 0;
        for (Map.Entry<String, Integer> entry : counts.entrySet()) {
            int count = entry.getValue();
            if (count > bestCount || (count == bestCount && entry.getKey().compareTo(best) < 0)) {
                best = entry.getKey();
                bestCount = count;
            }
        }
        System.out.println(best + " " + bestCount);
    }
}
`,
      python: code`from collections import Counter

counts = Counter(input().lower().split())
word, count = min(counts.items(), key=lambda item: (-item[1], item[0]))
print(word, count)
`,
      javascript: code`const words = require('fs').readFileSync(0, 'utf8').trim().toLowerCase().split(/\s+/);
const counts = new Map();
for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
let best = null;
let bestCount = 0;
for (const [w, c] of counts) {
  if (c > bestCount || (c === bestCount && w < best)) {
    best = w;
    bestCount = c;
  }
}
console.log(best + ' ' + bestCount);
`,
    },
    cases: [
      { input: 'the batch and the trainer and the lab', expected: 'the 3', sample: true },
      { input: 'Java java JAVA spring', expected: 'java 3', sample: true, label: 'Mixed case' },
      { input: 'beta alpha', expected: 'alpha 1', label: 'Tie' },
      { input: 'sql sql java java', expected: 'java 2', label: 'Tie on two' },
    ],
  },
  {
    slug: 'java-longest-unique-substring',
    type: 'coding',
    title: 'Longest stretch without a repeated character',
    body: 'Read one word and print the length of the longest stretch of consecutive characters in which no character repeats.',
    technology: 'core-java',
    topic: 'two-pointers',
    level: 'hard',
    marks: 15,
    practicePoints: 30,
    inputFormat: 'One word of lower-case letters.',
    outputFormat: 'One whole number: the length of the longest stretch.',
    constraints: '1 ≤ length ≤ 100 000',
    hints: [
      'Grow a window to the right; when a character repeats, move the left edge past its previous position.',
      'Remember the last index where each character was seen.',
    ],
    explanation:
      'A sliding window with the last position of each character gives O(n): when `c` was last seen inside the window, move the left edge to just after it.',
    languages: ['java', 'python', 'javascript'],
    starter: { java: JAVA_START, python: PY_START, javascript: JS_START },
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String s = in.next();
        int[] last = new int[26];
        Arrays.fill(last, -1);
        int left = 0;
        int best = 0;
        for (int right = 0; right < s.length(); right++) {
            int c = s.charAt(right) - 'a';
            if (last[c] >= left) left = last[c] + 1;
            last[c] = right;
            best = Math.max(best, right - left + 1);
        }
        System.out.println(best);
    }
}
`,
      python: code`s = input().strip()
last = {}
left = 0
best = 0
for right, c in enumerate(s):
    if last.get(c, -1) >= left:
        left = last[c] + 1
    last[c] = right
    best = max(best, right - left + 1)
print(best)
`,
      javascript: code`const s = require('fs').readFileSync(0, 'utf8').trim();
const last = new Map();
let left = 0;
let best = 0;
for (let right = 0; right < s.length; right += 1) {
  const c = s[right];
  if (last.has(c) && last.get(c) >= left) left = last.get(c) + 1;
  last.set(c, right);
  best = Math.max(best, right - left + 1);
}
console.log(best);
`,
    },
    cases: [
      { input: 'abcabcbb', expected: '3', sample: true },
      { input: 'bbbbb', expected: '1', sample: true },
      { input: 'pwwkew', expected: '3' },
      { input: 'a', expected: '1', label: 'One character' },
      { input: 'abcdefghijklmnopqrstuvwxyz', expected: '26', label: 'All different' },
      { input: 'dvdf', expected: '3' },
    ],
  },
  {
    slug: 'java-run-length-encoding',
    type: 'coding',
    title: 'Compress a string by runs',
    body: 'Read one word and compress each run of the same character into the character followed by the length of the run. If the compressed form is not shorter than the original, print the original instead.',
    technology: 'core-java',
    topic: 'strings',
    level: 'company',
    marks: 15,
    practicePoints: 30,
    inputFormat: 'One word of letters.',
    outputFormat: 'The compressed word, or the original when compressing does not make it shorter.',
    constraints: '1 ≤ length ≤ 100 000',
    hints: [
      'Walk the word once, counting how long each run lasts.',
      'Build the result with a `StringBuilder`, then compare lengths.',
    ],
    explanation:
      'Count each run and append `char + count`; a run of length 1 still takes two characters, which is why short or varied words do not shrink.',
    languages: ['java', 'python', 'javascript'],
    starter: { java: JAVA_START, python: PY_START, javascript: JS_START },
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String s = in.next();
        StringBuilder out = new StringBuilder();
        int i = 0;
        while (i < s.length()) {
            char c = s.charAt(i);
            int j = i;
            while (j < s.length() && s.charAt(j) == c) j++;
            out.append(c).append(j - i);
            i = j;
        }
        System.out.println(out.length() < s.length() ? out.toString() : s);
    }
}
`,
      python: code`s = input().strip()
out = []
i = 0
while i < len(s):
    j = i
    while j < len(s) and s[j] == s[i]:
        j += 1
    out.append(s[i] + str(j - i))
    i = j
compressed = ''.join(out)
print(compressed if len(compressed) < len(s) else s)
`,
      javascript: code`const s = require('fs').readFileSync(0, 'utf8').trim();
let out = '';
let i = 0;
while (i < s.length) {
  let j = i;
  while (j < s.length && s[j] === s[i]) j += 1;
  out += s[i] + (j - i);
  i = j;
}
console.log(out.length < s.length ? out : s);
`,
    },
    cases: [
      { input: 'aaabbbbcc', expected: 'a3b4c2', sample: true },
      { input: 'abc', expected: 'abc', sample: true, label: 'Would grow' },
      { input: 'aabb', expected: 'aabb', label: 'Same length' },
      { input: 'zzzzzzzzzzzz', expected: 'z12', label: 'Two-digit run' },
      { input: 'aAaa', expected: 'aAaa', label: 'Case matters' },
    ],
  },

  // ───────────── hand-ins ─────────────
  {
    slug: 'java-project-library-cli',
    type: 'project',
    title: 'Project: a library desk in Java',
    body: 'Build a console application for a college library desk. It must let the librarian add books, register members, issue and return books, and list overdue loans (more than 14 days).\n\nUse classes for Book, Member and Loan; keep the data in collections; handle bad input with exceptions rather than crashes. Push the code to a repository and give its address.',
    technology: 'core-java',
    topic: 'oop',
    level: 'medium',
    marks: 20,
    rubric:
      'Design (6): sensible classes with private fields, no logic in main. Behaviour (6): all five operations work, including refusing to issue a book already on loan. Robustness (4): invalid input handled with exceptions and clear messages. Code quality (4): names, small methods, a README with how to run it.',
    spec: {
      fileKinds: ['zip'],
      maxFiles: 1,
      linkRequired: true,
      linkLabel: 'Repository address',
      checklist: [
        'The project compiles with javac or a build tool without errors',
        'The README explains how to run it',
        'Issuing a book already on loan is refused with a message',
        'Overdue loans are listed with the member’s name and the days overdue',
      ],
    },
  },
];
