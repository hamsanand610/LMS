/**
 * Data structures and algorithms: the problems interviews are built from, with the reasoning about
 * cost that interviewers listen for.
 */
import type { BankQuestion } from './types.js';

const code = String.raw;

const STARTERS = {
  java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        // your code here
    }
}
`,
  python: code`import sys

data = sys.stdin.read().split()
# your code here
`,
  javascript: code`const data = require('fs').readFileSync(0, 'utf8').trim().split(/\s+/);
// your code here
`,
};

export const DSA: BankQuestion[] = [
  {
    slug: 'dsa-binary-search-first',
    type: 'coding',
    title: 'First position in a sorted list',
    body: 'Read a sorted list and a target. Print the index (counting from 0) of the first place the target appears, or -1 if it does not appear.',
    technology: 'dsa',
    topic: 'searching',
    level: 'medium',
    marks: 10,
    practicePoints: 20,
    inputFormat:
      'The first line holds n and the target. The second line holds n whole numbers in non-decreasing order.',
    outputFormat: 'One whole number: the first index of the target, or -1.',
    constraints: '1 ≤ n ≤ 200 000',
    hints: [
      'A plain binary search stops at any match; keep searching to the left after a match.',
      'O(log n) is the point: a linear scan works but misses the lesson.',
    ],
    explanation:
      'Binary search that, on a match, records the index and continues in the left half. It takes about log₂(n) steps: 18 for 200 000 numbers.',
    languages: ['java', 'python', 'javascript'],
    starter: STARTERS,
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        long target = in.nextLong();
        long[] a = new long[n];
        for (int i = 0; i < n; i++) a[i] = in.nextLong();
        int lo = 0, hi = n - 1, found = -1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (a[mid] == target) {
                found = mid;
                hi = mid - 1;
            } else if (a[mid] < target) {
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        System.out.println(found);
    }
}
`,
      python: code`import sys

data = list(map(int, sys.stdin.read().split()))
n, target = data[0], data[1]
a = data[2:2 + n]
lo, hi, found = 0, n - 1, -1
while lo <= hi:
    mid = (lo + hi) // 2
    if a[mid] == target:
        found = mid
        hi = mid - 1
    elif a[mid] < target:
        lo = mid + 1
    else:
        hi = mid - 1
print(found)
`,
      javascript: code`const data = require('fs').readFileSync(0, 'utf8').trim().split(/\s+/).map(Number);
const [n, target] = data;
const a = data.slice(2, 2 + n);
let lo = 0;
let hi = n - 1;
let found = -1;
while (lo <= hi) {
  const mid = (lo + hi) >> 1;
  if (a[mid] === target) {
    found = mid;
    hi = mid - 1;
  } else if (a[mid] < target) lo = mid + 1;
  else hi = mid - 1;
}
console.log(found);
`,
    },
    cases: [
      { input: '7 4\n1 2 4 4 4 7 9', expected: '2', sample: true },
      { input: '5 6\n1 3 5 7 9', expected: '-1', sample: true, label: 'Not present' },
      { input: '1 5\n5', expected: '0', label: 'One element' },
      { input: '6 1\n1 1 1 1 1 1', expected: '0', label: 'All the same' },
      { input: '4 10\n2 4 6 8', expected: '-1', label: 'Past the end' },
    ],
  },
  {
    slug: 'dsa-two-sum',
    type: 'coding',
    title: 'Two numbers that add up',
    body: 'Read a list and a target. Exactly one pair of positions holds numbers that add up to the target. Print the two positions (counting from 0), smaller first.',
    technology: 'dsa',
    topic: 'hashing',
    level: 'interview',
    marks: 10,
    practicePoints: 25,
    inputFormat: 'The first line holds n and the target. The second line holds n whole numbers.',
    outputFormat: 'Two indices i and j with i < j, separated by a space.',
    constraints: '2 ≤ n ≤ 100 000; exactly one pair adds up to the target.',
    hints: [
      'For each number, the partner you need is target − number.',
      'Remember where you saw each number in a map as you go.',
    ],
    explanation:
      'One pass with a map from value to index: when `target − a[j]` is already in the map, those two indices are the answer. O(n) time instead of the O(n²) double loop.',
    languages: ['java', 'python', 'javascript'],
    starter: STARTERS,
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        long target = in.nextLong();
        Map<Long, Integer> seen = new HashMap<>();
        for (int j = 0; j < n; j++) {
            long value = in.nextLong();
            Integer i = seen.get(target - value);
            if (i != null) {
                System.out.println(i + " " + j);
                return;
            }
            seen.putIfAbsent(value, j);
        }
    }
}
`,
      python: code`import sys

