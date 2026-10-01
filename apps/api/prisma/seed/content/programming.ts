/**
 * Programming foundations: the first problems every learner meets, answerable in Java, Python or
 * JavaScript. Slugs are kept from earlier releases so company kits and history still find them.
 */
import type { BankQuestion } from './types.js';

const code = String.raw;

const JAVA_READ_ALL = code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        // read the input and print the answer
    }
}
`;
const JAVA_READ_LINE = code`import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        String line = in.readLine();
        // print the answer
    }
}
`;
const PY_READ = code`import sys

data = sys.stdin.read()
# print the answer
`;
const JS_READ = code`const input = require('fs').readFileSync(0, 'utf8');
// print the answer
`;

const STARTERS = { java: JAVA_READ_ALL, python: PY_READ, javascript: JS_READ };
const LINE_STARTERS = { java: JAVA_READ_LINE, python: PY_READ, javascript: JS_READ };

export const PROGRAMMING: BankQuestion[] = [
  {
    slug: 'add-two-numbers',
    type: 'coding',
    title: 'Add two numbers',
    body: 'Read two whole numbers and print their sum.',
    technology: 'programming',
    topic: 'numbers',
    level: 'beginner',
    marks: 5,
    practicePoints: 10,
    inputFormat: 'Two whole numbers a and b on one line, separated by a space.',
    outputFormat: 'One line: a + b.',
    constraints: '-1 000 000 000 ≤ a, b ≤ 1 000 000 000',
    hints: [
      'Read both numbers before doing anything with them.',
      'The sum can be larger than either number; in Java use `long`.',
    ],
    explanation:
      'Read the two values as numbers, not text, add them, and print the result. In Java a `long` holds any sum within the limits.',
    languages: ['java', 'python', 'javascript'],
    starter: STARTERS,
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        long a = in.nextLong();
        long b = in.nextLong();
        System.out.println(a + b);
    }
}
`,
      python: code`a, b = map(int, input().split())
print(a + b)
`,
      javascript: code`const [a, b] = require('fs').readFileSync(0, 'utf8').trim().split(/\s+/).map(Number);
console.log(a + b);
`,
    },
    cases: [
      { input: '2 3', expected: '5', sample: true, label: 'Small numbers' },
      { input: '10 -4', expected: '6', sample: true, label: 'A negative number' },
      { input: '0 0', expected: '0', label: 'Zeros' },
      { input: '-7 -8', expected: '-15', label: 'Both negative' },
      { input: '1000000000 1000000000', expected: '2000000000', label: 'Beyond a 32-bit int' },
    ],
  },
  {
    slug: 'sum-of-the-digits',
    type: 'coding',
    title: 'Sum of the digits',
    body: 'Read a whole number that is zero or more and print the sum of its digits.',
    technology: 'programming',
    topic: 'numbers',
    level: 'beginner',
    marks: 5,
    practicePoints: 10,
    inputFormat: 'One line holding a whole number n with no sign.',
    outputFormat: 'One line: the sum of the digits of n.',
    constraints: 'n has at most 18 digits.',
    hints: [
      'Treat the number as text and walk its characters, or use `% 10` and `/ 10` in a loop.',
    ],
    explanation:
      'Each character is a digit; convert it and add. Working on the text avoids overflow entirely.',
    languages: ['java', 'python', 'javascript'],
    starter: STARTERS,
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String n = in.next();
        int sum = 0;
        for (char c : n.toCharArray()) {
            sum += c - '0';
        }
        System.out.println(sum);
    }
}
`,
      python: code`n = input().strip()
print(sum(int(c) for c in n))
`,
      javascript: code`const n = require('fs').readFileSync(0, 'utf8').trim();
console.log(n.split('').reduce((sum, d) => sum + Number(d), 0));
`,
    },
    cases: [
      { input: '1234', expected: '10', sample: true },
      { input: '0', expected: '0', sample: true },
      { input: '9999', expected: '36' },
      { input: '1000001', expected: '2' },
      { input: '999999999999999999', expected: '162', label: 'Eighteen digits' },
    ],
  },
  {
    slug: 'reverse-a-string',
    type: 'coding',
    title: 'Reverse a string',
    body: 'Read one line and print it backwards.',
    technology: 'programming',
    topic: 'strings',
    level: 'beginner',
    marks: 5,
    practicePoints: 10,
    inputFormat: 'One line of text (letters, digits and spaces).',
    outputFormat: 'The same line, character by character in reverse order.',
    constraints: 'At most 1 000 characters.',
    explanation:
      'Walk the characters from the last to the first, or use the language’s own reverse: `StringBuilder.reverse()` in Java, slicing with `[::-1]` in Python.',
    languages: ['java', 'python', 'javascript'],
    starter: LINE_STARTERS,
    solution: {
      java: code`import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        String line = in.readLine();
        if (line == null) line = "";
        System.out.println(new StringBuilder(line.strip()).reverse());
    }
}
`,
      python: code`s = input().strip()