data = list(map(int, sys.stdin.read().split()))
n, target = data[0], data[1]
seen = {}
for j, value in enumerate(data[2:2 + n]):
    if target - value in seen:
        print(seen[target - value], j)
        break
    seen.setdefault(value, j)
`,
      javascript: code`const data = require('fs').readFileSync(0, 'utf8').trim().split(/\s+/).map(Number);
const [n, target] = data;
const seen = new Map();
for (let j = 0; j < n; j += 1) {
  const value = data[2 + j];
  if (seen.has(target - value)) {
    console.log(seen.get(target - value) + ' ' + j);
    break;
  }
  if (!seen.has(value)) seen.set(value, j);
}
`,
    },
    cases: [
      { input: '4 9\n2 7 11 15', expected: '0 1', sample: true },
      { input: '3 6\n3 2 4', expected: '1 2', sample: true },
      { input: '2 6\n3 3', expected: '0 1', label: 'Same value twice' },
      { input: '5 -8\n-1 -2 -3 -4 -5', expected: '2 4', label: 'Negatives' },
      { input: '6 0\n4 -9 13 9 7 1', expected: '1 3' },
    ],
  },
  {
    slug: 'dsa-max-subarray',
    type: 'coding',
    title: 'Best run of consecutive numbers',
    body: 'Read a list of whole numbers and print the largest sum of a non-empty stretch of consecutive numbers.',
    technology: 'dsa',
    topic: 'dynamic-programming',
    level: 'hard',
    marks: 15,
    practicePoints: 30,
    inputFormat: 'The first line holds n. The second line holds n whole numbers.',
    outputFormat: 'One whole number: the largest sum.',
    constraints: '1 ≤ n ≤ 200 000; |value| ≤ 1 000 000 000',
    hints: [
      'At each position, the best stretch ending here either extends the previous one or starts fresh.',
      'If every number is negative, the answer is the largest single number.',
    ],
    explanation:
      'Kadane’s algorithm: `best_here = max(x, best_here + x)`, and the answer is the largest `best_here` seen. O(n) time, O(1) space; use 64-bit sums.',
    languages: ['java', 'python', 'javascript'],
    starter: STARTERS,
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        long bestHere = in.nextLong();
        long best = bestHere;
        for (int i = 1; i < n; i++) {
            long x = in.nextLong();
            bestHere = Math.max(x, bestHere + x);
            best = Math.max(best, bestHere);
        }
        System.out.println(best);
    }
}
`,
      python: code`import sys

data = list(map(int, sys.stdin.read().split()))
n = data[0]
values = data[1:1 + n]
best_here = best = values[0]
for x in values[1:]:
    best_here = max(x, best_here + x)
    best = max(best, best_here)
print(best)
`,
      javascript: code`const data = require('fs').readFileSync(0, 'utf8').trim().split(/\s+/).map(Number);
const n = data[0];
let bestHere = data[1];
let best = bestHere;
for (let i = 2; i <= n; i += 1) {
  bestHere = Math.max(data[i], bestHere + data[i]);
  best = Math.max(best, bestHere);
}
console.log(best);
`,
    },
    cases: [
      { input: '9\n-2 1 -3 4 -1 2 1 -5 4', expected: '6', sample: true },
      { input: '3\n-3 -1 -2', expected: '-1', sample: true, label: 'All negative' },
      { input: '1\n7', expected: '7', label: 'One number' },
      {
        input: '5\n1000000000 1000000000 -5 1000000000 1000000000',
        expected: '3999999995',
        label: 'Needs 64 bits',
      },
      { input: '6\n2 -1 2 -1 2 -10', expected: '4' },
    ],
  },
  {
    slug: 'dsa-climbing-stairs',
    type: 'coding',
    title: 'Ways to climb the stairs',
    body: 'A staircase has n steps. You climb one or two steps at a time. Print how many different ways there are to reach the top.',
    technology: 'dsa',
    topic: 'dynamic-programming',
    level: 'medium',
    marks: 10,
    practicePoints: 20,
    inputFormat: 'One whole number n.',
    outputFormat: 'One whole number: the number of ways.',
    constraints: '1 ≤ n ≤ 80',
    hints: [
      'The last move was either one step or two: ways(n) = ways(n − 1) + ways(n − 2).',
      'Plain recursion repeats work; build up from the bottom instead.',
    ],
    explanation:
      'This is the Fibonacci recurrence. Two variables built from the bottom give O(n) time; for n = 80 the answer needs a 64-bit integer.',
    languages: ['java', 'python', 'javascript'],
    starter: STARTERS,
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        long a = 1, b = 1;
        for (int i = 2; i <= n; i++) {
            long next = a + b;
            a = b;
            b = next;
        }
        System.out.println(b);
    }
}
`,
      python: code`n = int(input())