print(s[::-1])
`,
      javascript: code`const s = require('fs').readFileSync(0, 'utf8').trim();
console.log([...s].reverse().join(''));
`,
    },
    cases: [
      { input: 'hello', expected: 'olleh', sample: true },
      { input: 'a', expected: 'a', sample: true, label: 'One character' },
      { input: 'racecar', expected: 'racecar' },
      { input: 'SI Academy', expected: 'ymedacA IS', label: 'With a space' },
      { input: '2026 batch', expected: 'hctab 6202' },
    ],
  },
  {
    slug: 'count-the-vowels',
    type: 'coding',
    title: 'Count the vowels',
    body: 'Read one line and print how many vowels (a, e, i, o, u) it contains. Upper and lower case count alike.',
    technology: 'programming',
    topic: 'strings',
    level: 'foundation',
    marks: 5,
    practicePoints: 10,
    inputFormat: 'One line of text.',
    outputFormat: 'One line: the number of vowels.',
    constraints: 'At most 1 000 characters.',
    explanation: 'Lower-case the line once, then count the characters that appear in "aeiou".',
    languages: ['java', 'python', 'javascript'],
    starter: LINE_STARTERS,
    solution: {
      java: code`import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        String line = in.readLine();
        int count = 0;
        if (line != null) {
            for (char c : line.toLowerCase().toCharArray()) {
                if ("aeiou".indexOf(c) >= 0) count++;
            }
        }
        System.out.println(count);
    }
}
`,
      python: code`s = input().strip().lower()
print(sum(1 for c in s if c in 'aeiou'))
`,
      javascript: code`const s = require('fs').readFileSync(0, 'utf8').trim().toLowerCase();
console.log([...s].filter((c) => 'aeiou'.includes(c)).length);
`,
    },
    cases: [
      { input: 'Programming', expected: '3', sample: true },
      { input: 'xyz', expected: '0', sample: true, label: 'No vowels' },
      { input: 'AEIOU', expected: '5', label: 'Capitals' },
      { input: 'Chennai Central', expected: '5' },
    ],
  },
  {
    slug: 'count-the-words',
    type: 'coding',
    title: 'Count the words',
    body: 'Read one line of text and print how many words it has. Words are separated by one or more spaces.',
    technology: 'programming',
    topic: 'strings',
    level: 'easy',
    marks: 5,
    practicePoints: 10,
    inputFormat: 'One line of text; there may be several spaces between words.',
    outputFormat: 'One line: the number of words.',
    constraints: 'At most 1 000 characters; at least one word.',
    explanation:
      'Split on runs of whitespace (`\\s+`) after trimming, so extra spaces do not create empty words.',
    languages: ['java', 'python', 'javascript'],
    starter: LINE_STARTERS,
    solution: {
      java: code`import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        String line = in.readLine();
        String text = line == null ? "" : line.strip();
        System.out.println(text.isEmpty() ? 0 : text.split("\\s+").length);
    }
}
`,
      python: code`print(len(input().split()))
`,
      javascript: code`const t = require('fs').readFileSync(0, 'utf8').trim();
console.log(t ? t.split(/\s+/).length : 0);
`,
    },
    cases: [
      { input: 'hello world', expected: '2', sample: true },
      { input: 'single', expected: '1', sample: true },
      { input: 'one   two three', expected: '3', label: 'Extra spaces' },
      { input: 'a b c d e', expected: '5' },
    ],
  },
  {
    slug: 'fizzbuzz-up-to-n',
    type: 'coding',
    title: 'FizzBuzz up to n',
    body: 'Read a whole number n and print the numbers 1 to n on one line, separated by single spaces. Replace multiples of three with `Fizz`, multiples of five with `Buzz`, and multiples of both with `FizzBuzz`.',
    technology: 'programming',
    topic: 'loops',
    level: 'easy',
    marks: 10,
    practicePoints: 20,
    inputFormat: 'One whole number n.',
    outputFormat: 'One line of n words separated by single spaces.',
    constraints: '1 ≤ n ≤ 1 000',
    hints: ['Check for multiples of 15 first; otherwise a multiple of both prints only `Fizz`.'],
    explanation:
      'Test divisibility by 15, then 3, then 5, in that order, and join the words with spaces.',
    languages: ['java', 'python', 'javascript'],
    starter: STARTERS,
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        StringBuilder out = new StringBuilder();
        for (int i = 1; i <= n; i++) {
            if (i > 1) out.append(' ');
            if (i % 15 == 0) out.append("FizzBuzz");
            else if (i % 3 == 0) out.append("Fizz");
            else if (i % 5 == 0) out.append("Buzz");
            else out.append(i);
        }
        System.out.println(out);
    }
}
`,
      python: code`n = int(input())
out = []
for i in range(1, n + 1):
    out.append('FizzBuzz' if i % 15 == 0 else 'Fizz' if i % 3 == 0 else 'Buzz' if i % 5 == 0 else str(i))
print(' '.join(out))
`,
      javascript: code`const n = Number(require('fs').readFileSync(0, 'utf8').trim());
const out = [];
for (let i = 1; i <= n; i += 1) {
  out.push(i % 15 === 0 ? 'FizzBuzz' : i % 3 === 0 ? 'Fizz' : i % 5 === 0 ? 'Buzz' : String(i));
}
console.log(out.join(' '));
`,
    },
    cases: [
      {
        input: '15',
        expected: '1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz',
        sample: true,
      },
      { input: '5', expected: '1 2 Fizz 4 Buzz', sample: true },
      { input: '1', expected: '1' },
      { input: '3', expected: '1 2 Fizz' },
      {
        input: '30',
        expected:
          '1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz 16 17 Fizz 19 Buzz Fizz 22 23 Fizz Buzz 26 Fizz 28 29 FizzBuzz',
      },
    ],
  },
  {
    slug: 'largest-in-a-list',
    type: 'coding',
    title: 'Largest in a list',
    body: 'Read a count n and then n whole numbers. Print the largest of them.',
    technology: 'programming',
    topic: 'arrays',
    level: 'easy',
    marks: 10,
    practicePoints: 20,
    inputFormat:
      'The first line holds n. The second line holds n whole numbers separated by spaces.',
    outputFormat: 'One line: the largest number.',
    constraints: '1 ≤ n ≤ 100 000; each number fits in a 64-bit integer.',
    explanation:
      'Start from the first number (or the smallest possible value) and keep the larger each time; never start from 0, or a list of negatives goes wrong.',
    languages: ['java', 'python', 'javascript'],
    starter: STARTERS,
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        long best = Long.MIN_VALUE;
        for (int i = 0; i < n; i++) {
            best = Math.max(best, in.nextLong());
        }
        System.out.println(best);
    }
}
`,
      python: code`import sys

nums = list(map(int, sys.stdin.read().split()))
n = nums[0]
print(max(nums[1:1 + n]))
`,
      javascript: code`const nums = require('fs').readFileSync(0, 'utf8').trim().split(/\s+/).map(Number);