a, b = 1, 1
for _ in range(2, n + 1):
    a, b = b, a + b
print(b)
`,
      javascript: code`const n = Number(require('fs').readFileSync(0, 'utf8').trim());
let a = 1n;
let b = 1n;
for (let i = 2; i <= n; i += 1) {
  const next = a + b;
  a = b;
  b = next;
}
console.log(b.toString());
`,
    },
    cases: [
      { input: '2', expected: '2', sample: true },
      { input: '5', expected: '8', sample: true },
      { input: '1', expected: '1', label: 'One step' },
      { input: '45', expected: '1836311903' },
      { input: '80', expected: '37889062373143906', label: 'Needs 64 bits' },
    ],
  },
  {
    slug: 'dsa-kth-smallest',
    type: 'coding',
    title: 'The k-th smallest number',
    body: 'Read a list and a number k. Print the k-th smallest number (k = 1 is the smallest). Repeated values each count.',
    technology: 'dsa',
    topic: 'sorting',
    level: 'easy',
    marks: 5,
    practicePoints: 15,
    inputFormat: 'The first line holds n and k. The second line holds n whole numbers.',
    outputFormat: 'One whole number.',
    constraints: '1 ≤ k ≤ n ≤ 200 000',
    explanation:
      'Sort and take position k − 1: O(n log n). A heap of size k, or quickselect, does better for large n and small k.',
    languages: ['java', 'python', 'javascript'],
    starter: STARTERS,
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        int k = in.nextInt();
        long[] a = new long[n];
        for (int i = 0; i < n; i++) a[i] = in.nextLong();
        Arrays.sort(a);
        System.out.println(a[k - 1]);
    }
}
`,
      python: code`import sys

data = list(map(int, sys.stdin.read().split()))
n, k = data[0], data[1]
print(sorted(data[2:2 + n])[k - 1])
`,
      javascript: code`const data = require('fs').readFileSync(0, 'utf8').trim().split(/\s+/).map(Number);
const [n, k] = data;
const a = data.slice(2, 2 + n).sort((x, y) => x - y);
console.log(a[k - 1]);
`,
    },
    cases: [
      { input: '5 2\n7 10 4 3 20', expected: '4', sample: true },
      { input: '4 4\n1 1 1 2', expected: '2', sample: true },
      { input: '6 3\n-5 12 0 -5 8 3', expected: '0', label: 'Negatives and repeats' },
      { input: '3 1\n100 50 75', expected: '50' },
    ],
  },
  {
    slug: 'dsa-merge-sorted',
    type: 'coding',
    title: 'Merge two sorted lists',
    body: 'Read two lists that are each in non-decreasing order and print one list with all their numbers, in non-decreasing order.',
    technology: 'dsa',
    topic: 'sorting',
    level: 'easy',
    marks: 10,
    practicePoints: 15,
    inputFormat: 'Line 1: n, then n sorted numbers. Line 2: m, then m sorted numbers.',
    outputFormat: 'All n + m numbers in order, separated by single spaces.',
    constraints: '1 ≤ n, m ≤ 100 000',
    hints: ['Walk both lists with one pointer each and always take the smaller head.'],
    explanation:
      'The merge step of merge sort: compare the two heads, take the smaller, advance that pointer; append what remains. O(n + m).',
    languages: ['java', 'python', 'javascript'],
    starter: STARTERS,
    solution: {
      java: code`import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        long[] a = new long[n];
        for (int i = 0; i < n; i++) a[i] = in.nextLong();
        int m = in.nextInt();
        long[] b = new long[m];
        for (int i = 0; i < m; i++) b[i] = in.nextLong();
        StringBuilder out = new StringBuilder();
        int i = 0, j = 0;
        while (i < n || j < m) {
            long next = (j >= m || (i < n && a[i] <= b[j])) ? a[i++] : b[j++];
            if (out.length() > 0) out.append(' ');
            out.append(next);
        }
        System.out.println(out);
    }
}
`,
      python: code`import sys

data = list(map(int, sys.stdin.read().split()))
n = data[0]
a = data[1:1 + n]
m = data[1 + n]
b = data[2 + n:2 + n + m]
i = j = 0
out = []
while i < n or j < m:
    if j >= m or (i < n and a[i] <= b[j]):
        out.append(a[i])
        i += 1
    else:
        out.append(b[j])
        j += 1
print(' '.join(map(str, out)))
`,
      javascript: code`const data = require('fs').readFileSync(0, 'utf8').trim().split(/\s+/).map(Number);
const n = data[0];
const a = data.slice(1, 1 + n);
const m = data[1 + n];
const b = data.slice(2 + n, 2 + n + m);
const out = [];
let i = 0;
let j = 0;
while (i < n || j < m) {
  if (j >= m || (i < n && a[i] <= b[j])) out.push(a[i++]);
  else out.push(b[j++]);
}
console.log(out.join(' '));
`,
    },
    cases: [
      { input: '3 1 4 9\n4 2 3 10 12', expected: '1 2 3 4 9 10 12', sample: true },
      { input: '1 5\n1 5', expected: '5 5', sample: true, label: 'Equal values' },
      { input: '2 -3 -1\n3 -2 0 7', expected: '-3 -2 -1 0 7' },
      { input: '4 1 2 3 4\n1 100', expected: '1 2 3 4 100', label: 'One list first' },
    ],
  },

  // ───────────── concepts ─────────────
  {
    slug: 'dsa-binary-search-cost',
    type: 'mcq_single',
    title: 'How many steps does binary search take?',
    body: 'Roughly how many comparisons does binary search need on a sorted list of one million items?',
    technology: 'dsa',
    topic: 'searching',
    level: 'easy',
    marks: 2,
    options: [
      ['About 20', true, '2²⁰ is just over a million.'],
      ['About 1 000', false],
      ['About 500 000', false, 'That is a linear scan on average.'],
      ['About 1 000 000', false],
    ],
    explanation:
      'Each comparison halves what is left, so it takes about log₂(1 000 000) ≈ 20 steps.',
  },
  {
    slug: 'dsa-stack-queue',
    type: 'mcq_single',
    title: 'Which structure does breadth-first search use?',
    body: 'Breadth-first search visits a graph level by level. Which structure holds the nodes waiting to be visited?',
    technology: 'dsa',
    topic: 'graphs',
    level: 'medium',
    marks: 2,
    options: [
      ['A stack', false, 'A stack gives depth-first order.'],
      ['A queue', true],
      ['A priority queue', false, 'That is for Dijkstra’s shortest paths.'],
      ['A set', false],
    ],
    explanation:
      'A queue is first in, first out, so nodes are visited in the order they were discovered: level by level.',
  },
  {
    slug: 'dsa-nested-loop-cost',
    type: 'mcq_single',
    title: 'Cost of a loop inside a loop',
    body: '```\nfor (int i = 0; i < n; i++)\n    for (int j = i + 1; j < n; j++)\n        compare(a[i], a[j]);\n```\nHow does the number of comparisons grow with n?',
    technology: 'dsa',
    topic: 'complexity',
    level: 'easy',
    marks: 2,
    options: [
      ['O(n)', false],
      ['O(n log n)', false],
      ['O(n²)', true, 'About n²/2 comparisons.'],
      ['O(2ⁿ)', false],
    ],
    explanation:
      'The inner loop runs n−1, n−2, … 1 times: n(n−1)/2 comparisons, which is quadratic.',
  },
  {
    slug: 'dsa-hashmap-cost',
    type: 'true_false',
    title: 'Looking up a key in a hash map takes constant time on average.',
    body: 'Decide whether this is true for a well-sized hash map with a reasonable hash function.',
    technology: 'dsa',
    topic: 'hashing',
    level: 'foundation',
    marks: 1,
    answer: true,
    explanation:
      'On average it is O(1). The worst case, when many keys collide, is worse, which is why the quality of `hashCode` matters.',
  },
  {
    slug: 'dsa-recursion-base-case',
    type: 'mcq_single',
    title: 'A recursive function that never stops',
    body: '```\nstatic int sumTo(int n) {\n    return n + sumTo(n - 1);\n}\n```\nWhat happens when you call `sumTo(5)`?',
    technology: 'dsa',
    topic: 'recursion',
    level: 'foundation',
    marks: 2,
    options: [
      ['It returns 15', false],
      ['It fails with a StackOverflowError', true, 'There is no base case.'],
      ['It returns 0', false],
      ['It does not compile', false],
    ],
    explanation:
      'Without a base case such as `if (n == 0) return 0;` every call makes another, until the call stack runs out.',
  },
  {
    slug: 'dsa-sorting-stable',
    type: 'mcq_single',
    title: 'What does a stable sort keep?',
    body: 'You sort students by batch using a stable sort. They were in alphabetical order before. What is true afterwards?',
    technology: 'dsa',
    topic: 'sorting',
    level: 'interview',
    marks: 2,
    options: [
      ['Within each batch, students stay in alphabetical order', true],
      ['Students are sorted by name only', false],
      ['The order within a batch is random', false, 'That can happen with an unstable sort.'],
      ['The sort is faster than an unstable one', false],
    ],
    explanation:
      'A stable sort keeps equal elements in their original relative order. Java’s `Collections.sort` for objects is stable.',
  },
];