const n = nums[0];
console.log(Math.max(...nums.slice(1, 1 + n)));
`,
    },
    cases: [
      { input: '5\n3 9 2 7 4', expected: '9', sample: true },
      { input: '3\n-5 -2 -9', expected: '-2', sample: true, label: 'All negative' },
      { input: '1\n42', expected: '42', label: 'One number' },
      { input: '6\n1 1 1 1 1 2', expected: '2', label: 'Largest last' },
    ],
  },
  {
    slug: 'second-largest-number',
    type: 'coding',
    title: 'Second largest number',
    body: 'Read whole numbers separated by spaces and print the second largest distinct value. If there is no such value, print `NONE`.',
    technology: 'programming',
    topic: 'arrays',
    level: 'medium',
    marks: 10,
    practicePoints: 15,
    inputFormat: 'One line of whole numbers separated by spaces.',
    outputFormat: 'One line: the second largest distinct number, or NONE.',
    constraints: 'At most 100 000 numbers.',
    hints: [
      'Repeated values count once: in `5 5 3` the answer is 3.',
      'One pass with two variables is enough; sorting also works.',
    ],
    explanation:
      'Keep the largest and second largest distinct values while scanning, or sort the distinct values in descending order and take the second.',
    languages: ['java', 'python', 'javascript'],
    starter: STARTERS,
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        TreeSet<Long> seen = new TreeSet<>();
        while (in.hasNextLong()) {
            seen.add(in.nextLong());
        }
        if (seen.size() < 2) {
            System.out.println("NONE");
        } else {
            seen.pollLast();
            System.out.println(seen.last());
        }
    }
}
`,
      python: code`import sys

nums = sorted(set(map(int, sys.stdin.read().split())), reverse=True)
print('NONE' if len(nums) < 2 else nums[1])
`,
      javascript: code`const nums = [...new Set(require('fs').readFileSync(0, 'utf8').trim().split(/\s+/).map(Number))].sort((a, b) => b - a);
console.log(nums.length < 2 ? 'NONE' : nums[1]);
`,
    },
    cases: [
      { input: '4 1 9 7', expected: '7', sample: true },
      { input: '5 5 5', expected: 'NONE', sample: true, label: 'All the same' },
      { input: '10 20', expected: '10' },
      { input: '-3 -1 -2', expected: '-2', label: 'Negatives' },
      { input: '8', expected: 'NONE', label: 'One number' },
      { input: '9 9 4 4 1', expected: '4', label: 'Repeats' },
    ],
  },
  {
    slug: 'remove-the-duplicates',
    type: 'coding',
    title: 'Remove the duplicates',
    body: 'Read whole numbers separated by spaces and print them with repeats removed, keeping the first time each appears.',
    technology: 'programming',
    topic: 'arrays',
    level: 'easy',
    marks: 10,
    practicePoints: 10,
    inputFormat: 'One line of whole numbers separated by spaces.',
    outputFormat:
      'The numbers in their original order without repeats, separated by single spaces.',
    constraints: 'At most 100 000 numbers.',
    explanation:
      'Remember what you have printed in a set; print a number only the first time you meet it. A `LinkedHashSet` in Java keeps insertion order for you.',
    languages: ['java', 'python', 'javascript'],
    starter: STARTERS,
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        while (in.hasNext()) {
            seen.add(in.next());
        }
        System.out.println(String.join(" ", seen));
    }
}
`,
      python: code`import sys

seen = set()
out = []
for x in sys.stdin.read().split():
    if x not in seen:
        seen.add(x)
        out.append(x)
print(' '.join(out))
`,
      javascript: code`const seen = new Set();
const out = [];
for (const x of require('fs').readFileSync(0, 'utf8').trim().split(/\s+/)) {
  if (!seen.has(x)) {
    seen.add(x);
    out.push(x);
  }
}
console.log(out.join(' '));
`,
    },
    cases: [
      { input: '3 1 3 2 1', expected: '3 1 2', sample: true },
      { input: '7 7 7', expected: '7', sample: true },
      { input: '1 2 3', expected: '1 2 3', label: 'Nothing repeated' },
      { input: '5 -5 5 -5 0', expected: '5 -5 0' },
    ],
  },
  {
    slug: 'is-it-a-palindrome',
    type: 'coding',
    title: 'Is it a palindrome?',
    body: 'Read one line and print `YES` if it reads the same backwards, ignoring case, spaces and punctuation, and `NO` otherwise.',
    technology: 'programming',
    topic: 'strings',
    level: 'medium',
    marks: 10,
    practicePoints: 30,
    inputFormat: 'One line of text.',
    outputFormat: 'YES or NO.',
    constraints: 'At most 1 000 characters.',
    hints: ['Keep only letters and digits, lower-cased, before comparing.'],
    explanation:
      'Normalise first (letters and digits only, lower case), then compare the text with its reverse, or walk two indices towards the middle.',
    languages: ['java', 'python', 'javascript'],
    starter: LINE_STARTERS,
    solution: {
      java: code`import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        String line = in.readLine();
        if (line == null) line = "";
        String s = line.toLowerCase().replaceAll("[^a-z0-9]", "");
        String reversed = new StringBuilder(s).reverse().toString();
        System.out.println(s.equals(reversed) ? "YES" : "NO");
    }
}
`,
      python: code`import re

s = re.sub(r'[^a-z0-9]', '', input().strip().lower())
print('YES' if s == s[::-1] else 'NO')
`,
      javascript: code`const s = require('fs').readFileSync(0, 'utf8').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
console.log(s === [...s].reverse().join('') ? 'YES' : 'NO');
`,
    },
    cases: [
      { input: 'Never odd or even', expected: 'YES', sample: true },
      { input: 'hello', expected: 'NO', sample: true },
      { input: 'A man, a plan, a canal: Panama', expected: 'YES', label: 'Punctuation' },
      { input: 'ab', expected: 'NO' },
      { input: 'Was it a car or a cat I saw?', expected: 'YES' },
    ],
  },
  {
    slug: 'are-they-anagrams',
    type: 'coding',
    title: 'Are they anagrams?',
    body: 'Read two words. Print `YES` if one is an anagram of the other, ignoring upper and lower case, and `NO` otherwise.',
    technology: 'programming',
    topic: 'strings',
    level: 'medium',
    marks: 10,
    practicePoints: 15,
    inputFormat: 'Two words on one line, separated by a space.',
    outputFormat: 'YES or NO.',
    constraints: 'Each word has at most 100 letters.',
    explanation:
      'Two words are anagrams when their sorted, lower-cased letters are equal; counting letters in a 26-slot array is the linear-time version.',
    languages: ['java', 'python', 'javascript'],
    starter: STARTERS,
    solution: {
      java: code`import java.util.*;

public class Main {
    static String key(String word) {
        char[] letters = word.toLowerCase().toCharArray();
        Arrays.sort(letters);
        return new String(letters);
    }

    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String a = in.next();
        String b = in.next();
        System.out.println(key(a).equals(key(b)) ? "YES" : "NO");
    }
}
`,
      python: code`a, b = input().split()

def key(word):
    return ''.join(sorted(word.lower()))

print('YES' if key(a) == key(b) else 'NO')
`,
      javascript: code`const [a, b] = require('fs').readFileSync(0, 'utf8').trim().split(/\s+/);
const key = (w) => w.toLowerCase().split('').sort().join('');
console.log(key(a) === key(b) ? 'YES' : 'NO');
`,
    },
    cases: [
      { input: 'listen silent', expected: 'YES', sample: true },
      { input: 'apple paper', expected: 'NO', sample: true },
      { input: 'Triangle integral', expected: 'YES', label: 'Mixed case' },
      { input: 'rat car', expected: 'NO' },
      { input: 'Dusty study', expected: 'YES' },
    ],
  },
  {
    slug: 'balanced-brackets',
    type: 'coding',
    title: 'Balanced brackets',
    body: 'Read one line made of the characters `()[]{}` and print `YES` if every bracket is closed in the right order, otherwise `NO`.',
    technology: 'programming',
    topic: 'stacks-queues',
    level: 'medium',
    marks: 10,
    practicePoints: 15,
    inputFormat: 'One line of brackets.',
    outputFormat: 'YES or NO.',
    constraints: 'At most 100 000 characters.',
    hints: [
      'Push every opening bracket; a closing bracket must match the one on top.',
      'Anything left on the stack at the end means NO.',
    ],
    explanation:
      'A stack mirrors nesting: the most recent unclosed bracket is the one the next closing bracket must match.',
    languages: ['java', 'python', 'javascript'],
    starter: LINE_STARTERS,
    solution: {
      java: code`import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        String line = in.readLine();
        if (line == null) line = "";
        Deque<Character> stack = new ArrayDeque<>();
        boolean ok = true;
        for (char c : line.strip().toCharArray()) {
            if (c == '(' || c == '[' || c == '{') {
                stack.push(c);
            } else {
                char open = c == ')' ? '(' : c == ']' ? '[' : '{';
                if (stack.isEmpty() || stack.pop() != open) {
                    ok = false;
                    break;
                }
            }
        }
        System.out.println(ok && stack.isEmpty() ? "YES" : "NO");
    }
}
`,
      python: code`s = input().strip()
pairs = {')': '(', ']': '[', '}': '{'}
stack = []
ok = True
for c in s:
    if c in '([{':
        stack.append(c)
    elif c in pairs:
        if not stack or stack.pop() != pairs[c]:
            ok = False
            break
print('YES' if ok and not stack else 'NO')
`,
      javascript: code`const s = require('fs').readFileSync(0, 'utf8').trim();
const pairs = { ')': '(', ']': '[', '}': '{' };
const stack = [];
let ok = true;
for (const c of s) {
  if ('([{'.includes(c)) stack.push(c);
  else if (pairs[c]) {
    if (stack.pop() !== pairs[c]) {
      ok = false;
      break;
    }
  }
}
console.log(ok && stack.length === 0 ? 'YES' : 'NO');
`,
    },
    cases: [
      { input: '([]{})', expected: 'YES', sample: true },
      { input: '([)]', expected: 'NO', sample: true, label: 'Crossed' },
      { input: '((', expected: 'NO', label: 'Left open' },
      { input: '{[()()]}', expected: 'YES' },
      { input: ')(', expected: 'NO', label: 'Closed first' },
    ],
  },
];
