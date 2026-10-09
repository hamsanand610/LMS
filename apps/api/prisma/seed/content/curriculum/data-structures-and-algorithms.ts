import type { CurriculumCourse } from './types.js';

const JAVA_API = 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base';

export const COURSE: CurriculumCourse = {
  slug: 'data-structures-and-algorithms',
  title: 'Data Structures and Algorithms',
  subject: 'dsa',
  level: 'intermediate',
  description:
    'Learn to think the way technical interviewers expect. Measure code with Big-O, then work through arrays, strings, linked lists, stacks, queues, hashing, searching, sorting, recursion, backtracking, trees and graphs in Java 21, and finish with the two-pointer, sliding-window and prefix-sum patterns behind most coding rounds.',
  tags: ['dsa', 'java', 'algorithms', 'data-structures', 'big-o', 'interview-prep', 'placement'],
  modules: [
    // ───────────────────────── Module 1 ─────────────────────────
    {
      title: 'Measuring code with Big-O',
      summary:
        'Count the work a program does as its input grows, read and simplify Big-O notation, and recognise the common time and space complexity classes in Java code.',
      lessons: [
        {
          kind: 'article',
          title: 'Why we count steps instead of seconds',
          minutes: 12,
          topic: 'Complexity',
          html: `<p>Two programs can both print the right answer and still be worlds apart. Picture a counselling portal that checks whether a roll number is already registered. With 60 students in a class, any approach feels instant. With 12 lakh applicants on result day, the slow approach keeps the page spinning for minutes while the fast one still replies in a blink. Algorithm analysis is how you tell the two apart <em>before</em> the crowd arrives.</p>

<h2>Why not just time the program?</h2>
<p>A stopwatch measures far more than your code: your laptop's processor, the JVM warming up, a browser running in the background, and the particular input you happened to try. Run the same program on a server and the number changes. What stays the same on every machine is <strong>how the amount of work grows when the input grows</strong>.</p>
<p>So instead of seconds, we count basic steps — a comparison, an addition, an array read — as a function of the input size. By convention the input size is called <code>n</code>: the number of marks, the length of a string, the number of nodes in a graph.</p>

<h2>Counting the steps of a simple method</h2>
<pre><code class="language-java">static int totalMarks(int[] marks) {
    int total = 0;                             // 1 step
    for (int i = 0; i &lt; marks.length; i++) {  // the body runs n times
        total += marks[i];                     // 1 step each time
    }
    return total;                              // 1 step
}</code></pre>
<p>For <code>n</code> marks the loop body runs <code>n</code> times, so the method does roughly <code>n + 2</code> steps, plus a little loop bookkeeping. Double the class size and the work doubles. That straight-line relationship is called <strong>linear</strong> growth.</p>

<h3>Growth is what separates good code from bad</h3>
<table>
<thead><tr><th>n</th><th>log₂ n</th><th>n</th><th>n²</th></tr></thead>
<tbody>
<tr><td>10</td><td>about 3</td><td>10</td><td>100</td></tr>
<tr><td>1 000</td><td>about 10</td><td>1 000</td><td>10 lakh</td></tr>
<tr><td>10 lakh</td><td>about 20</td><td>10 lakh</td><td>10¹² (a trillion)</td></tr>
</tbody>
</table>
<p>At small sizes nobody notices the difference. At 10 lakh items, a method that does n² steps needs about a trillion of them — many minutes even on a fast machine — while the linear method finishes in milliseconds.</p>

<h2>Best, average and worst case</h2>
<p>The same method can do different amounts of work on inputs of the same size. Look at a search that scans roll numbers from the front:</p>
<pre><code class="language-java">static int indexOf(int[] rolls, int target) {
    for (int i = 0; i &lt; rolls.length; i++) {
        if (rolls[i] == target) return i;   // stop as soon as we find it
    }
    return -1;
}</code></pre>
<ul>
<li><strong>Best case:</strong> the target is the first roll number — one comparison.</li>
<li><strong>Worst case:</strong> the target is last or missing — <code>n</code> comparisons.</li>
<li><strong>Average case:</strong> if the target is equally likely to be anywhere, about <code>n / 2</code>.</li>
</ul>
<p>Interviewers almost always mean the worst case unless they say otherwise, because it is a guarantee: the code never does worse than that.</p>

<h2>Common mistakes</h2>
<ul>
<li>Testing only with five or ten items and concluding "it is fast".</li>
<li>Forgetting that a library call can hide a loop: <code>list.contains(x)</code> on an <code>ArrayList</code> scans the whole list.</li>
<li>Quoting the best case ("it finds it on the first try") as if it were the normal cost.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>A method prints every pair of students for a project (each pair once). Roughly how many pairs for 100 students? For 1 000?</summary><p>About n²/2 pairs: roughly 5 000 for 100 students and roughly 5 lakh for 1 000. Ten times the students means about a hundred times the work — that is quadratic growth.</p></details>
<details><summary>Why is "my code ran in 2 ms" not a good answer to "how efficient is your solution?"</summary><p>Because it depends on the machine and the input you tried. Describe how the work grows with n instead, for example "one pass over the array, so linear time".</p></details>`,
        },
        {
          kind: 'article',
          title: 'Big-O notation and the rules for simplifying it',
          minutes: 15,
          topic: 'Complexity',
          html: `<p>Writing "about 3n + 7 steps" every time is clumsy, and the exact constants depend on the machine anyway. Big-O notation is the shorthand: <strong>O(f(n))</strong> says the work grows no faster than f(n), up to a constant factor, once n is large. You will use four simplification rules again and again.</p>

<h2>Rule 1: drop the constants</h2>
<p><code>3n + 7</code> steps is <strong>O(n)</strong>. A method that makes two passes over an array is still O(n), not O(2n). Constants matter in real tuning, but they do not change the <em>shape</em> of the growth, and that shape is what Big-O describes.</p>

<h2>Rule 2: keep only the dominant term</h2>
<p><code>n² + 100n + 5</code> is <strong>O(n²)</strong>. At n = 10 000, n² is 10 crore while 100n is only 10 lakh — the smaller term stops mattering as n grows.</p>

<h2>Rule 3: steps in sequence add, nested steps multiply</h2>
<pre><code class="language-java">static void report(int[] marks) {
    int max = Integer.MIN_VALUE;
    for (int m : marks) {                              // n steps
        max = Math.max(max, m);
    }
    int samePairs = 0;
    for (int i = 0; i &lt; marks.length; i++) {          // n times ...
        for (int j = i + 1; j &lt; marks.length; j++) {  // ... up to n times each
            if (marks[i] == marks[j]) samePairs++;
        }
    }
    System.out.println(max + " " + samePairs);
}</code></pre>
<p>The first loop is O(n). The nested loops do n(n − 1)/2 comparisons, which is O(n²). One after the other: O(n) + O(n²) = <strong>O(n²)</strong>.</p>

<h2>Rule 4: different inputs get different letters</h2>
<pre><code class="language-java">static int common(String[] batchA, String[] batchB) {
    int count = 0;
    for (String a : batchA)           // a times
        for (String b : batchB)       // b times for each a
            if (a.equals(b)) count++;
    return count;
}</code></pre>
<p>This is <strong>O(a × b)</strong>, not O(n²). If batch B always has five names, the method is effectively linear in the size of batch A. Using one letter for two unrelated sizes is a classic interview slip.</p>

<h2>Hidden loops inside library calls</h2>
<p>A single line can cost more than one step:</p>
<ul>
<li><code>arrayList.contains(x)</code> and <code>indexOf(x)</code> scan the list: O(n).</li>
<li><code>s.substring(i, j)</code> copies characters: O(j − i).</li>
<li><code>Arrays.sort(a)</code> is O(n log n).</li>
<li><code>text = text + piece</code> copies the whole string built so far.</li>
</ul>
<p>So a loop that calls <code>list.contains</code> on every iteration is O(n²), even though you only wrote one loop.</p>

<h2>O, Ω and Θ in one paragraph</h2>
<p>In textbooks, Big-O is an upper bound, Big-Omega (Ω) a lower bound and Big-Theta (Θ) a tight bound. In interviews people say "O" and mean the tight worst-case bound, so "binary search is O(log n)" is the expected answer — nobody wants to hear that it is technically also O(n²).</p>

<h2>Common mistakes</h2>
<ul>
<li>Calling every nested loop O(n²). If the inner loop always runs 26 times (once per letter), the total is O(26n) = O(n).</li>
<li>Calling an inner loop that halves its range each time O(n). It runs about log n times, so the total is O(n log n).</li>
<li>Forgetting the cost of building the output: returning all pairs is at least O(n²) because there are that many pairs.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>What is the cost of <code>for (int i = 0; i &lt; n; i++) for (int j = 0; j &lt; 5; j++) work();</code>?</summary><p>O(n). The inner loop runs a fixed 5 times, so the total is 5n.</p></details>
<details><summary>What is the cost of <code>for (int i = n; i &gt; 0; i /= 2) work();</code>?</summary><p>O(log n). The value halves each time, so the loop runs about log₂ n times.</p></details>
<details><summary>You sort array A (size a) and then binary-search it once for each item of array B (size b). Total cost?</summary><p>O(a log a + b log a): the sort, plus b searches of log a steps each.</p></details>`,
          resources: [{ title: 'Arrays (Java 21 API)', url: `${JAVA_API}/java/util/Arrays.html` }],
        },
        {
          kind: 'article',
          title: 'Common complexity classes, with Java loops to match',
          minutes: 15,
          topic: 'Complexity',
          html: `<p>Most code you will meet in interviews falls into a handful of complexity classes. Learn to recognise each one from the shape of the loops, and you can estimate the cost of a solution before you run it.</p>

<h2>The classes, from fastest to slowest</h2>
<table>
<thead><tr><th>Class</th><th>Name</th><th>Typical code</th></tr></thead>
<tbody>
<tr><td>O(1)</td><td>constant</td><td>reading <code>a[i]</code>; <code>HashMap.get</code> on average</td></tr>
<tr><td>O(log n)</td><td>logarithmic</td><td>a loop that halves the range: binary search</td></tr>
<tr><td>O(n)</td><td>linear</td><td>one pass over the input: maximum, sum, count</td></tr>
<tr><td>O(n log n)</td><td>linearithmic</td><td>good sorting: merge sort, <code>Arrays.sort</code></td></tr>
<tr><td>O(n²)</td><td>quadratic</td><td>every pair: two nested loops over the input</td></tr>
<tr><td>O(2ⁿ)</td><td>exponential</td><td>every subset: naive recursion with two branches</td></tr>
</tbody>
</table>

<h2>See the growth for yourself</h2>
<p>This program counts how many times each loop shape runs for n = 16:</p>
<pre><code class="language-java">public class Main {
    public static void main(String[] args) {
        int n = 16;
        long logSteps = 0, linearSteps = 0, nLogNSteps = 0, quadraticSteps = 0;

        for (int i = 1; i &lt; n; i *= 2) logSteps++;          // doubles each time
        for (int i = 0; i &lt; n; i++) linearSteps++;
        for (int i = 0; i &lt; n; i++)
            for (int j = 1; j &lt; n; j *= 2) nLogNSteps++;     // log n work, n times
        for (int i = 0; i &lt; n; i++)
            for (int j = 0; j &lt; n; j++) quadraticSteps++;

        System.out.println("log n   : " + logSteps);
        System.out.println("n       : " + linearSteps);
        System.out.println("n log n : " + nLogNSteps);
        System.out.println("n^2     : " + quadraticSteps);
    }
}</code></pre>
<p>Output:</p>
<pre><code class="language-text">log n   : 4
n       : 16
n log n : 64
n^2     : 256</code></pre>
<p>Change <code>n</code> to 1024 and run it again: the log loop runs 10 times, the linear one 1 024 times, and the quadratic one over 10 lakh times.</p>

<h2>Reading the constraints like an interviewer</h2>
<p>A rough rule of thumb: a Java program does on the order of 10⁸ simple steps per second. Problem statements give you limits on n, and those limits quietly tell you which complexity is expected:</p>
<table>
<thead><tr><th>Largest n</th><th>What usually fits in about a second</th></tr></thead>
<tbody>
<tr><td>up to about 20</td><td>O(2ⁿ) — trying every subset is fine</td></tr>
<tr><td>a few thousand</td><td>O(n²)</td></tr>
<tr><td>10⁵ to 10⁶</td><td>O(n log n) or O(n)</td></tr>
<tr><td>10⁹ and beyond</td><td>O(log n) or O(1) — usually binary search or a formula</td></tr>
</tbody>
</table>
<p>So when a problem says "n ≤ 200 000", a double loop over all pairs (4 × 10¹⁰ steps) will time out, and you should look for a sort, a hash map or a single pass.</p>

<h2>Common mistakes</h2>
<ul>
<li>Treating O(n log n) as "almost as bad as n²". For n = 10 lakh, n log n is about 2 crore steps while n² is 10¹².</li>
<li>Forgetting that exponential blows up very fast: 2³⁰ is already over 100 crore.</li>
<li>Using <code>int</code> for counters that can exceed about 2.1 × 10⁹. Use <code>long</code> when n² can be large.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>A problem allows n up to 10⁵. Your idea compares every pair. Will it pass?</summary><p>Probably not: about 5 × 10⁹ comparisons is far beyond a second. Look for an O(n log n) or O(n) idea.</p></details>
<details><summary>Which class does "count the digits of a number n" belong to?</summary><p>O(log n): each step divides n by 10, so the loop runs once per digit, about log₁₀ n times.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Space complexity: counting the memory you use',
          minutes: 10,
          topic: 'Complexity',
          html: `<p>Time is not the only resource. A solution that creates a copy of a 10-crore-element array may run quickly and still crash with <code>OutOfMemoryError</code>. <strong>Space complexity</strong> measures the <em>extra</em> memory your algorithm needs as the input grows, not counting the input itself.</p>

<h2>In place versus making a copy</h2>
<pre><code class="language-java">// O(n) extra space: builds a second array
static int[] reversedCopy(int[] a) {
    int[] out = new int[a.length];
    for (int i = 0; i &lt; a.length; i++) out[i] = a[a.length - 1 - i];
    return out;
}

// O(1) extra space: swaps inside the same array
static void reverseInPlace(int[] a) {
    for (int i = 0, j = a.length - 1; i &lt; j; i++, j--) {
        int tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
}</code></pre>
<p>Both run in O(n) time. The second uses only two indices and one temporary variable, no matter how big the array is, so its extra space is O(1). The trade-off: it changes the caller's array, which is not always allowed. Ask the interviewer whether you may modify the input.</p>

<h2>Recursion uses memory too</h2>
<p>Every method call that has not returned yet keeps a <strong>stack frame</strong> with its parameters and local variables. A recursive method that goes n calls deep needs O(n) stack space, even if it creates no arrays. That is why very deep recursion in Java ends in <code>StackOverflowError</code>, typically somewhere in the tens of thousands of calls, depending on the JVM's stack size.</p>
<pre><code class="language-java">static long sum(int[] a, int i) {        // O(n) stack frames deep
    if (i == a.length) return 0;
    return a[i] + sum(a, i + 1);
}</code></pre>

<h2>Trading space for time</h2>
<p>Many interview answers buy speed with memory. Take "does this list of roll numbers contain a duplicate?":</p>
<table>
<thead><tr><th>Approach</th><th>Time</th><th>Extra space</th></tr></thead>
<tbody>
<tr><td>Compare every pair</td><td>O(n²)</td><td>O(1)</td></tr>
<tr><td>Sort, then compare neighbours</td><td>O(n log n)</td><td>small (sorts in place)</td></tr>
<tr><td>Remember what you have seen in a <code>HashSet</code></td><td>O(n) on average</td><td>O(n)</td></tr>
</tbody>
</table>
<pre><code class="language-java">static boolean hasDuplicate(int[] rolls) {
    java.util.Set&lt;Integer&gt; seen = new java.util.HashSet&lt;&gt;();
    for (int r : rolls) {
        if (!seen.add(r)) return true;   // add returns false if r was already there
    }
    return false;
}</code></pre>
<p>None of these is "the" answer. If memory is tight, sorting wins; if speed matters most, the set wins. Saying this out loud is exactly the reasoning interviewers look for.</p>

<h2>Common mistakes</h2>
<ul>
<li>Counting the input as extra space. An algorithm that only reads its input array and uses a few variables is O(1) extra space.</li>
<li>Forgetting the recursion stack when you claim O(1) space.</li>
<li>Ignoring the space of the output: returning a list of all subsets is O(n · 2ⁿ) space by itself.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>A method builds a <code>HashMap</code> of character counts for a string of lower-case English letters. What is its extra space?</summary><p>O(1) in terms of the string length: there can be at most 26 keys, however long the string is. If any character can appear, it is O(k) for k distinct characters.</p></details>
<details><summary>Why should you state both time and space in an interview?</summary><p>Because they trade off against each other, and the interviewer may ask you to improve one at the cost of the other. Stating both shows you understand the choice you made.</p></details>`,
        },
        {
          kind: 'practice',
          question: 'sum-of-the-digits',
          title: 'Practice: add up the digits of a number',
          topic: 'Practice',
        },
        {
          kind: 'practice',
          question: 'largest-in-a-list',
          title: 'Practice: the largest value in one pass',
          topic: 'Practice',
        },
      ],
    },

    // ───────────────────────── Module 2 ─────────────────────────
    {
      title: 'Arrays and strings',
      summary:
        'Work with Java arrays, ArrayList, immutable Strings and StringBuilder, and solve counting and in-place problems on them with clear time and space costs.',
      lessons: [
        {
          kind: 'article',
          title: 'Arrays and ArrayList: what indexing really costs',
          minutes: 14,
          topic: 'Arrays',
          html: `<p>The array is the most basic data structure there is, and almost every other structure is built on top of it. Knowing exactly what each array operation costs lets you predict the cost of everything built on arrays, including Java's <code>ArrayList</code>.</p>

<h2>Why reading a[i] takes constant time</h2>
<p>An array is one continuous block of memory in which every slot has the same size. To find <code>a[i]</code>, the JVM computes <em>start address + i × slot size</em> and jumps straight there. One multiplication and one addition, whether the array has ten elements or ten crore: <strong>O(1)</strong>.</p>
<p>Two consequences follow. An array's length is fixed when you create it, and new arrays are filled with default values: <code>0</code> for numbers, <code>false</code> for booleans and <code>null</code> for objects.</p>

<h2>Why inserting in the middle takes linear time</h2>
<p>To insert a value at position <code>index</code>, every element from there to the end must move one slot to the right first:</p>
<pre><code class="language-java">import java.util.Arrays;

public class Main {
    // Inserts value at index, shifting later elements right. Returns the new size.
    static int insertAt(int[] arr, int size, int index, int value) {
        for (int i = size; i &gt; index; i--) {
            arr[i] = arr[i - 1];      // move from the back so nothing is overwritten
        }
        arr[index] = value;
        return size + 1;
    }

    public static void main(String[] args) {
        int[] arr = new int[6];       // capacity 6
        int size = 0;
        for (int v : new int[] {10, 20, 30, 40}) arr[size++] = v;
        size = insertAt(arr, size, 2, 25);
        System.out.println(Arrays.toString(Arrays.copyOf(arr, size)));
    }
}</code></pre>
<p>Output: <code>[10, 20, 25, 30, 40]</code>. Inserting at the front moves every element, so insertion is <strong>O(n)</strong> in the worst case. Deleting from the middle is O(n) for the same reason.</p>

<h2>ArrayList: an array that grows</h2>
<p><code>ArrayList</code> keeps an internal array that is usually a bit bigger than the list. When it is full, the list allocates a larger array (in the standard JDK, about one and a half times the size) and copies everything across. That copy is O(n), but it happens so rarely that adding at the end costs O(1) <em>on average</em> — this is called <strong>amortised</strong> constant time.</p>
<table>
<thead><tr><th>Operation</th><th>ArrayList cost</th></tr></thead>
<tbody>
<tr><td><code>get(i)</code>, <code>set(i, x)</code></td><td>O(1)</td></tr>
<tr><td><code>add(x)</code> at the end</td><td>O(1) amortised</td></tr>
<tr><td><code>add(0, x)</code>, <code>remove(0)</code></td><td>O(n) — everything shifts</td></tr>
<tr><td><code>contains(x)</code>, <code>indexOf(x)</code></td><td>O(n) — a linear scan</td></tr>
</tbody>
</table>

<h2>Common mistakes</h2>
<ul>
<li>Mixing up the three lengths: <code>arr.length</code> (a field), <code>list.size()</code> and <code>str.length()</code> (methods).</li>
<li>Looping with <code>i &lt;= arr.length</code>, which reads one slot past the end and throws <code>ArrayIndexOutOfBoundsException</code>.</li>
<li>Printing an array directly. <code>System.out.println(arr)</code> prints something like <code>[I@1b6d3586</code>; use <code>Arrays.toString(arr)</code>.</li>
<li>Calling <code>list.remove(1)</code> on a <code>List&lt;Integer&gt;</code> and expecting the <em>value</em> 1 to go. It removes the element at <em>index</em> 1; use <code>list.remove(Integer.valueOf(1))</code> for the value.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>You need to add 1 lakh items to the front of a list, one at a time. Why is <code>ArrayList.add(0, x)</code> a poor choice?</summary><p>Each insertion shifts every existing element, so the total is about n²/2 moves — roughly 500 crore for 1 lakh items. Add them at the end and reverse once, or use an <code>ArrayDeque</code>, which adds at the front in O(1).</p></details>`,
          resources: [
            { title: 'ArrayList (Java 21 API)', url: `${JAVA_API}/java/util/ArrayList.html` },
            { title: 'Arrays (Java 21 API)', url: `${JAVA_API}/java/util/Arrays.html` },
          ],
        },
        {
          kind: 'article',
          title: 'Strings in Java: immutability and StringBuilder',
          minutes: 12,
          topic: 'Strings',
          html: `<p>Strings appear in nearly every coding round: names, words, IDs, whole sentences. In Java a <code>String</code> is <strong>immutable</strong>: once created, its characters never change. That one fact explains several bugs and one big performance trap.</p>

<h2>Methods return new strings</h2>
<pre><code class="language-java">String name = "kavya";
name.toUpperCase();                 // creates "KAVYA" and throws it away
System.out.println(name);           // kavya
name = name.toUpperCase();          // keep the new string
System.out.println(name);           // KAVYA</code></pre>
<p>Every method that "changes" a string — <code>toUpperCase</code>, <code>replace</code>, <code>trim</code>, <code>substring</code> — gives you a new string. If you do not store the result, nothing happens.</p>

<h2>The concatenation trap</h2>
<p>Because strings cannot change, <code>text += piece</code> builds a brand-new string and copies every character so far into it. Do that inside a loop of n pieces and you copy 1 + 2 + … + n characters: <strong>O(n²)</strong>. <code>StringBuilder</code> keeps a resizable character buffer instead, so appending is O(1) amortised and the whole loop is O(n).</p>
<pre><code class="language-java">public class Main {
    public static void main(String[] args) {
        int[] marks = {72, 85, 64, 90};
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i &lt; marks.length; i++) {
            if (i &gt; 0) sb.append(", ");
            sb.append(marks[i]);
        }
        System.out.println(sb.toString());                        // 72, 85, 64, 90
        System.out.println(new StringBuilder("level up").reverse()); // pu level
    }
}</code></pre>
<p>A single <code>a + b + c</code> on one line is fine — the compiler handles it efficiently. The trap is only repeated <code>+=</code> in a loop.</p>

<h2>What common String operations cost</h2>
<table>
<thead><tr><th>Operation</th><th>Cost</th></tr></thead>
<tbody>
<tr><td><code>length()</code>, <code>charAt(i)</code></td><td>O(1)</td></tr>
<tr><td><code>equals</code>, <code>compareTo</code></td><td>O(n) in the worst case</td></tr>
<tr><td><code>substring(i, j)</code></td><td>O(j − i) — it copies</td></tr>
<tr><td><code>toCharArray()</code></td><td>O(n) — a new array</td></tr>
<tr><td><code>indexOf(word)</code></td><td>linear in practice, worse in rare cases</td></tr>
</tbody>
</table>

<h2>Characters are small numbers</h2>
<p>A <code>char</code> is a 16-bit number, so you can do arithmetic with it. <code>c - 'a'</code> turns <code>'a'</code>…<code>'z'</code> into 0…25, perfect for indexing an array of 26 counters. <code>Character.isDigit</code>, <code>isLetter</code> and <code>toLowerCase</code> handle the usual checks without you memorising character codes.</p>

<h2>Common mistakes</h2>
<ul>
<li>Comparing strings with <code>==</code>. It compares references, not characters; use <code>a.equals(b)</code> or <code>a.equalsIgnoreCase(b)</code>.</li>
<li>Forgetting that <code>substring(i, j)</code> excludes index <code>j</code>.</li>
<li>Building output with <code>+=</code> in a loop over lakhs of items and then wondering why the program times out.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>What does this print? <code>String s = "java"; s.concat("21"); System.out.println(s);</code></summary><p><code>java</code>. <code>concat</code> returns a new string, which was not stored.</p></details>
<details><summary>What is <code>'d' - 'a'</code>?</summary><p>3, the position of d in the alphabet counting from 0.</p></details>`,
          resources: [
            { title: 'String (Java 21 API)', url: `${JAVA_API}/java/lang/String.html` },
            {
              title: 'StringBuilder (Java 21 API)',
              url: `${JAVA_API}/java/lang/StringBuilder.html`,
            },
          ],
        },
        {
          kind: 'article',
          title: 'Frequency tables: counting characters with an int array',
          minutes: 12,
          topic: 'Strings',
          html: `<p>A surprising number of string questions boil down to one idea: <strong>count how often each character appears</strong>, then answer the question from the counts. Anagrams, the first non-repeating character, "can these letters spell that word?" — all of them use a frequency table.</p>

<h2>The idea</h2>
<p>For lower-case English letters, use an <code>int[26]</code>. Slot 0 counts <code>'a'</code>, slot 1 counts <code>'b'</code>, and so on; <code>c - 'a'</code> gives the slot for character <code>c</code>. One pass fills the table, and reading any count afterwards is O(1).</p>

<h2>Worked example: the first character that appears only once</h2>
<pre><code class="language-java">public class Main {
    static char firstUnique(String word) {
        int[] count = new int[26];
        for (char c : word.toCharArray()) {
            count[c - 'a']++;                  // pass 1: count everything
        }
        for (char c : word.toCharArray()) {
            if (count[c - 'a'] == 1) return c; // pass 2: first with count 1
        }
        return '_';                            // every character repeats
    }

    public static void main(String[] args) {
        System.out.println(firstUnique("swiss"));     // w
        System.out.println(firstUnique("aabb"));      // _
        System.out.println(firstUnique("placement")); // p
    }
}</code></pre>

<h3>Dry run for "swiss"</h3>
<table>
<thead><tr><th>Step</th><th>What happens</th></tr></thead>
<tbody>
<tr><td>Pass 1</td><td>counts become s = 3, w = 1, i = 1</td></tr>
<tr><td>Pass 2, 's'</td><td>count 3, keep going</td></tr>
<tr><td>Pass 2, 'w'</td><td>count 1 — return <code>'w'</code></td></tr>
</tbody>
</table>
<p>Why two passes? After one pass you know the counts, but not which unique character came first. The second pass walks the word in its original order.</p>

<h2>Cost</h2>
<p>Two passes over n characters is <strong>O(n) time</strong>. The table always has 26 slots whatever the word length, so the extra space is <strong>O(1)</strong>. Compare that with checking each character against every other one: O(n²).</p>

<h2>When the alphabet is bigger</h2>
<ul>
<li>Upper and lower case mixed: normalise first with <code>Character.toLowerCase(c)</code>, or use <code>int[128]</code> indexed by the character itself for plain ASCII.</li>
<li>Any Unicode text, or whole words instead of characters: use a <code>HashMap&lt;Character, Integer&gt;</code> or <code>HashMap&lt;String, Integer&gt;</code>. The idea is the same; only the table changes.</li>
</ul>

<h2>Where else you will use it</h2>
<ul>
<li><strong>Anagrams:</strong> two words are anagrams when their frequency tables are equal. Count up for the first word, count down for the second, and check that every slot ends at zero.</li>
<li><strong>Can a note be made from a magazine's letters?</strong> Count the magazine, then subtract the note; a negative slot means "no".</li>
</ul>

<h2>Common mistakes</h2>
<ul>
<li>Feeding an upper-case letter or a space to <code>c - 'a'</code>. <code>'A' - 'a'</code> is −32, and the array access throws <code>ArrayIndexOutOfBoundsException</code>.</li>
<li>Returning from inside the first pass, before all counts are known.</li>
<li>Comparing two tables with <code>==</code>. Use <code>Arrays.equals(t1, t2)</code>.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>Using one array, how can you check that "listen" and "silent" are anagrams?</summary><p>Add 1 for every character of the first word and subtract 1 for every character of the second. If the lengths match and every slot is 0 at the end, they are anagrams.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Reversing and rotating arrays in place',
          minutes: 12,
          topic: 'Arrays',
          html: `<p>"Rotate this array by k places without using another array" is a favourite warm-up question. The neat answer rests on a simpler tool — reversing part of an array in place — so let us build that first.</p>

<h2>Reversing with two indices</h2>
<p>Put one index at each end, swap the two values, and move both indices inwards until they meet. An array of n elements needs only n/2 swaps, so the cost is <strong>O(n) time and O(1) extra space</strong>.</p>

<h2>Rotating left with three reversals</h2>
<p>Rotating <code>[1, 2, 3, 4, 5]</code> left by 2 should give <code>[3, 4, 5, 1, 2]</code>. Shifting one place at a time k times costs O(n × k). Instead:</p>
<ol>
<li>Reverse the first k elements: <code>[2, 1, 3, 4, 5]</code></li>
<li>Reverse the rest: <code>[2, 1, 5, 4, 3]</code></li>
<li>Reverse the whole array: <code>[3, 4, 5, 1, 2]</code></li>
</ol>
<p>Why does this work? Rotation swaps the order of two blocks, A then B, into B then A. Reversing everything turns A B into B<sup>r</sup> A<sup>r</sup> — the right block order, but each block backwards. Reversing each block first cancels that out.</p>
<pre><code class="language-java">import java.util.Arrays;

public class Main {
    static void reverse(int[] a, int from, int to) {   // both ends inclusive
        while (from &lt; to) {
            int tmp = a[from];
            a[from] = a[to];
            a[to] = tmp;
            from++;
            to--;
        }
    }

    static void rotateLeft(int[] a, int k) {
        int n = a.length;
        if (n == 0) return;
        k %= n;                       // rotating by n changes nothing
        reverse(a, 0, k - 1);
        reverse(a, k, n - 1);
        reverse(a, 0, n - 1);
    }

    public static void main(String[] args) {
        int[] days = {1, 2, 3, 4, 5};
        rotateLeft(days, 2);
        System.out.println(Arrays.toString(days));  // [3, 4, 5, 1, 2]

        int[] week = {1, 2, 3, 4, 5, 6, 7};
        rotateLeft(week, 10);                       // same as rotating by 3
        System.out.println(Arrays.toString(week));  // [4, 5, 6, 7, 1, 2, 3]
    }
}</code></pre>
<p>Each element is swapped at most twice, so rotation is O(n) time and O(1) extra space, whatever k is.</p>

<h2>Edge cases to mention in an interview</h2>
<ul>
<li><strong>k larger than n:</strong> rotating 7 days by 10 is the same as rotating by 3, hence <code>k %= n</code>.</li>
<li><strong>k = 0:</strong> the first call reverses an empty range and the last two cancel each other — the array is unchanged, as it should be.</li>
<li><strong>Empty array:</strong> <code>k %= 0</code> would throw <code>ArithmeticException</code>, so return early.</li>
</ul>

<h2>Rotating right</h2>
<p>Rotating right by k is the same as rotating left by n − k. Alternatively, reverse the whole array first and then each block. Try writing it yourself — the practice question in this module asks for exactly that.</p>

<h2>Common mistakes</h2>
<ul>
<li>Forgetting <code>k %= n</code> and reading past the end of the array.</li>
<li>Mixing inclusive and exclusive bounds between calls. Decide once — here both ends are inclusive — and stick to it.</li>
<li>Using <code>Collections.rotate</code> on an <code>int[]</code>. It works on lists only; say you know it exists, then write the array version.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>How many swaps does it take to reverse an array of 9 elements?</summary><p>4. The middle element stays where it is.</p></details>
<details><summary>Trace a left rotation of <code>[10, 20, 30, 40]</code> by 1.</summary><p>Reverse the first block: <code>[10, 20, 30, 40]</code> (one element, no change). Reverse the rest: <code>[10, 40, 30, 20]</code>. Reverse everything: <code>[20, 30, 40, 10]</code>.</p></details>`,
        },
        {
          kind: 'practice',
          question: 'are-they-anagrams',
          title: 'Practice: are two words anagrams?',
          topic: 'Practice',
        },
        {
          kind: 'practice',
          question: 'java-rotate-array',
          title: 'Practice: rotate an array to the right',
          topic: 'Practice',
        },
      ],
    },

    // ───────────────────────── Module 3 ─────────────────────────
    {
      title: 'Linked lists, stacks and queues',
      summary:
        'Build a singly linked list by hand, reverse it and find its middle, then use stacks and queues through ArrayDeque for last-in-first-out and first-in-first-out problems.',
      lessons: [
        {
          kind: 'article',
          title: 'Singly linked lists: nodes and references',
          minutes: 15,
          topic: 'Linked lists',
          html: `<p>An array keeps its elements side by side in memory. A <strong>linked list</strong> does the opposite: each element lives in its own small object, called a <em>node</em>, and every node holds a reference to the next one. You lose instant indexing but gain cheap insertion at the front — and interviewers love linked lists because they test whether you can handle references carefully.</p>

<h2>A list built by hand</h2>
<pre><code class="language-java">public class Main {
    static class Node {
        int value;
        Node next;                        // null means "end of the list"
        Node(int value) { this.value = value; }
    }

    static Node head;                     // the first node, or null if empty

    static void addFirst(int value) {
        Node node = new Node(value);
        node.next = head;                 // new node points at the old first node
        head = node;
    }

    static void addLast(int value) {
        Node node = new Node(value);
        if (head == null) { head = node; return; }
        Node cur = head;
        while (cur.next != null) cur = cur.next;   // walk to the last node
        cur.next = node;
    }

    static boolean remove(int value) {
        if (head == null) return false;
        if (head.value == value) { head = head.next; return true; }
        Node cur = head;
        while (cur.next != null &amp;&amp; cur.next.value != value) cur = cur.next;
        if (cur.next == null) return false;        // not found
        cur.next = cur.next.next;                  // skip over the node
        return true;
    }

    static void print() {
        StringBuilder sb = new StringBuilder();
        for (Node cur = head; cur != null; cur = cur.next) {
            sb.append(cur.value).append(" -&gt; ");
        }
        System.out.println(sb.append("null"));
    }

    public static void main(String[] args) {
        addLast(20);
        addLast(30);
        addFirst(10);
        print();          // 10 -&gt; 20 -&gt; 30 -&gt; null
        remove(20);
        print();          // 10 -&gt; 30 -&gt; null
    }
}</code></pre>

<h2>How removal works</h2>
<p>To delete 20 from <code>10 → 20 → 30</code>, stop at the node <em>before</em> it (10) and point its <code>next</code> past 20, straight at 30. Nothing refers to the 20 node any more, so the garbage collector reclaims it. Removing the head is a special case: there is no node before it, so you move <code>head</code> itself.</p>

<h2>What each operation costs</h2>
<table>
<thead><tr><th>Operation</th><th>Singly linked list</th><th>Array / ArrayList</th></tr></thead>
<tbody>
<tr><td>Add at the front</td><td>O(1)</td><td>O(n)</td></tr>
<tr><td>Add at the end</td><td>O(n), or O(1) if you keep a <code>tail</code> reference</td><td>O(1) amortised</td></tr>
<tr><td>Get the i-th element</td><td>O(i) — you must walk</td><td>O(1)</td></tr>
<tr><td>Remove a given node, once found</td><td>O(1)</td><td>O(n) — shifting</td></tr>
</tbody>
</table>
<p>Java's own <code>LinkedList</code> is <em>doubly</em> linked (each node also points to the previous one) and keeps both head and tail, so adding or removing at either end is O(1). In everyday Java, though, <code>ArrayList</code> or <code>ArrayDeque</code> is usually faster because arrays use the processor's cache much better.</p>

<h2>Common mistakes</h2>
<ul>
<li>Reading <code>cur.next.value</code> without first checking that <code>cur.next</code> is not null — the classic <code>NullPointerException</code>.</li>
<li>Overwriting a <code>next</code> reference before saving what it pointed to, which cuts off the rest of the list.</li>
<li>Forgetting the empty-list and remove-the-head cases. Test with zero, one and two nodes every time.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>Why can a singly linked list not do <code>get(i)</code> in O(1)?</summary><p>Nodes are scattered in memory, so there is no address arithmetic. The only way to reach node i is to follow i <code>next</code> references from the head.</p></details>`,
          resources: [
            { title: 'LinkedList (Java 21 API)', url: `${JAVA_API}/java/util/LinkedList.html` },
          ],
        },
        {
          kind: 'article',
          title: 'Reversing a linked list and the slow and fast pointer trick',
          minutes: 14,
          topic: 'Linked lists',
          html: `<p>Two linked-list questions come up so often that you should be able to write them without thinking: <strong>reverse the list</strong>, and <strong>find the middle node</strong> in one pass. Both are about moving references in the right order.</p>

<h2>Reversing: turn every arrow around</h2>
<p>Walk the list once with three references: <code>prev</code> (the part already reversed), <code>cur</code> (the node being processed) and <code>next</code> (a bookmark for the rest of the list, saved before we break the link).</p>
<pre><code class="language-java">public class Main {
    static class Node {
        int value;
        Node next;
        Node(int value, Node next) { this.value = value; this.next = next; }
    }

    static Node reverse(Node head) {
        Node prev = null;
        Node cur = head;
        while (cur != null) {
            Node next = cur.next;   // 1. remember the rest
            cur.next = prev;        // 2. turn this arrow around
            prev = cur;             // 3. step forward
            cur = next;
        }
        return prev;                // the old last node is the new head
    }

    static Node middle(Node head) {
        Node slow = head, fast = head;
        while (fast != null &amp;&amp; fast.next != null) {
            slow = slow.next;       // one step
            fast = fast.next.next;  // two steps
        }
        return slow;
    }

    static String show(Node head) {
        StringBuilder sb = new StringBuilder();
        for (Node cur = head; cur != null; cur = cur.next) {
            sb.append(cur.value).append(cur.next != null ? " -&gt; " : "");
        }
        return sb.toString();
    }

    public static void main(String[] args) {
        Node head = new Node(10, new Node(20, new Node(30, new Node(40, new Node(50, null)))));
        System.out.println(middle(head).value);   // 30
        head = reverse(head);
        System.out.println(show(head));           // 50 -&gt; 40 -&gt; 30 -&gt; 20 -&gt; 10
    }
}</code></pre>

<h3>Dry run: reversing 10 → 20 → 30</h3>
<table>
<thead><tr><th>Iteration</th><th>cur</th><th>After the step</th><th>prev now heads</th></tr></thead>
<tbody>
<tr><td>1</td><td>10</td><td>10 points to null</td><td>10</td></tr>
<tr><td>2</td><td>20</td><td>20 points to 10</td><td>20 → 10</td></tr>
<tr><td>3</td><td>30</td><td>30 points to 20</td><td>30 → 20 → 10</td></tr>
</tbody>
</table>
<p>When <code>cur</code> becomes null the loop stops and <code>prev</code> is the new head. Time O(n), extra space O(1). A recursive version is shorter but uses O(n) stack space — mention that if you write it.</p>

<h2>Finding the middle with slow and fast pointers</h2>
<p>Move <code>slow</code> one node at a time and <code>fast</code> two. When <code>fast</code> reaches the end, <code>slow</code> has covered half the distance: it is at the middle. One pass, no need to count the length first. For an even number of nodes this version returns the second of the two middle nodes (30 in a list of 10, 20, 30, 40).</p>

<h2>The same trick detects a cycle</h2>
<p>If a bug makes the last node point back into the list, a normal traversal loops forever. Run slow and fast pointers instead: in a list without a cycle, <code>fast</code> reaches null; in a list with one, <code>fast</code> eventually laps <code>slow</code> and they land on the same node. This is Floyd's cycle-detection idea, and it uses O(1) extra space where a <code>HashSet</code> of visited nodes would use O(n).</p>

<h2>Common mistakes</h2>
<ul>
<li>Doing step 2 before step 1 in the reversal: once <code>cur.next</code> is overwritten, the rest of the list is lost.</li>
<li>Returning <code>head</code> instead of <code>prev</code> after reversing. The old head is now the last node.</li>
<li>Writing the fast-pointer loop as <code>while (fast.next != null)</code>, which throws when <code>fast</code> itself becomes null.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>What does <code>middle</code> return for a one-node list? For an empty list?</summary><p>The single node itself; and null for an empty list, because the loop never runs and <code>slow</code> is still the null head.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Stacks: last in, first out',
          minutes: 14,
          topic: 'Stacks',
          html: `<p>Think of a pile of answer sheets on a trainer's desk: the sheet placed last is the one picked up first. A <strong>stack</strong> works the same way — last in, first out (LIFO). It sounds limited, yet stacks power undo buttons, the browser's back button, expression evaluation, bracket matching, and the very mechanism that runs your method calls.</p>

<h2>The three operations</h2>
<ul>
<li><code>push(x)</code> puts x on top.</li>
<li><code>pop()</code> removes and returns the top.</li>
<li><code>peek()</code> looks at the top without removing it.</li>
</ul>
<p>All three are O(1). In Java, use <code>Deque&lt;Integer&gt; stack = new ArrayDeque&lt;&gt;();</code>. The older <code>java.util.Stack</code> class still works, but it is synchronised (slower) and, because it extends <code>Vector</code>, lets you insert into the middle — not what a stack should allow. The Java documentation itself recommends <code>Deque</code>.</p>

<h2>Worked example: evaluating a postfix expression</h2>
<p>In postfix notation the operator comes after its two operands: <code>5 1 2 + 4 * + 3 -</code> means 5 + (1 + 2) × 4 − 3. Calculators and compilers like postfix because a stack evaluates it in one left-to-right pass: push numbers; on an operator, pop two numbers, apply it, push the result.</p>
<pre><code class="language-java">import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static int evalPostfix(String expr) {
        Deque&lt;Integer&gt; stack = new ArrayDeque&lt;&gt;();
        for (String token : expr.trim().split(" +")) {
            switch (token) {
                case "+", "-", "*", "/" -&gt; {
                    int right = stack.pop();   // popped first = second operand
                    int left = stack.pop();
                    stack.push(switch (token) {
                        case "+" -&gt; left + right;
                        case "-" -&gt; left - right;
                        case "*" -&gt; left * right;
                        default -&gt; left / right;
                    });
                }
                default -&gt; stack.push(Integer.parseInt(token));
            }
        }
        return stack.pop();
    }

    public static void main(String[] args) {
        System.out.println(evalPostfix("5 1 2 + 4 * + 3 -"));  // 14
    }
}</code></pre>

<h3>Dry run</h3>
<table>
<thead><tr><th>Token</th><th>Action</th><th>Stack (top on the right)</th></tr></thead>
<tbody>
<tr><td>5, 1, 2</td><td>push each</td><td>5 1 2</td></tr>
<tr><td>+</td><td>1 + 2 = 3</td><td>5 3</td></tr>
<tr><td>4</td><td>push</td><td>5 3 4</td></tr>
<tr><td>*</td><td>3 × 4 = 12</td><td>5 12</td></tr>
<tr><td>+</td><td>5 + 12 = 17</td><td>17</td></tr>
<tr><td>3</td><td>push</td><td>17 3</td></tr>
<tr><td>-</td><td>17 − 3 = 14</td><td>14</td></tr>
</tbody>
</table>
<p>Each token is pushed and popped at most once: O(n) time, O(n) space for the stack.</p>

<h2>Recognising a stack problem</h2>
<p>Reach for a stack when the most recent unfinished item is the one you must deal with next. Bracket matching is the textbook case: every closing bracket must match the most recent <em>unmatched</em> opening bracket. Push openers; on a closer, the top of the stack must be its partner. The practice question in this module asks you to finish that idea — and do not forget what an empty stack, or a non-empty one at the end, tells you.</p>

<h2>Common mistakes</h2>
<ul>
<li>Calling <code>pop()</code> on an empty <code>ArrayDeque</code>, which throws <code>NoSuchElementException</code>. Check <code>isEmpty()</code> first, or use <code>pollFirst()</code>, which returns null.</li>
<li>Swapping the operands of − and ÷. The first value popped is the <em>right</em> operand.</li>
<li>Pushing <code>null</code> into an <code>ArrayDeque</code> — it does not allow null elements.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>Evaluate <code>6 2 / 3 *</code> by hand.</summary><p>6 ÷ 2 = 3, then 3 × 3 = 9.</p></details>`,
          resources: [
            { title: 'ArrayDeque (Java 21 API)', url: `${JAVA_API}/java/util/ArrayDeque.html` },
            { title: 'Deque (Java 21 API)', url: `${JAVA_API}/java/util/Deque.html` },
          ],
        },
        {
          kind: 'article',
          title: 'Queues and deques: first in, first out',
          minutes: 12,
          topic: 'Queues',
          html: `<p>At a railway ticket counter, the person who joined the line first is served first. That is a <strong>queue</strong>: first in, first out (FIFO). Queues model anything that should be handled in arrival order — print jobs, customer-support tickets, messages between services — and they are the engine of breadth-first search, which you will meet in the graphs lesson.</p>

<h2>Queue operations in Java</h2>
<table>
<thead><tr><th>Goal</th><th>Returns a special value</th><th>Throws an exception</th></tr></thead>
<tbody>
<tr><td>Add at the back</td><td><code>offer(x)</code></td><td><code>add(x)</code></td></tr>
<tr><td>Remove from the front</td><td><code>poll()</code> — null if empty</td><td><code>remove()</code></td></tr>
<tr><td>Look at the front</td><td><code>peek()</code> — null if empty</td><td><code>element()</code></td></tr>
</tbody>
</table>
<p>Declare it as <code>Queue&lt;String&gt; q = new ArrayDeque&lt;&gt;();</code>. All of these are O(1).</p>

<h2>A deque works at both ends</h2>
<p>A <strong>deque</strong> (double-ended queue, said "deck") can add and remove at the front <em>and</em> the back: <code>addFirst</code>, <code>addLast</code>, <code>pollFirst</code>, <code>pollLast</code>. That makes it a stack and a queue in one. <code>ArrayDeque</code> achieves O(1) at both ends with a <em>circular</em> array: the head index can wrap around from the start of the array to the end, so nothing ever needs shifting.</p>

<h2>Both in one program</h2>
<pre><code class="language-java">import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Queue;

public class Main {
    public static void main(String[] args) {
        Queue&lt;String&gt; counter = new ArrayDeque&lt;&gt;();
        counter.offer("Token 1: Priya");
        counter.offer("Token 2: Arun");
        counter.offer("Token 3: Fatima");
        System.out.println("Next up: " + counter.peek());
        while (!counter.isEmpty()) {
            System.out.println("Serving " + counter.poll());
        }

        // Remember only the three most recently visited pages.
        Deque&lt;String&gt; recent = new ArrayDeque&lt;&gt;();
        for (String page : new String[] {"home", "courses", "dsa", "tests", "results"}) {
            recent.addFirst(page);                          // newest at the front
            if (recent.size() &gt; 3) recent.removeLast();     // forget the oldest
        }
        System.out.println(recent);
    }
}</code></pre>
<p>Output:</p>
<pre><code class="language-text">Next up: Token 1: Priya
Serving Token 1: Priya
Serving Token 2: Arun
Serving Token 3: Fatima
[results, tests, dsa]</code></pre>

<h2>When order is by priority, not arrival</h2>
<p>A hospital emergency desk does not serve strictly in arrival order. For "always take the most urgent (or smallest) item next", Java has <code>PriorityQueue</code>, a binary heap: <code>offer</code> and <code>poll</code> cost O(log n) and <code>peek</code> is O(1). It is <em>not</em> FIFO, and iterating over it does not give sorted order — only repeated <code>poll</code> does.</p>

<h2>Common mistakes</h2>
<ul>
<li>Using <code>ArrayList.remove(0)</code> as a queue. Every removal shifts all the other elements, so each <code>poll</code> becomes O(n).</li>
<li>Using <code>remove()</code> and <code>element()</code> when an empty queue is a normal situation — prefer <code>poll()</code> and <code>peek()</code> and check for null.</li>
<li>Printing a <code>PriorityQueue</code> and expecting sorted output.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>Students arrive in the order A, B, C, D. A stack and a queue each receive them. Which student comes out first from each?</summary><p>The queue gives A (first in, first out); the stack gives D (last in, first out).</p></details>`,
          resources: [
            { title: 'Queue (Java 21 API)', url: `${JAVA_API}/java/util/Queue.html` },
            {
              title: 'PriorityQueue (Java 21 API)',
              url: `${JAVA_API}/java/util/PriorityQueue.html`,
            },
          ],
        },
        {
          kind: 'practice',
          question: 'balanced-brackets',
          title: 'Practice: check that brackets are balanced',
          topic: 'Practice',
        },
      ],
    },
    // ───────────────────────── Module 4 ─────────────────────────
    {
      title: 'Hashing with HashMap and HashSet',
      summary:
        'See how hash tables reach average constant-time lookups, write correct equals and hashCode methods, and use maps and sets to count, deduplicate and find pairs.',
      lessons: [
        {
          kind: 'article',
          title: 'Inside a hash table: buckets, collisions and resizing',
          minutes: 14,
          topic: 'Hashing',
          html: `<p>An array finds <code>a[i]</code> instantly, but only when the key is a small whole number. What if the key is a roll number like 4021, a name like "Deepa", or an email address? A <strong>hash table</strong> turns any key into an array index, and that is how <code>HashMap</code> and <code>HashSet</code> answer "is this key here?" in constant time on average.</p>

<h2>From key to bucket</h2>
<ol>
<li>Call the key's <code>hashCode()</code> to get an <code>int</code>.</li>
<li>Squeeze that number into the range of the internal array, for example with a remainder. Each slot of this array is called a <strong>bucket</strong>.</li>
<li>Store the key and its value in that bucket.</li>
</ol>
<p>To look a key up later, repeat steps 1 and 2 and look only in that one bucket — no scanning of the whole table.</p>

<h2>A tiny dry run</h2>
<p>Take a toy table with 7 buckets, and use <code>key % 7</code> as the bucket number for roll numbers:</p>
<table>
<thead><tr><th>Key</th><th>key % 7</th><th>Bucket 3 after this step</th></tr></thead>
<tbody>
<tr><td>101</td><td>3</td><td>101</td></tr>
<tr><td>115</td><td>3</td><td>101, 115 — a <strong>collision</strong></td></tr>
<tr><td>120</td><td>1</td><td>101, 115 (120 goes to bucket 1)</td></tr>
<tr><td>108</td><td>3</td><td>101, 115, 108</td></tr>
</tbody>
</table>
<p>Different keys landing in the same bucket is normal. Java's <code>HashMap</code> keeps the entries of a bucket in a small linked list and, when looking up, compares the key with each one using <code>equals</code>. As long as buckets stay short, that comparison is quick.</p>

<h2>Keeping buckets short: load factor and resizing</h2>
<p>A <code>HashMap</code> starts with 16 buckets and a <strong>load factor</strong> of 0.75. Once the number of entries passes 16 × 0.75 = 12, it doubles the bucket array and moves every entry to its new bucket. That move costs O(n), but it happens rarely — after 12, 24, 48, … insertions — so on average each <code>put</code> is still O(1).</p>

<h2>The worst case</h2>
<p>If many keys share a bucket (a poor <code>hashCode</code>, or deliberately chosen keys), lookups degrade towards O(n). Since Java 8, a bucket that grows long is converted into a balanced tree when the keys are comparable, which caps that bucket's lookups at O(log n). That is why the honest interview answer is "O(1) on average, worse in the worst case".</p>

<h2>Negative hash codes</h2>
<p><code>hashCode()</code> can be negative, and Java's <code>%</code> keeps the sign, so <code>-17 % 7</code> is −3 — not a valid index. <code>Math.floorMod</code> always returns a value from 0 to n − 1:</p>
<pre><code class="language-java">public class Main {
    public static void main(String[] args) {
        int buckets = 7;
        for (int roll : new int[] {101, 115, 120, 108}) {
            System.out.println(roll + " -&gt; bucket " + roll % buckets);
        }
        System.out.println(-17 % 7);              // -3
        System.out.println(Math.floorMod(-17, 7)); // 4
    }
}</code></pre>
<p>(The real <code>HashMap</code> mixes the bits of the hash code and uses a power-of-two table size, but the idea is the same.)</p>

<h2>Common mistakes</h2>
<ul>
<li>Saying hash lookups are "always O(1)". They are O(1) on average with a good hash function.</li>
<li>Assuming a <code>HashMap</code> remembers insertion order. It does not; the order depends on buckets and can change after resizing.</li>
<li>Using an object whose <code>hashCode</code> was never overridden as a key, and expecting a different but equal-looking object to find it. The next lesson shows why that fails.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>Why does a <code>HashMap</code> still need <code>equals</code> if it already has the hash code?</summary><p>Different keys can share a hash code or a bucket. The hash narrows the search to one bucket; <code>equals</code> decides which entry in that bucket is really the key you asked for.</p></details>`,
          resources: [
            { title: 'HashMap (Java 21 API)', url: `${JAVA_API}/java/util/HashMap.html` },
          ],
        },
        {
          kind: 'article',
          title: 'HashMap and HashSet in everyday Java',
          minutes: 12,
          topic: 'Hashing',
          html: `<p>Whenever a problem says "count", "group", "have we seen this before?" or "look up by name", a map or a set is probably the right tool. This lesson collects the methods you will use most and the mistakes that cost marks.</p>

<h2>The methods you will use daily</h2>
<table>
<thead><tr><th>Call</th><th>What it does</th></tr></thead>
<tbody>
<tr><td><code>map.put(k, v)</code></td><td>add or replace the value for k</td></tr>
<tr><td><code>map.get(k)</code></td><td>the value, or <code>null</code> if k is absent</td></tr>
<tr><td><code>map.getOrDefault(k, d)</code></td><td>the value, or d if k is absent</td></tr>
<tr><td><code>map.containsKey(k)</code></td><td>is k present?</td></tr>
<tr><td><code>map.merge(k, 1, Integer::sum)</code></td><td>put 1 if absent, otherwise add 1 — perfect for counting</td></tr>
<tr><td><code>map.entrySet()</code></td><td>iterate over key–value pairs</td></tr>
<tr><td><code>set.add(x)</code></td><td>adds x; returns <code>false</code> if it was already there</td></tr>
<tr><td><code>set.contains(x)</code></td><td>is x present?</td></tr>
</tbody>
</table>
<p>All of these are O(1) on average for <code>HashMap</code> and <code>HashSet</code>.</p>

<h2>Counting and spotting repeats</h2>
<pre><code class="language-java">import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

public class Main {
    public static void main(String[] args) {
        String[] cities = {"Chennai", "Pune", "Chennai", "Kochi", "Pune", "Chennai"};
        Map&lt;String, Integer&gt; perCity = new LinkedHashMap&lt;&gt;();  // keeps first-seen order
        for (String city : cities) {
            perCity.merge(city, 1, Integer::sum);
        }
        System.out.println(perCity);   // {Chennai=3, Pune=2, Kochi=1}

        for (Map.Entry&lt;String, Integer&gt; e : perCity.entrySet()) {
            if (e.getValue() &gt; 1) System.out.println(e.getKey() + " has a study group");
        }

        int[] submissions = {4021, 4007, 4033, 4007, 4050, 4021};
        Set&lt;Integer&gt; seen = new HashSet&lt;&gt;();
        for (int roll : submissions) {
            if (!seen.add(roll)) {
                System.out.println("First repeated roll number: " + roll);  // 4007
                break;
            }
        }
    }
}</code></pre>
<p>Output:</p>
<pre><code class="language-text">{Chennai=3, Pune=2, Kochi=1}
Chennai has a study group
Pune has a study group
First repeated roll number: 4007</code></pre>
<p>Before <code>merge</code> existed, people wrote <code>perCity.put(city, perCity.getOrDefault(city, 0) + 1)</code>. Both are fine; know both.</p>

<h2>Which map should you pick?</h2>
<table>
<thead><tr><th>Class</th><th>Iteration order</th><th>Cost of get / put</th></tr></thead>
<tbody>
<tr><td><code>HashMap</code></td><td>no guaranteed order</td><td>O(1) average</td></tr>
<tr><td><code>LinkedHashMap</code></td><td>insertion order</td><td>O(1) average</td></tr>
<tr><td><code>TreeMap</code></td><td>sorted by key</td><td>O(log n)</td></tr>
</tbody>
</table>
<p>The same three flavours exist for sets: <code>HashSet</code>, <code>LinkedHashSet</code> and <code>TreeSet</code>. When an expected output must be "in the order the items first appeared", reach for the linked versions; for "in alphabetical order", the tree versions.</p>

<h2>Common mistakes</h2>
<ul>
<li>Writing <code>int count = map.get("Delhi");</code> when "Delhi" is absent. <code>get</code> returns null, and unboxing null into an <code>int</code> throws <code>NullPointerException</code>.</li>
<li>Relying on the printed order of a <code>HashMap</code> in an answer that is checked line by line.</li>
<li>Removing entries while looping over <code>map.keySet()</code> with a for-each loop, which throws <code>ConcurrentModificationException</code>. Use <code>map.entrySet().removeIf(...)</code> instead.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>You need each distinct word of a sentence, printed alphabetically. Which collection?</summary><p>A <code>TreeSet&lt;String&gt;</code>: it removes duplicates and iterates in sorted order.</p></details>`,
          resources: [
            { title: 'Map (Java 21 API)', url: `${JAVA_API}/java/util/Map.html` },
            { title: 'HashSet (Java 21 API)', url: `${JAVA_API}/java/util/HashSet.html` },
            { title: 'TreeMap (Java 21 API)', url: `${JAVA_API}/java/util/TreeMap.html` },
          ],
        },
        {
          kind: 'article',
          title: 'equals and hashCode: making your own keys work',
          minutes: 13,
          topic: 'Hashing',
          html: `<p>Strings and Integers work as map keys out of the box. Your own classes do not — unless you write <code>equals</code> and <code>hashCode</code> correctly. This is one of the most-asked Java interview topics, and the bug it causes is silent: no exception, just a <code>null</code> where you expected a value.</p>

<h2>The bug, then the fix</h2>
<pre><code class="language-java">import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

public class Main {
    // No equals or hashCode: two objects are "equal" only if they are the same object.
    static class PlainKey {
        final String branch;
        final int number;
        PlainKey(String branch, int number) { this.branch = branch; this.number = number; }
    }

    // Overrides both methods, using the same fields in each.
    static class RollNo {
        final String branch;
        final int number;
        RollNo(String branch, int number) { this.branch = branch; this.number = number; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof RollNo other)) return false;
            return number == other.number &amp;&amp; branch.equals(other.branch);
        }

        @Override
        public int hashCode() {
            return Objects.hash(branch, number);
        }
    }

    // A record generates equals, hashCode and toString from its components.
    record StudentId(String branch, int number) {}

    public static void main(String[] args) {
        Map&lt;PlainKey, String&gt; plain = new HashMap&lt;&gt;();
        plain.put(new PlainKey("CSE", 42), "Kavya");
        System.out.println(plain.get(new PlainKey("CSE", 42)));         // null

        Map&lt;RollNo, String&gt; fixed = new HashMap&lt;&gt;();
        fixed.put(new RollNo("CSE", 42), "Kavya");
        System.out.println(fixed.get(new RollNo("CSE", 42)));           // Kavya

        Map&lt;StudentId, String&gt; withRecord = new HashMap&lt;&gt;();
        withRecord.put(new StudentId("ECE", 7), "Rahul");
        System.out.println(withRecord.get(new StudentId("ECE", 7)));    // Rahul
    }
}</code></pre>
<p>In the first map, the second <code>new PlainKey("CSE", 42)</code> is a different object. It inherits <code>hashCode</code> from <code>Object</code>, which is based on identity, so the lookup goes to a different bucket — and even in the same bucket, the inherited <code>equals</code> would say "not equal".</p>

<h2>The contract, in plain words</h2>
<ol>
<li>If <code>a.equals(b)</code> is true, then <code>a.hashCode() == b.hashCode()</code> must be true.</li>
<li>Equal hash codes do <em>not</em> have to mean equal objects — collisions are allowed.</li>
<li>Both methods must give the same answer every time they are called, as long as the fields they use do not change.</li>
</ol>
<p>The easy way to keep rule 1: build both methods from the <strong>same fields</strong>. Override only <code>equals</code> and you break it — equal objects get different hash codes, and the map looks in the wrong bucket.</p>

<h2>Records do it for you</h2>
<p>A Java <code>record</code> is a compact, immutable data class. The compiler writes the constructor, accessors, <code>equals</code>, <code>hashCode</code> and <code>toString</code> using all its components. For a key class, a record is almost always the best choice in modern Java.</p>

<h2>Common mistakes</h2>
<ul>
<li><strong>Changing a key after putting it in a map.</strong> Its hash code changes, but the entry stays in the old bucket, so the map can no longer find it. Make key fields <code>final</code>, or use a record.</li>
<li>Writing <code>public boolean equals(RollNo other)</code>. That <em>overloads</em> instead of overriding, because the real method takes <code>Object</code>. The <code>@Override</code> annotation catches this at compile time — always use it.</li>
<li>Including a field in <code>equals</code> but leaving it out of <code>hashCode</code>, or the other way round.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>A class overrides <code>hashCode</code> to always return 1. Is that legal? Is it a good idea?</summary><p>It is legal — equal objects still have equal hash codes. But every key lands in the same bucket, so the map degrades to a slow list (or tree) search.</p></details>`,
          resources: [
            {
              title: 'Object.equals and hashCode (Java 21 API)',
              url: `${JAVA_API}/java/lang/Object.html`,
            },
            { title: 'Record classes (Java 21 API)', url: `${JAVA_API}/java/lang/Record.html` },
          ],
        },
        {
          kind: 'article',
          title: 'The complement trick: finding pairs with a map',
          minutes: 12,
          topic: 'Hashing',
          html: `<p>"Find two items that add up to a target" appears in so many forms that it deserves its own lesson. The brute-force answer checks every pair: O(n²). The trick that brings it down to O(n) is to stop asking "which pairs work?" and ask instead: <strong>for this item, have I already seen its partner?</strong></p>

<h2>The idea</h2>
<p>If the target is k and the current item is x, the partner it needs is <code>k − x</code> — its <em>complement</em>. Walk through the items once. For each one, look its complement up in a map of everything seen so far (O(1) on average), then record the current item for the items still to come.</p>

<h2>Worked example: how many pairs of bills match a voucher?</h2>
<p>A canteen voucher is worth exactly 6 coins. Given a list of item prices, count the pairs of positions whose prices add up to 6.</p>
<pre><code class="language-java">import java.util.HashMap;
import java.util.Map;

public class Main {
    static long countPairs(int[] prices, int k) {
        Map&lt;Integer, Integer&gt; seen = new HashMap&lt;&gt;();   // value -&gt; how many times seen
        long pairs = 0;
        for (int x : prices) {
            pairs += seen.getOrDefault(k - x, 0);   // partners already seen
            seen.merge(x, 1, Integer::sum);         // x can partner later items
        }
        return pairs;
    }

    public static void main(String[] args) {
        System.out.println(countPairs(new int[] {1, 5, 7, -1, 5}, 6));  // 3
        System.out.println(countPairs(new int[] {3, 3, 3}, 6));         // 3
    }
}</code></pre>

<h3>Dry run for [1, 5, 7, −1, 5] with k = 6</h3>
<table>
<thead><tr><th>x</th><th>Complement 6 − x</th><th>Seen before?</th><th>pairs</th><th>Map afterwards</th></tr></thead>
<tbody>
<tr><td>1</td><td>5</td><td>no</td><td>0</td><td>{1:1}</td></tr>
<tr><td>5</td><td>1</td><td>once</td><td>1</td><td>{1:1, 5:1}</td></tr>
<tr><td>7</td><td>−1</td><td>no</td><td>1</td><td>{1:1, 5:1, 7:1}</td></tr>
<tr><td>−1</td><td>7</td><td>once</td><td>2</td><td>… −1:1</td></tr>
<tr><td>5</td><td>1</td><td>once</td><td>3</td><td>… 5:2</td></tr>
</tbody>
</table>
<p>The three pairs are (1, 5), (7, −1) and (1, the second 5). One pass: <strong>O(n) time, O(n) extra space</strong>.</p>

<h2>Why look up before you record</h2>
<p>The order of the two lines inside the loop matters. Looking up first means an item can only pair with items <em>before</em> it, so it never pairs with itself and no pair is counted twice. With k = 6 and a single 3, swapping the lines would wrongly count (3, 3).</p>

<h2>Variations you can now solve</h2>
<ul>
<li><strong>Return the positions of the pair</strong> instead of counting: store each value's index in the map instead of its count. That is the practice question in this module.</li>
<li><strong>Pair with a given difference d:</strong> look up both <code>x − d</code> and <code>x + d</code>.</li>
<li><strong>Does any pair exist?</strong> A <code>HashSet</code> is enough, and you can stop at the first hit.</li>
</ul>
<p>If the input is already sorted, the two-pointer technique in the last module solves the same problem in O(1) extra space.</p>

<h2>Common mistakes</h2>
<ul>
<li>Putting all items in the map first and then searching, which lets an item pair with itself.</li>
<li>Using <code>int</code> for the count. With n = 1 lakh equal items there are about 5 × 10⁹ pairs, beyond the <code>int</code> range — hence <code>long</code>.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>Using the same method, how many pairs in [2, 4, 3, 3] add up to 6?</summary><p>Two: (2, 4) and (3, 3).</p></details>`,
        },
        {
          kind: 'practice',
          question: 'dsa-two-sum',
          title: 'Practice: two numbers that add up to a target',
          topic: 'Practice',
        },
        {
          kind: 'practice',
          question: 'remove-the-duplicates',
          title: 'Practice: remove duplicates, keeping the first of each',
          topic: 'Practice',
        },
      ],
    },

    // ───────────────────────── Module 5 ─────────────────────────
    {
      title: 'Searching and sorting',
      summary:
        'Search with linear and binary search, including binary search on the answer, sort with the classic quadratic sorts, merge sort and quick sort, and use Java’s built-in sorting well.',
      lessons: [
        {
          kind: 'article',
          title: 'Linear search and binary search, traced step by step',
          minutes: 15,
          topic: 'Searching',
          html: `<p>Looking for a name on an unsorted attendance sheet, you have no choice but to read from the top: that is <strong>linear search</strong>, O(n). But when the sheet is sorted, you can open it in the middle, see whether your name comes before or after, and throw away half the sheet in one look. Repeat, and you have <strong>binary search</strong>: O(log n). For 10 lakh names that is about 20 looks instead of up to 10 lakh.</p>

<h2>The code</h2>
<pre><code class="language-java">public class Main {
    static int binarySearch(int[] a, int target) {
        int lo = 0, hi = a.length - 1;           // the range that may still hold target
        while (lo &lt;= hi) {
            int mid = lo + (hi - lo) / 2;
            if (a[mid] == target) return mid;
            if (a[mid] &lt; target) lo = mid + 1;   // target is to the right
            else hi = mid - 1;                   // target is to the left
        }
        return -1;                               // range is empty: not present
    }

    static int lastIndexOf(int[] a, int target) {
        int lo = 0, hi = a.length - 1, answer = -1;
        while (lo &lt;= hi) {
            int mid = lo + (hi - lo) / 2;
            if (a[mid] == target) {
                answer = mid;      // a match, but there may be another to the right
                lo = mid + 1;
            } else if (a[mid] &lt; target) {
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return answer;
    }

    public static void main(String[] args) {
        int[] marks = {4, 8, 15, 16, 23, 42, 50};
        System.out.println(binarySearch(marks, 23));   // 4
        System.out.println(binarySearch(marks, 5));    // -1
        int[] repeats = {2, 4, 4, 4, 7, 9};
        System.out.println(lastIndexOf(repeats, 4));   // 3
    }
}</code></pre>

<h2>Dry run: searching for 23</h2>
<table>
<thead><tr><th>lo</th><th>hi</th><th>mid</th><th>a[mid]</th><th>Decision</th></tr></thead>
<tbody>
<tr><td>0</td><td>6</td><td>3</td><td>16</td><td>16 &lt; 23, go right: lo = 4</td></tr>
<tr><td>4</td><td>6</td><td>5</td><td>42</td><td>42 &gt; 23, go left: hi = 4</td></tr>
<tr><td>4</td><td>4</td><td>4</td><td>23</td><td>found at index 4</td></tr>
</tbody>
</table>
<p>Three comparisons for seven elements. Each step halves the range, so n elements need about log₂ n steps.</p>

<h2>Why mid = lo + (hi − lo) / 2?</h2>
<p><code>(lo + hi) / 2</code> gives the same value — until <code>lo + hi</code> exceeds the largest <code>int</code> (about 2.1 × 10⁹) and overflows into a negative number. That bug sat unnoticed in many libraries, including the JDK's own binary search, for years. The subtraction form never overflows. Interviewers notice when you write it.</p>

<h2>Finding the last (or first) occurrence</h2>
<p>With duplicates, plain binary search stops at <em>any</em> match. To get the last one, record the match and keep searching to the right, as <code>lastIndexOf</code> does. Finding the <em>first</em> occurrence is the mirror image — that is the practice question in this module.</p>

<h2>Java's built-in versions</h2>
<p><code>Arrays.binarySearch(a, key)</code> and <code>Collections.binarySearch(list, key)</code> return the index if found. If not, they return <code>-(insertion point) - 1</code>, a negative number that also tells you where the key <em>would</em> go. With duplicates, which matching index you get is not specified.</p>

<h2>Common mistakes</h2>
<ul>
<li>Running binary search on unsorted data. It returns wrong answers without any error.</li>
<li>Mixing loop styles: <code>while (lo &lt; hi)</code> with <code>hi = mid - 1</code> can skip the last candidate; <code>lo = mid</code> can loop forever. Learn one style thoroughly.</li>
<li>Sorting first just to search once. Sorting costs O(n log n), more than a single O(n) linear search.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>About how many steps does binary search need for 1 000 sorted items?</summary><p>About 10, since 2¹⁰ = 1 024.</p></details>`,
          resources: [
            {
              title: 'Arrays.binarySearch (Java 21 API)',
              url: `${JAVA_API}/java/util/Arrays.html`,
            },
            { title: 'Collections (Java 21 API)', url: `${JAVA_API}/java/util/Collections.html` },
          ],
        },
        {
          kind: 'article',
          title: 'Binary search on the answer',
          minutes: 14,
          topic: 'Searching',
          html: `<p>Binary search is not only for finding a value in a sorted array. Whenever the answer is a number in a known range, and you can cheaply check "does this candidate work?", you can binary-search the <em>answer itself</em>. This pattern solves a whole family of "find the minimum X such that…" questions.</p>

<h2>The condition that makes it work</h2>
<p>The check must be <strong>monotonic</strong>: once a candidate works, every bigger candidate works too (or every smaller one, for "maximum" questions). Then the candidates look like <code>fail fail fail work work work</code>, and binary search can find the boundary in O(log range) checks.</p>

<h2>Example 1: integer square root</h2>
<p>Find the largest x with x × x ≤ n. If x works, every smaller number works too, so we search for the last "works".</p>

<h2>Example 2: the smallest daily reading limit</h2>
<p>You must read chapters in order, never splitting a chapter across days, and finish within a given number of days. What is the smallest number of pages per day that makes this possible? A bigger limit never needs more days, so the check is monotonic. The answer lies between the longest chapter (you must fit it in one day) and the total number of pages (one day for everything).</p>
<pre><code class="language-java">public class Main {
    static int sqrtFloor(int n) {
        long lo = 0, hi = n, answer = 0;
        while (lo &lt;= hi) {
            long mid = lo + (hi - lo) / 2;
            if (mid * mid &lt;= n) {     // long arithmetic: no overflow
                answer = mid;          // mid works; try something bigger
                lo = mid + 1;
            } else {
                hi = mid - 1;          // too big
            }
        }
        return (int) answer;
    }

    static int daysNeeded(int[] pages, int limit) {
        int days = 1, today = 0;
        for (int p : pages) {
            if (today + p &gt; limit) {   // this chapter starts a new day
                days++;
                today = 0;
            }
            today += p;
        }
        return days;
    }

    static int smallestDailyLimit(int[] pages, int days) {
        int lo = 0, hi = 0;
        for (int p : pages) {
            lo = Math.max(lo, p);      // must fit the longest chapter
            hi += p;                   // one day for everything always works
        }
        while (lo &lt; hi) {
            int mid = lo + (hi - lo) / 2;
            if (daysNeeded(pages, mid) &lt;= days) hi = mid;  // works: maybe smaller does too
            else lo = mid + 1;                            // fails: need more
        }
        return lo;
    }

    public static void main(String[] args) {
        System.out.println(sqrtFloor(40));    // 6
        System.out.println(sqrtFloor(49));    // 7
        System.out.println(smallestDailyLimit(new int[] {40, 10, 30, 20, 50}, 2));  // 80
    }
}</code></pre>

<h3>Checking the answer 80 by hand</h3>
<p>With a limit of 80: day 1 reads 40 + 10 + 30 = 80, and adding 20 would exceed the limit; day 2 reads 20 + 50 = 70. Two days — it works. With 79: day 1 reads 40 + 10 = 50, day 2 reads 30 + 20 = 50, day 3 reads 50. Three days — too many. So 80 is the smallest limit.</p>

<h2>Cost</h2>
<p>Each check walks the chapters once, O(n), and binary search makes about log₂(total pages) checks: <strong>O(n log S)</strong> where S is the sum. Trying every limit from the largest chapter upwards would be O(n × S).</p>

<h2>Two loop styles</h2>
<p>The square root uses <code>lo &lt;= hi</code> with a separate <code>answer</code> variable; the reading limit uses <code>lo &lt; hi</code> with <code>hi = mid</code>, so <code>lo</code> ends on the answer. Both are correct. Pick one, understand why it terminates, and use it consistently.</p>

<h2>Common mistakes</h2>
<ul>
<li>A check that is not monotonic. Binary search then jumps past valid answers.</li>
<li>A wrong range: starting <code>lo</code> at 0 for the reading limit would let the check accept a limit smaller than one chapter.</li>
<li>Overflow in <code>mid * mid</code> with <code>int</code>. For n near 2 × 10⁹, mid can be about 10⁹ and its square needs a <code>long</code>.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>Same chapters, but three days allowed. What is the smallest limit?</summary><p>50: 40 + 10, then 30 + 20, then 50. A limit of 49 would need four days.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Bubble, selection and insertion sort, traced',
          minutes: 15,
          topic: 'Sorting',
          html: `<p>You will rarely write these three sorts in production — Java's built-in sorts are faster. You still need them: interviewers ask about them, they teach you how to reason about loops and swaps, and insertion sort is used <em>inside</em> real library sorts for small pieces of data.</p>

<h2>Bubble sort</h2>
<p>Walk through the array comparing neighbours and swap any pair that is out of order. After the first pass the largest value has "bubbled" to the end; after the second, the second largest; and so on. If a whole pass makes no swap, the array is sorted and you can stop early.</p>

<h2>Selection sort</h2>
<p>Find the smallest value in the unsorted part and swap it to the front of that part. Repeat for the rest. It always makes about n²/2 comparisons, even on sorted input, but at most n − 1 swaps — useful only when writes are very expensive.</p>

<h2>Insertion sort</h2>
<p>This is how most people sort a hand of playing cards: take the next card and slide it left past every larger card until it fits. The left part of the array is always sorted.</p>
<pre><code class="language-java">import java.util.Arrays;

public class Main {
    static void insertionSort(int[] a) {
        for (int i = 1; i &lt; a.length; i++) {
            int key = a[i];
            int j = i - 1;
            while (j &gt;= 0 &amp;&amp; a[j] &gt; key) {   // strictly greater keeps equal items in order
                a[j + 1] = a[j];               // shift right
                j--;
            }
            a[j + 1] = key;
        }
    }

    static void bubbleSort(int[] a) {
        for (int pass = 0; pass &lt; a.length - 1; pass++) {
            boolean swapped = false;
            for (int i = 0; i &lt; a.length - 1 - pass; i++) {
                if (a[i] &gt; a[i + 1]) {
                    int tmp = a[i];
                    a[i] = a[i + 1];
                    a[i + 1] = tmp;
                    swapped = true;
                }
            }
            if (!swapped) break;               // already sorted: stop early
        }
    }

    public static void main(String[] args) {
        int[] a = {5, 2, 4, 6, 1, 3};
        insertionSort(a);
        System.out.println(Arrays.toString(a));   // [1, 2, 3, 4, 5, 6]
        int[] b = {9, 7, 8, 1};
        bubbleSort(b);
        System.out.println(Arrays.toString(b));   // [1, 7, 8, 9]
    }
}</code></pre>

<h3>Dry run of insertion sort on [5, 2, 4, 6, 1, 3]</h3>
<table>
<thead><tr><th>i</th><th>key</th><th>Shifted</th><th>Array afterwards</th></tr></thead>
<tbody>
<tr><td>1</td><td>2</td><td>5</td><td>[2, 5, 4, 6, 1, 3]</td></tr>
<tr><td>2</td><td>4</td><td>5</td><td>[2, 4, 5, 6, 1, 3]</td></tr>
<tr><td>3</td><td>6</td><td>nothing</td><td>[2, 4, 5, 6, 1, 3]</td></tr>
<tr><td>4</td><td>1</td><td>6, 5, 4, 2</td><td>[1, 2, 4, 5, 6, 3]</td></tr>
<tr><td>5</td><td>3</td><td>6, 5, 4</td><td>[1, 2, 3, 4, 5, 6]</td></tr>
</tbody>
</table>

<h2>Comparing the three</h2>
<table>
<thead><tr><th>Sort</th><th>Best</th><th>Average / worst</th><th>Extra space</th><th>Stable?</th></tr></thead>
<tbody>
<tr><td>Bubble (with early stop)</td><td>O(n)</td><td>O(n²)</td><td>O(1)</td><td>yes</td></tr>
<tr><td>Selection</td><td>O(n²)</td><td>O(n²)</td><td>O(1)</td><td>no</td></tr>
<tr><td>Insertion</td><td>O(n)</td><td>O(n²)</td><td>O(1)</td><td>yes</td></tr>
</tbody>
</table>
<p>A <strong>stable</strong> sort keeps items with equal keys in their original relative order. If students are already in alphabetical order and you stable-sort them by marks, students with the same marks stay alphabetical. Selection sort's long-distance swaps can break that order.</p>
<p>Insertion sort shines on <em>nearly sorted</em> data: each item moves only a short distance, so the cost approaches O(n). That is why library sorts switch to it for small or almost-ordered pieces.</p>

<h2>Common mistakes</h2>
<ul>
<li>Writing <code>a[j] &gt;= key</code> in insertion sort. It still sorts, but it is no longer stable.</li>
<li>Letting the bubble sort inner loop run to <code>a.length - 1</code> on every pass — correct, but it wastes time re-checking the sorted tail.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>Which of the three would you choose for a list of 50 items that is sorted except for two swapped neighbours?</summary><p>Insertion sort (or bubble sort with the early stop): both finish in close to linear time on nearly sorted input.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Merge sort: divide, sort, merge',
          minutes: 15,
          topic: 'Sorting',
          html: `<p>Quadratic sorts collapse on large inputs: sorting 10 lakh marks with insertion sort takes about 2.5 × 10¹¹ steps in the average case. <strong>Merge sort</strong> needs about 2 crore. It is the classic <em>divide and conquer</em> algorithm, and its merge step is a pattern you will reuse on its own.</p>

<h2>The idea in three lines</h2>
<ol>
<li><strong>Divide:</strong> split the array into two halves.</li>
<li><strong>Conquer:</strong> sort each half recursively. An array of one element is already sorted — that is the base case.</li>
<li><strong>Combine:</strong> merge the two sorted halves into one sorted array.</li>
</ol>

<h2>Merging two sorted halves</h2>
<p>Keep one pointer at the start of each half. Compare the two values under the pointers, copy the smaller one out, and advance that pointer. When one half runs out, copy the rest of the other. Every element is copied once, so merging n elements is O(n).</p>
<pre><code class="language-java">import java.util.Arrays;

public class Main {
    static void mergeSort(int[] a, int[] buffer, int lo, int hi) {  // sorts a[lo..hi]
        if (lo &gt;= hi) return;                  // 0 or 1 element: already sorted
        int mid = lo + (hi - lo) / 2;
        mergeSort(a, buffer, lo, mid);
        mergeSort(a, buffer, mid + 1, hi);
        merge(a, buffer, lo, mid, hi);
    }

    static void merge(int[] a, int[] buffer, int lo, int mid, int hi) {
        int i = lo, j = mid + 1, k = lo;
        while (i &lt;= mid &amp;&amp; j &lt;= hi) {
            if (a[i] &lt;= a[j]) buffer[k++] = a[i++];   // &lt;= takes the left item on ties: stable
            else buffer[k++] = a[j++];
        }
        while (i &lt;= mid) buffer[k++] = a[i++];        // leftovers from the left half
        while (j &lt;= hi) buffer[k++] = a[j++];         // leftovers from the right half
        for (k = lo; k &lt;= hi; k++) a[k] = buffer[k];
    }

    public static void main(String[] args) {
        int[] a = {38, 27, 43, 3, 9, 82, 10};
        mergeSort(a, new int[a.length], 0, a.length - 1);
        System.out.println(Arrays.toString(a));       // [3, 9, 10, 27, 38, 43, 82]
    }
}</code></pre>

<h2>Dry run</h2>
<pre><code class="language-text">split:  [38 27 43 3 9 82 10]
        [38 27 43 3]            [9 82 10]
        [38 27]   [43 3]        [9 82]   [10]
        [38] [27] [43] [3]      [9] [82]
merge:  [27 38]   [3 43]        [9 82]   [10]
        [3 27 38 43]            [9 10 82]
        [3 9 10 27 38 43 82]</code></pre>

<h2>Why O(n log n)?</h2>
<p>Halving n repeatedly until pieces have size 1 takes about log₂ n levels. At every level, the merges together touch all n elements once. So the total is n × log n — in the best, average <em>and</em> worst case. That predictability is merge sort's big selling point.</p>

<h2>Strengths and costs</h2>
<ul>
<li><strong>Stable</strong>, thanks to <code>&lt;=</code> in the merge.</li>
<li>Needs <strong>O(n) extra space</strong> for the buffer. Allocate it once, as above, not inside every call.</li>
<li>Works well on linked lists (merging needs no random access) and on data too big for memory, sorted in chunks and merged from disk.</li>
</ul>

<h2>Common mistakes</h2>
<ul>
<li>Forgetting the two leftover loops, which silently drops elements.</li>
<li>Using <code>&lt;</code> instead of <code>&lt;=</code> in the merge: still sorted, but no longer stable.</li>
<li>Splitting as <code>[lo, mid - 1]</code> and <code>[mid, hi]</code> with a mid that can equal <code>lo</code>, which causes infinite recursion on two elements.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>Merge [2, 9, 12] and [3, 4, 15] by hand. How many comparisons do you make?</summary><p>The result is [2, 3, 4, 9, 12, 15]. Comparisons: 2 vs 3, 9 vs 3, 9 vs 4, 9 vs 15, 12 vs 15 — five. Then the left half is empty and 15 is copied without comparing.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Quick sort and the sorts built into Java',
          minutes: 15,
          topic: 'Sorting',
          html: `<p>Quick sort is the other famous divide-and-conquer sort. Where merge sort does its real work while <em>combining</em>, quick sort does it while <em>dividing</em>: it picks a <strong>pivot</strong>, moves smaller values to its left and larger ones to its right, and then sorts each side. In practice it is very fast and needs no buffer.</p>

<h2>Partitioning around a pivot</h2>
<p>This version (the Lomuto scheme) uses the last element as the pivot and keeps a <code>boundary</code>: everything left of it is smaller than the pivot.</p>
<pre><code class="language-java">import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

public class Main {
    record Student(String name, int marks) {}

    static void quickSort(int[] a, int lo, int hi) {
        if (lo &gt;= hi) return;
        int p = partition(a, lo, hi);
        quickSort(a, lo, p - 1);
        quickSort(a, p + 1, hi);
    }

    static int partition(int[] a, int lo, int hi) {
        int pivot = a[hi];
        int boundary = lo;                 // a[lo..boundary-1] are smaller than pivot
        for (int i = lo; i &lt; hi; i++) {
            if (a[i] &lt; pivot) {
                swap(a, i, boundary);
                boundary++;
            }
        }
        swap(a, boundary, hi);             // the pivot lands in its final place
        return boundary;
    }

    static void swap(int[] a, int i, int j) {
        int tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }

    public static void main(String[] args) {
        int[] a = {7, 2, 9, 4, 3, 8, 5};
        quickSort(a, 0, a.length - 1);
        System.out.println(Arrays.toString(a));   // [2, 3, 4, 5, 7, 8, 9]

        List&lt;Student&gt; list = new ArrayList&lt;&gt;(List.of(
                new Student("Meena", 88), new Student("Arjun", 92),
                new Student("Zoya", 88), new Student("Bala", 75)));
        list.sort(Comparator.comparingInt(Student::marks).reversed()
                .thenComparing(Student::name));
        list.forEach(s -&gt; System.out.println(s.name() + " " + s.marks()));
    }
}</code></pre>
<p>The student list prints Arjun 92, Meena 88, Zoya 88, Bala 75: highest marks first, ties broken by name.</p>

<h3>Dry run of the first partition, pivot 5</h3>
<table>
<thead><tr><th>i</th><th>a[i]</th><th>Smaller than 5?</th><th>Array afterwards</th></tr></thead>
<tbody>
<tr><td>0</td><td>7</td><td>no</td><td>[7, 2, 9, 4, 3, 8, 5]</td></tr>
<tr><td>1</td><td>2</td><td>yes, swap with index 0</td><td>[2, 7, 9, 4, 3, 8, 5]</td></tr>
<tr><td>2</td><td>9</td><td>no</td><td>unchanged</td></tr>
<tr><td>3</td><td>4</td><td>yes, swap with index 1</td><td>[2, 4, 9, 7, 3, 8, 5]</td></tr>
<tr><td>4</td><td>3</td><td>yes, swap with index 2</td><td>[2, 4, 3, 7, 9, 8, 5]</td></tr>
<tr><td>5</td><td>8</td><td>no</td><td>unchanged</td></tr>
<tr><td>end</td><td></td><td>pivot to index 3</td><td>[2, 4, 3, 5, 9, 8, 7]</td></tr>
</tbody>
</table>
<p>5 is now in its final position; the two sides are sorted recursively.</p>

<h2>Cost</h2>
<p>When pivots split the array roughly in half, quick sort is <strong>O(n log n)</strong>, with only O(log n) stack space. When the pivot is always the smallest or largest value — for example, already-sorted input with a last-element pivot — every split peels off one element and the cost becomes <strong>O(n²)</strong>. Choosing a random pivot makes that worst case extremely unlikely. Quick sort is not stable.</p>

<h2>What Java actually uses</h2>
<ul>
<li><code>Arrays.sort</code> on primitive arrays (<code>int[]</code>, <code>double[]</code>…) uses a tuned <strong>dual-pivot quicksort</strong>. Stability does not matter for primitives — two equal ints are indistinguishable.</li>
<li><code>Arrays.sort</code> on object arrays, <code>Collections.sort</code> and <code>List.sort</code> use <strong>TimSort</strong>, a merge sort variant that is <em>stable</em>, O(n log n), and very fast on partly sorted data.</li>
</ul>
<p>So in an interview: "for objects, Java's sort is stable; for primitives, it is a quicksort variant".</p>

<h2>Common mistakes</h2>
<ul>
<li>Writing comparators as <code>(x, y) -&gt; x.marks() - y.marks()</code>. Subtraction can overflow for large or negative values; use <code>Integer.compare</code> or <code>Comparator.comparingInt</code>.</li>
<li>Expecting a <code>Comparator</code> with <code>reversed()</code> in the middle of a chain to reverse only the first key — <code>reversed()</code> reverses everything built so far, so place it carefully.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>Why can quick sort be slow on input that is already sorted?</summary><p>With the last element as the pivot, every partition puts all other elements on one side, so the recursion goes n levels deep and does about n²/2 comparisons.</p></details>`,
          resources: [
            { title: 'Comparator (Java 21 API)', url: `${JAVA_API}/java/util/Comparator.html` },
            { title: 'Arrays.sort (Java 21 API)', url: `${JAVA_API}/java/util/Arrays.html` },
          ],
        },
        {
          kind: 'practice',
          question: 'dsa-binary-search-first',
          title: 'Practice: first position of a value in a sorted list',
          topic: 'Practice',
        },
        {
          kind: 'practice',
          question: 'dsa-merge-sorted',
          title: 'Practice: merge two sorted lists',
          topic: 'Practice',
        },
        {
          kind: 'practice',
          question: 'dsa-kth-smallest',
          title: 'Practice: the k-th smallest number',
          topic: 'Practice',
        },
      ],
    },

    // ───────────────────────── Module 6 ─────────────────────────
    {
      title: 'Recursion, trees and graphs',
      summary:
        'Write recursive methods with clear base cases, speed them up with memoisation, explore choices with backtracking, and traverse binary trees and graphs depth-first and breadth-first.',
      lessons: [
        {
          kind: 'article',
          title: 'Thinking recursively: base case, smaller problem, call stack',
          minutes: 14,
          topic: 'Recursion',
          html: `<p>A recursive method solves a problem by calling itself on a <em>smaller</em> version of the same problem. It sounds circular, but think of a queue at a ticket counter: "how many people are ahead of me?" — ask the person in front, who asks the person in front of them, until someone at the counter answers "nobody". Each person then adds one and passes the answer back.</p>

<h2>Two parts, every time</h2>
<ul>
<li><strong>Base case:</strong> a small input you can answer directly, without recursion.</li>
<li><strong>Recursive case:</strong> shrink the problem, call yourself, and build your answer from the smaller answer.</li>
</ul>
<pre><code class="language-java">public class Main {
    static long factorial(int n) {
        if (n &lt;= 1) return 1;              // base case
        return n * factorial(n - 1);       // recursive case: a smaller problem
    }

    static int digitSum(int n) {
        if (n &lt; 10) return n;              // a single digit is its own sum
        return n % 10 + digitSum(n / 10);  // last digit + sum of the rest
    }

    static long power(long x, int n) {     // x to the power n, for n &gt;= 0
        if (n == 0) return 1;
        long half = power(x, n / 2);       // solve half the problem once ...
        return (n % 2 == 0) ? half * half : half * half * x;   // ... and reuse it
    }

    public static void main(String[] args) {
        System.out.println(factorial(5));    // 120
        System.out.println(digitSum(9045));  // 18
        System.out.println(power(2, 30));    // 1073741824
    }
}</code></pre>

<h2>What the call stack does</h2>
<p>Each call gets its own stack frame holding its own <code>n</code>. Calls pile up until the base case, then return in reverse order:</p>
<pre><code class="language-text">factorial(4) waits for factorial(3)
  factorial(3) waits for factorial(2)
    factorial(2) waits for factorial(1)
      factorial(1) returns 1            &lt;- base case
    factorial(2) returns 2 * 1 = 2
  factorial(3) returns 3 * 2 = 6
factorial(4) returns 4 * 6 = 24</code></pre>
<p>That pile is why recursion depth costs memory: factorial(n) needs n frames at its deepest point.</p>

<h2>Halving instead of subtracting</h2>
<p><code>power</code> shrinks n by half on each call instead of by one, so it makes only about log₂ n calls. <code>power(2, 30)</code> makes six calls (n = 30, 15, 7, 3, 1, 0), where multiplying 2 by itself would take 29 multiplications; for n near a hundred crore it is about 31 calls against a hundred crore multiplications. This "fast exponentiation" idea appears in interview questions about large powers and modular arithmetic.</p>

<h2>How to write one without getting lost</h2>
<ol>
<li>What is the smallest input, and what is its answer?</li>
<li>How do I make the input smaller?</li>
<li>If a friend hands me the answer for the smaller input, how do I build mine?</li>
</ol>
<p>Then trust the recursive call — do not try to trace every level in your head. Trace a small example on paper only to verify.</p>

<h2>Common mistakes</h2>
<ul>
<li><strong>No base case, or one that is never reached</strong> (for example <code>n == 0</code> when n can go negative). Each call makes another until Java throws <code>StackOverflowError</code>.</li>
<li>Calling with the <em>same</em> input instead of a smaller one.</li>
<li>Recursing a lakh levels deep on a simple loop problem. Java does not optimise tail calls; use a loop when the recursion is just a straight line.</li>
<li>Overflow: <code>factorial(21)</code> no longer fits in a <code>long</code>.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>How many calls does <code>digitSum(9045)</code> make in total?</summary><p>Four: 9045, 904, 90 and 9 — one per digit.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Memoisation: stop solving the same subproblem twice',
          minutes: 14,
          topic: 'Recursion',
          html: `<p>Some recursive methods are correct but painfully slow, because they solve the same small problem again and again. <strong>Memoisation</strong> — remembering answers you have already computed — can turn an exponential method into a linear one with three extra lines. It is the doorway to dynamic programming.</p>

<h2>The slow version</h2>
<p>Fibonacci numbers: each is the sum of the previous two, starting 0, 1, 1, 2, 3, 5, 8, … The direct recursive definition is short:</p>
<pre><code class="language-java">public class Main {
    static long calls = 0;

    static long fibNaive(int n) {
        calls++;
        if (n &lt;= 1) return n;
        return fibNaive(n - 1) + fibNaive(n - 2);
    }

    static long fibMemo(int n, long[] memo) {
        calls++;
        if (n &lt;= 1) return n;
        if (memo[n] != 0) return memo[n];          // already solved: reuse it
        memo[n] = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
        return memo[n];
    }

    static long fibBottomUp(int n) {
        if (n &lt;= 1) return n;
        long prev = 0, cur = 1;
        for (int i = 2; i &lt;= n; i++) {
            long next = prev + cur;
            prev = cur;
            cur = next;
        }
        return cur;
    }

    public static void main(String[] args) {
        calls = 0;
        System.out.println(fibNaive(30) + " in " + calls + " calls");
        calls = 0;
        System.out.println(fibMemo(30, new long[31]) + " in " + calls + " calls");
        System.out.println(fibBottomUp(90));
    }
}</code></pre>
<p>Output:</p>
<pre><code class="language-text">832040 in 2692537 calls
832040 in 59 calls
2880067194370816120</code></pre>

<h2>Why the naive version explodes</h2>
<p>Draw the calls for fib(5): it calls fib(4) and fib(3); fib(4) calls fib(3) <em>again</em> and fib(2); and so on. fib(3) is computed twice, fib(2) three times, fib(1) five times. The number of calls grows roughly like 1.6ⁿ — that is the 27 lakh calls above for n = 30. At n = 50 you would wait for many minutes.</p>

<h2>Remember, then reuse</h2>
<p>The memoised version stores each answer in <code>memo[n]</code> the first time it is computed. Every later request for the same n returns immediately. Each value from 2 to n is computed once: <strong>O(n) time and O(n) space</strong>. (Using 0 to mean "not computed yet" works here because every Fibonacci number after the first is positive; in general use a sentinel such as −1, or a <code>Long[]</code> with null.)</p>

<h2>Bottom-up: no recursion at all</h2>
<p>If you know the order in which subproblems are needed, compute them from the smallest upwards. For Fibonacci you only ever need the last two values, so two variables are enough: <strong>O(n) time, O(1) space</strong>, and no risk of a deep call stack.</p>

<h2>This is dynamic programming</h2>
<p>Dynamic programming applies whenever a problem has <strong>overlapping subproblems</strong> (the same smaller question asked many times) and an answer that can be <strong>built from answers to smaller problems</strong>. Top-down with memoisation and bottom-up with a table are two ways to write the same idea. A good habit: write the plain recursion first, spot the repeated calls, then add the memo.</p>
<p>The practice question in this module — counting the ways to climb stairs one or two steps at a time — has exactly this shape. Ask yourself: what was the very last move?</p>

<h2>Common mistakes</h2>
<ul>
<li>Creating the memo array <em>inside</em> the recursive method, so every call gets a fresh, empty memo.</li>
<li>Using <code>int</code>: fib(47) already overflows it. fib(92) is the largest that fits in a <code>long</code>.</li>
<li>Memoising a method whose answer depends on something that is not part of the memo key.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>What are the time and extra space of <code>fibBottomUp</code>?</summary><p>O(n) time — one loop iteration per value — and O(1) extra space, since only two previous values are kept.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Backtracking: choose, explore, un-choose',
          minutes: 15,
          topic: 'Backtracking',
          html: `<p>Some questions ask for <em>every</em> possibility: all subsets of a set, all orderings of letters, every way to reach a target score. <strong>Backtracking</strong> builds each candidate one decision at a time, explores everything that follows from that decision, then <em>undoes</em> it and tries the next option. It is recursion with a clean-up step.</p>

<h2>The template</h2>
<pre><code class="language-text">explore(state):
    if state is a complete answer: record a copy, return
    for each option still allowed:
        choose the option      (change the state)
        explore(state)
        un-choose the option   (restore the state exactly)</code></pre>

<h2>Example 1: every subset</h2>
<p>For each item there are two choices — take it or leave it — so three items give 2³ = 8 subsets.</p>
<h2>Example 2: questions that add up to a target</h2>
<p>A test paper must total exactly 8 marks, built from questions worth 2, 3 or 5 marks; each kind may be used more than once. Which combinations work? Here we can <strong>prune</strong>: because the values are sorted, once a value is bigger than the marks still needed, every later value is too, and we stop that branch early.</p>
<pre><code class="language-java">import java.util.ArrayList;
import java.util.List;

public class Main {
    static void subsets(int[] items, int index, List&lt;Integer&gt; current, List&lt;List&lt;Integer&gt;&gt; out) {
        if (index == items.length) {            // decided for every item
            out.add(new ArrayList&lt;&gt;(current));  // copy: current keeps changing
            return;
        }
        current.add(items[index]);              // choose: take this item
        subsets(items, index + 1, current, out);
        current.remove(current.size() - 1);     // un-choose
        subsets(items, index + 1, current, out); // explore without it
    }

    // values must be sorted; each value may be reused.
    static void combine(int[] values, int start, int remaining,
                        List&lt;Integer&gt; current, List&lt;List&lt;Integer&gt;&gt; out) {
        if (remaining == 0) {
            out.add(new ArrayList&lt;&gt;(current));
            return;
        }
        for (int i = start; i &lt; values.length; i++) {
            if (values[i] &gt; remaining) break;   // prune: later values are bigger still
            current.add(values[i]);
            combine(values, i, remaining - values[i], current, out);   // i, not i + 1: reuse allowed
            current.remove(current.size() - 1);
        }
    }

    public static void main(String[] args) {
        List&lt;List&lt;Integer&gt;&gt; all = new ArrayList&lt;&gt;();
        subsets(new int[] {1, 2, 3}, 0, new ArrayList&lt;&gt;(), all);
        System.out.println(all);

        List&lt;List&lt;Integer&gt;&gt; papers = new ArrayList&lt;&gt;();
        combine(new int[] {2, 3, 5}, 0, 8, new ArrayList&lt;&gt;(), papers);
        System.out.println(papers);
    }
}</code></pre>
<p>Output:</p>
<pre><code class="language-text">[[1, 2, 3], [1, 2], [1, 3], [1], [2, 3], [2], [3], []]
[[2, 2, 2, 2], [2, 3, 3], [3, 5]]</code></pre>

<h3>The decision tree for subsets</h3>
<pre><code class="language-text">                    []
          take 1 /      \\ leave 1
              [1]          []
        take 2 / \\       / \\
         [1,2]  [1]    [2]   []
         /  \\   / \\    / \\   / \\
   [1,2,3][1,2][1,3][1][2,3][2][3][]</code></pre>
<p>Each leaf is one subset. The un-choose step is what lets the left branch hand a clean <code>current</code> back before the right branch starts.</p>

<h2>Cost</h2>
<p>Subsets: 2ⁿ leaves, each copied in up to n steps — <strong>O(n · 2ⁿ)</strong>. Orderings (permutations) of n distinct items: n! results. These numbers explode, so backtracking questions come with small limits, typically n ≤ 15 or 20. Pruning does not change the worst case but often cuts real running time drastically.</p>

<h2>Starting from <code>start</code> avoids repeats</h2>
<p>In <code>combine</code>, each call only considers values from index <code>start</code> onwards. That forces every combination to be built in non-decreasing order, so [2, 3, 3] is found once and [3, 2, 3] never appears.</p>

<h2>Common mistakes</h2>
<ul>
<li>Writing <code>out.add(current)</code> without copying. Every entry then points at the same list, which ends up empty after all the un-choosing.</li>
<li>Forgetting the un-choose step, so choices from one branch leak into the next.</li>
<li>Pruning with <code>break</code> on unsorted values — use <code>continue</code>, or sort first.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>How many subsets does a set of 10 items have?</summary><p>2¹⁰ = 1 024, including the empty set and the full set.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Binary trees, traversals and binary search trees',
          minutes: 15,
          topic: 'Trees',
          html: `<p>Folders inside folders, an organisation chart, the structure of an HTML page — hierarchies are everywhere, and the data structure for them is the <strong>tree</strong>. In a <strong>binary tree</strong> every node has at most two children, called left and right. Trees and recursion go together naturally: each child is the root of a smaller tree.</p>

<h2>Words you need</h2>
<ul>
<li><strong>Root:</strong> the top node. <strong>Leaf:</strong> a node with no children.</li>
<li><strong>Height:</strong> the number of levels on the longest path from the root down to a leaf (some books count edges instead; say which you mean).</li>
</ul>

<h2>Binary search trees</h2>
<p>A <strong>binary search tree</strong> (BST) adds one rule: everything in a node's left subtree is smaller than the node, and everything in its right subtree is larger. To search, compare with the node and go left or right — like binary search, but on a structure you can keep inserting into.</p>
<pre><code class="language-text">        50
      /    \\
    30      70
   /  \\    /  \\
  20  40  60  80</code></pre>
<pre><code class="language-java">public class Main {
    static class Node {
        int value;
        Node left, right;
        Node(int value) { this.value = value; }
    }

    static Node insert(Node root, int value) {
        if (root == null) return new Node(value);
        if (value &lt; root.value) root.left = insert(root.left, value);
        else if (value &gt; root.value) root.right = insert(root.right, value);
        return root;                               // duplicates are ignored
    }

    static boolean contains(Node root, int value) {
        Node cur = root;
        while (cur != null) {
            if (value == cur.value) return true;
            cur = value &lt; cur.value ? cur.left : cur.right;
        }
        return false;
    }

    static void preorder(Node n, StringBuilder out) {    // node, left, right
        if (n == null) return;
        out.append(n.value).append(' ');
        preorder(n.left, out);
        preorder(n.right, out);
    }

    static void inorder(Node n, StringBuilder out) {     // left, node, right
        if (n == null) return;
        inorder(n.left, out);
        out.append(n.value).append(' ');
        inorder(n.right, out);
    }

    static void postorder(Node n, StringBuilder out) {   // left, right, node
        if (n == null) return;
        postorder(n.left, out);
        postorder(n.right, out);
        out.append(n.value).append(' ');
    }

    static int height(Node n) {
        if (n == null) return 0;
        return 1 + Math.max(height(n.left), height(n.right));
    }

    public static void main(String[] args) {
        Node root = null;
        for (int v : new int[] {50, 30, 70, 20, 40, 60, 80}) root = insert(root, v);

        StringBuilder pre = new StringBuilder(), inOrder = new StringBuilder(), post = new StringBuilder();
        preorder(root, pre);
        inorder(root, inOrder);
        postorder(root, post);
        System.out.println("Preorder:  " + pre.toString().trim());
        System.out.println("Inorder:   " + inOrder.toString().trim());
        System.out.println("Postorder: " + post.toString().trim());
        System.out.println("Height: " + height(root));
        System.out.println(contains(root, 60) + " " + contains(root, 65));
    }
}</code></pre>
<p>Output:</p>
<pre><code class="language-text">Preorder:  50 30 20 40 70 60 80
Inorder:   20 30 40 50 60 70 80
Postorder: 20 40 30 60 80 70 50
Height: 3
true false</code></pre>

<h2>The three depth-first traversals</h2>
<ul>
<li><strong>Preorder</strong> visits a node before its children — useful for copying a tree or printing a folder structure.</li>
<li><strong>Inorder</strong> visits left, node, right. On a BST this produces the values in <em>sorted order</em> — a fact interviewers love.</li>
<li><strong>Postorder</strong> visits children first — useful when a node's answer depends on its children, such as computing sizes or deleting a tree.</li>
</ul>
<p>Each traversal visits every node once: O(n) time, and O(h) stack space for a tree of height h.</p>

<h2>Why balance matters</h2>
<p>Search, insert and delete in a BST cost O(h). A balanced tree of n nodes has h ≈ log₂ n. But insert sorted values — 10, 20, 30, 40… — and every node goes to the right: the tree becomes a linked list with h = n, and operations become O(n). Java's <code>TreeMap</code> and <code>TreeSet</code> use a self-balancing red-black tree, so they guarantee O(log n).</p>

<h2>Common mistakes</h2>
<ul>
<li>Checking whether a tree is a valid BST by comparing each node only with its direct children. A value deep in the left subtree must be smaller than <em>every</em> ancestor it sits left of; pass a valid range down the recursion instead.</li>
<li>Forgetting the <code>null</code> base case, which is what stops every tree recursion.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>Insert 5, 3, 8, 1, 4 into an empty BST. What does an inorder traversal print?</summary><p>1 3 4 5 8 — sorted order, as always for a BST.</p></details>`,
          resources: [
            { title: 'TreeMap (Java 21 API)', url: `${JAVA_API}/java/util/TreeMap.html` },
          ],
        },
        {
          kind: 'article',
          title: 'Graphs: adjacency lists, BFS and DFS',
          minutes: 15,
          topic: 'Graphs',
          html: `<p>A metro map, a network of friends, course prerequisites, roads between cities — whenever things are connected to other things without a strict top-down hierarchy, you have a <strong>graph</strong>: a set of <em>vertices</em> (nodes) joined by <em>edges</em>. Edges can be one-way (directed) or two-way (undirected), and may carry weights such as distances.</p>

<h2>Storing a graph</h2>
<ul>
<li><strong>Adjacency matrix:</strong> a V × V table where cell [u][v] says whether an edge exists. O(1) edge checks, but O(V²) space even when there are few edges.</li>
<li><strong>Adjacency list:</strong> for each vertex, a list of its neighbours. O(V + E) space. This is the usual choice in interviews.</li>
</ul>

<h2>Breadth-first and depth-first search</h2>
<p><strong>BFS</strong> explores in rings: first the start, then all its neighbours, then <em>their</em> neighbours. A queue keeps the order — first discovered, first explored. In an unweighted graph, BFS therefore finds the <strong>fewest hops</strong> to every vertex.</p>
<p><strong>DFS</strong> goes as deep as it can along one path before backing up, like exploring a maze with one hand on the wall. Recursion (or an explicit stack) drives it. DFS is the natural choice for questions like "is everything connected?", "is there a cycle?" or "list every path".</p>
<pre><code class="language-java">import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Queue;

public class Main {
    static List&lt;List&lt;Integer&gt;&gt; graph(int vertices, int[][] edges) {
        List&lt;List&lt;Integer&gt;&gt; adj = new ArrayList&lt;&gt;();
        for (int i = 0; i &lt; vertices; i++) adj.add(new ArrayList&lt;&gt;());
        for (int[] e : edges) {
            adj.get(e[0]).add(e[1]);
            adj.get(e[1]).add(e[0]);         // undirected: both directions
        }
        return adj;
    }

    static int[] bfs(List&lt;List&lt;Integer&gt;&gt; adj, int start, StringBuilder order) {
        int[] dist = new int[adj.size()];
        Arrays.fill(dist, -1);               // -1 means "not reached yet"
        Queue&lt;Integer&gt; queue = new ArrayDeque&lt;&gt;();
        dist[start] = 0;
        queue.offer(start);
        while (!queue.isEmpty()) {
            int v = queue.poll();
            order.append(v).append(' ');
            for (int next : adj.get(v)) {
                if (dist[next] == -1) {      // mark when queued, so nothing is queued twice
                    dist[next] = dist[v] + 1;
                    queue.offer(next);
                }
            }
        }
        return dist;
    }

    static void dfs(List&lt;List&lt;Integer&gt;&gt; adj, int v, boolean[] seen, StringBuilder order) {
        seen[v] = true;
        order.append(v).append(' ');
        for (int next : adj.get(v)) {
            if (!seen[next]) dfs(adj, next, seen, order);
        }
    }

    public static void main(String[] args) {
        int[][] edges = {{0, 1}, {0, 2}, {1, 3}, {2, 4}, {3, 4}};
        List&lt;List&lt;Integer&gt;&gt; adj = graph(6, edges);    // vertex 5 has no edges

        StringBuilder bfsOrder = new StringBuilder();
        int[] dist = bfs(adj, 0, bfsOrder);
        System.out.println("BFS order: " + bfsOrder.toString().trim());
        System.out.println("Hops from 0: " + Arrays.toString(dist));

        StringBuilder dfsOrder = new StringBuilder();
        dfs(adj, 0, new boolean[6], dfsOrder);
        System.out.println("DFS order: " + dfsOrder.toString().trim());
    }
}</code></pre>
<p>Output:</p>
<pre><code class="language-text">BFS order: 0 1 2 3 4
Hops from 0: [0, 1, 1, 2, 2, -1]
DFS order: 0 1 3 4 2</code></pre>

<h3>Dry run of the BFS queue</h3>
<table>
<thead><tr><th>Take from queue</th><th>Newly discovered</th><th>Queue afterwards</th></tr></thead>
<tbody>
<tr><td>0</td><td>1, 2 (1 hop)</td><td>[1, 2]</td></tr>
<tr><td>1</td><td>3 (2 hops)</td><td>[2, 3]</td></tr>
<tr><td>2</td><td>4 (2 hops)</td><td>[3, 4]</td></tr>
<tr><td>3</td><td>none — 4 already seen</td><td>[4]</td></tr>
<tr><td>4</td><td>none</td><td>[]</td></tr>
</tbody>
</table>
<p>Vertex 5 is never reached, so its distance stays −1: the graph is not connected.</p>

<h2>Cost</h2>
<p>Both searches visit each vertex once and look along each edge a constant number of times: <strong>O(V + E)</strong> time and O(V) extra space. For weighted graphs, "fewest hops" is not "shortest distance"; that needs Dijkstra's algorithm, which replaces the queue with a priority queue.</p>

<h2>Common mistakes</h2>
<ul>
<li>Forgetting the visited check. On any graph with a cycle, the search runs forever.</li>
<li>Marking a vertex visited when it is <em>taken out</em> of the BFS queue instead of when it is <em>put in</em>, which lets it be queued several times.</li>
<li>Adding only one direction of an undirected edge.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>Why does BFS find the fewest hops but DFS does not?</summary><p>BFS finishes every vertex at distance d before it starts any at distance d + 1, so the first time it reaches a vertex is by a shortest route. DFS may reach a vertex first along a long detour.</p></details>`,
        },
        {
          kind: 'practice',
          question: 'dsa-climbing-stairs',
          title: 'Practice: ways to climb the stairs',
          topic: 'Practice',
        },
      ],
    },

    // ───────────────────────── Module 7 ─────────────────────────
    {
      title: 'Patterns interviewers love',
      summary:
        'Turn brute-force O(n²) answers into O(n) ones with two pointers, sliding windows and prefix sums, and follow a repeatable plan from problem statement to tested code.',
      lessons: [
        {
          kind: 'article',
          title: 'Two pointers: walking in from both ends',
          minutes: 14,
          topic: 'Two pointers',
          html: `<p>Many array and string questions have an O(n²) answer that checks every pair. When the data is <strong>sorted</strong>, or when you are comparing a sequence with itself from both ends, two indices moving towards each other often do the same job in a single O(n) pass with O(1) extra space.</p>

<h2>Pattern 1: a pair with a given sum in a sorted array</h2>
<p>Put <code>left</code> at the smallest value and <code>right</code> at the largest. If their sum is too small, the only way to increase it is to move <code>left</code> right. If it is too big, move <code>right</code> left.</p>

<h2>Pattern 2: compacting in place with a read and a write pointer</h2>
<p>Both pointers move in the same direction: <code>read</code> visits every element and <code>write</code> marks where the next kept element goes. This removes duplicates from a sorted array without a second array.</p>
<pre><code class="language-java">import java.util.Arrays;

public class Main {
    // Positions of two values that add up to target, or null if there are none.
    static int[] pairWithSum(int[] sorted, int target) {
        int left = 0, right = sorted.length - 1;
        while (left &lt; right) {
            int sum = sorted[left] + sorted[right];
            if (sum == target) return new int[] {left, right};
            if (sum &lt; target) left++;     // need a bigger sum
            else right--;                 // need a smaller sum
        }
        return null;
    }

    // Keeps one copy of each value at the front; returns how many remain.
    static int dedupeSorted(int[] a) {
        if (a.length == 0) return 0;
        int write = 1;                    // a[0..write-1] holds the unique values
        for (int read = 1; read &lt; a.length; read++) {
            if (a[read] != a[write - 1]) {
                a[write++] = a[read];
            }
        }
        return write;
    }

    public static void main(String[] args) {
        int[] prices = {1, 3, 4, 6, 8, 11};
        System.out.println(Arrays.toString(pairWithSum(prices, 10)));  // [2, 3]
        System.out.println(Arrays.toString(pairWithSum(prices, 2)));   // null

        int[] scores = {1, 1, 2, 3, 3, 3, 4};
        int k = dedupeSorted(scores);
        System.out.println(k + " " + Arrays.toString(Arrays.copyOf(scores, k)));  // 4 [1, 2, 3, 4]
    }
}</code></pre>

<h3>Dry run: target 10 in [1, 3, 4, 6, 8, 11]</h3>
<table>
<thead><tr><th>left</th><th>right</th><th>Sum</th><th>Move</th></tr></thead>
<tbody>
<tr><td>0 (1)</td><td>5 (11)</td><td>12</td><td>too big: right--</td></tr>
<tr><td>0 (1)</td><td>4 (8)</td><td>9</td><td>too small: left++</td></tr>
<tr><td>1 (3)</td><td>4 (8)</td><td>11</td><td>too big: right--</td></tr>
<tr><td>1 (3)</td><td>3 (6)</td><td>9</td><td>too small: left++</td></tr>
<tr><td>2 (4)</td><td>3 (6)</td><td>10</td><td>found: [2, 3]</td></tr>
</tbody>
</table>

<h2>Why it never misses the answer</h2>
<p>When the sum is too small, <code>sorted[left]</code> paired with the <em>largest</em> remaining value is still too small, so it cannot pair with anything left — discarding it is safe. The same argument, mirrored, justifies moving <code>right</code>. Each step discards one candidate, so at most n − 1 steps happen.</p>

<h2>Where else it applies</h2>
<ul>
<li><strong>Palindromes:</strong> compare the characters at <code>left</code> and <code>right</code>, moving inwards. To ignore spaces and punctuation, skip characters that are not letters or digits before comparing — that is the practice question in this module.</li>
<li><strong>Reversing</strong> an array or string in place.</li>
<li><strong>Merging</strong> two sorted arrays (one pointer in each).</li>
</ul>

<h2>Common mistakes</h2>
<ul>
<li>Using the converging pattern on <em>unsorted</em> data. For unsorted input, the hash-map complement trick from the hashing module is the right tool.</li>
<li>Writing <code>left &lt;= right</code>, which lets an element pair with itself.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>What does <code>dedupeSorted</code> return for [5, 5, 5]?</summary><p>1 — only the first 5 is kept at the front.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Sliding window: fixed and variable sizes',
          minutes: 15,
          topic: 'Sliding window',
          html: `<p>"Best stretch of k consecutive days", "shortest run of payments reaching a target", "longest substring with no repeated letter" — when a question is about a <strong>contiguous</strong> stretch of an array or string, think of a window sliding over it. Instead of recomputing each stretch from scratch, you update the window as one element enters and another leaves.</p>

<h2>Fixed-size window</h2>
<p>Sales for seven days are [4, 2, 12, 3, 8, 1, 7]. What is the best total over any 3 consecutive days? Summing every window separately costs O(n × k). Sliding costs O(n): add the day entering the window, subtract the day leaving it.</p>
<table>
<thead><tr><th>Window</th><th>Sum</th></tr></thead>
<tbody>
<tr><td>4 2 12</td><td>18</td></tr>
<tr><td>2 12 3</td><td>18 + 3 − 4 = 17</td></tr>
<tr><td>12 3 8</td><td>17 + 8 − 2 = 23 (best)</td></tr>
<tr><td>3 8 1</td><td>23 + 1 − 12 = 12</td></tr>
<tr><td>8 1 7</td><td>12 + 7 − 3 = 16</td></tr>
</tbody>
</table>

<h2>Variable-size window</h2>
<p>Now the window's size is the answer. "Shortest stretch whose sum is at least 7" in [2, 3, 1, 2, 4, 3]: grow the window to the right until it qualifies, then shrink it from the left as long as it still qualifies, recording the size each time.</p>
<pre><code class="language-java">public class Main {
    static int maxSumOfK(int[] a, int k) {
        int window = 0;
        for (int i = 0; i &lt; k; i++) window += a[i];   // the first window
        int best = window;
        for (int i = k; i &lt; a.length; i++) {
            window += a[i] - a[i - k];                 // add the new day, drop the oldest
            best = Math.max(best, window);
        }
        return best;
    }

    // Shortest stretch with sum &gt;= target, or 0 if none. Needs positive numbers.
    static int shortestAtLeast(int[] a, int target) {
        int best = Integer.MAX_VALUE, sum = 0, left = 0;
        for (int right = 0; right &lt; a.length; right++) {
            sum += a[right];                           // grow
            while (sum &gt;= target) {                    // shrink while it still qualifies
                best = Math.min(best, right - left + 1);
                sum -= a[left++];
            }
        }
        return best == Integer.MAX_VALUE ? 0 : best;
    }

    public static void main(String[] args) {
        System.out.println(maxSumOfK(new int[] {4, 2, 12, 3, 8, 1, 7}, 3));        // 23
        System.out.println(shortestAtLeast(new int[] {2, 3, 1, 2, 4, 3}, 7));    // 2
    }
}</code></pre>

<h3>Dry run of the variable window</h3>
<table>
<thead><tr><th>right adds</th><th>Window</th><th>Sum</th><th>What happens</th></tr></thead>
<tbody>
<tr><td>2, 3, 1</td><td>2 3 1</td><td>6</td><td>below 7, keep growing</td></tr>
<tr><td>2</td><td>2 3 1 2</td><td>8</td><td>best = 4; drop 2 → sum 6</td></tr>
<tr><td>4</td><td>3 1 2 4</td><td>10</td><td>best stays 4; drop 3 → 7, best = 3; drop 1 → 6</td></tr>
<tr><td>3</td><td>2 4 3</td><td>9</td><td>best stays 3; drop 2 → 7, best = 2; drop 4 → 3</td></tr>
</tbody>
</table>
<p>The answer is 2: the stretch [4, 3]. Although there is a loop inside a loop, each element enters the window once and leaves at most once, so the total work is <strong>O(n)</strong>.</p>

<h2>The variable-window template</h2>
<pre><code class="language-text">left = 0
for right in 0 .. n-1:
    add a[right] to the window
    while the window breaks the rule (or, for "shortest", still meets it):
        update the answer if needed
        remove a[left] from the window; left++
    update the answer if needed</code></pre>
<p>For "longest substring without a repeated character" — the practice question here — the rule is "no character appears twice". Keep counts (or last-seen positions) of the characters inside the window, shrink from the left when the newest character is a repeat, and record the window length after each step.</p>

<h2>Common mistakes</h2>
<ul>
<li>Using the shrinking window when numbers can be <strong>negative</strong>. Adding an element no longer guarantees a bigger sum, so the logic breaks; use prefix sums with a map (next lesson) instead.</li>
<li>Off-by-one window lengths: a window from <code>left</code> to <code>right</code> inclusive has <code>right - left + 1</code> elements.</li>
<li>Not handling k larger than the array length in the fixed version.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>Best total of 2 consecutive days in [5, 1, 3, 9, 2]?</summary><p>12, from 3 + 9.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Prefix sums: answering range questions instantly',
          minutes: 14,
          topic: 'Prefix sums',
          html: `<p>Your hostel mess records daily spending for a month, and a hundred times a day someone asks "how much did we spend from day l to day r?". Adding up the range each time costs O(n) per question. With a <strong>prefix sum</strong> array, built once in O(n), every question is answered in O(1).</p>

<h2>The idea</h2>
<p>Let <code>prefix[i]</code> be the total of the first i values, with <code>prefix[0] = 0</code>. Then the sum of positions l to r (inclusive) is simply <code>prefix[r + 1] - prefix[l]</code>: everything up to r, minus everything before l.</p>
<table>
<thead><tr><th>i</th><th>0</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th></tr></thead>
<tbody>
<tr><td>spend[i]</td><td>120</td><td>80</td><td>0</td><td>300</td><td>50</td><td>70</td><td></td></tr>
<tr><td>prefix[i]</td><td>0</td><td>120</td><td>200</td><td>200</td><td>500</td><td>550</td><td>620</td></tr>
</tbody>
</table>
<p>Days 1 to 3: <code>prefix[4] - prefix[1]</code> = 500 − 120 = 380, which is 80 + 0 + 300.</p>

<h2>Counting stretches with an exact sum</h2>
<p>Prefix sums combine beautifully with the hash-map complement trick. A stretch from i to j adds up to k exactly when <code>prefix[j + 1] - prefix[i] = k</code>, that is, when an earlier prefix equals <em>current prefix − k</em>. Keep a map from prefix value to how many times it has occurred, and count as you go. Unlike a sliding window, this works with negative numbers.</p>
<pre><code class="language-java">import java.util.HashMap;
import java.util.Map;

public class Main {
    static long[] prefixSums(int[] a) {
        long[] prefix = new long[a.length + 1];        // prefix[i] = a[0] + ... + a[i-1]
        for (int i = 0; i &lt; a.length; i++) prefix[i + 1] = prefix[i] + a[i];
        return prefix;
    }

    static long rangeSum(long[] prefix, int l, int r) { // inclusive, counting from 0
        return prefix[r + 1] - prefix[l];
    }

    // How many stretches of consecutive values add up to exactly k.
    static int countWithSum(int[] a, int k) {
        Map&lt;Long, Integer&gt; seen = new HashMap&lt;&gt;();
        seen.put(0L, 1);                               // the empty prefix
        long running = 0;
        int count = 0;
        for (int x : a) {
            running += x;
            count += seen.getOrDefault(running - k, 0);
            seen.merge(running, 1, Integer::sum);
        }
        return count;
    }

    public static void main(String[] args) {
        int[] spend = {120, 80, 0, 300, 50, 70};
        long[] prefix = prefixSums(spend);
        System.out.println(rangeSum(prefix, 1, 3));   // 380
        System.out.println(rangeSum(prefix, 0, 5));   // 620
        System.out.println(countWithSum(new int[] {1, 2, 3, -2, 2}, 3));  // 4
    }
}</code></pre>

<h3>Dry run of countWithSum for [1, 2, 3, −2, 2], k = 3</h3>
<table>
<thead><tr><th>x</th><th>running</th><th>Look for running − 3</th><th>Found</th><th>count</th></tr></thead>
<tbody>
<tr><td>1</td><td>1</td><td>−2</td><td>0</td><td>0</td></tr>
<tr><td>2</td><td>3</td><td>0</td><td>1 (stretch [1, 2])</td><td>1</td></tr>
<tr><td>3</td><td>6</td><td>3</td><td>1 (stretch [3])</td><td>2</td></tr>
<tr><td>−2</td><td>4</td><td>1</td><td>1 (stretch [2, 3, −2])</td><td>3</td></tr>
<tr><td>2</td><td>6</td><td>3</td><td>1 (stretch [3, −2, 2])</td><td>4</td></tr>
</tbody>
</table>
<p>One pass: <strong>O(n) time, O(n) space</strong>, compared with O(n²) for checking every stretch.</p>

<h2>Relatives worth knowing</h2>
<ul>
<li><strong>2-D prefix sums</strong> answer "total inside this rectangle" on a grid in O(1) after O(rows × columns) setup.</li>
<li><strong>Difference arrays</strong> do the reverse: many "add v to every position from l to r" updates in O(1) each, then one prefix pass to get the final values.</li>
</ul>

<h2>Common mistakes</h2>
<ul>
<li>Making the prefix array the same length as the input. The extra slot for <code>prefix[0] = 0</code> is what keeps the formula free of special cases.</li>
<li>Forgetting <code>seen.put(0L, 1)</code>, which misses stretches that start at index 0.</li>
<li>Using <code>int</code> for prefix values: a lakh values of up to 10⁹ overflow it.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>Using the table above, what did the mess spend on days 3 to 5?</summary><p><code>prefix[6] - prefix[3]</code> = 620 − 200 = 420, which is 300 + 50 + 70.</p></details>`,
        },
        {
          kind: 'article',
          title: 'A game plan for coding rounds',
          minutes: 12,
          topic: 'Interview strategy',
          html: `<p>Knowing the patterns is half the job. The other half is showing your thinking under time pressure while someone watches. Interviewers grade the <em>process</em> — clarifying, reasoning about cost, testing — almost as much as the final code. This plan works for nearly any problem.</p>

<h2>The eight steps</h2>
<ol>
<li><strong>Restate the problem</strong> in your own words and ask about the edges: can the input be empty? Negative? Are there duplicates? How large can n be? What should be returned if there is no answer?</li>
<li><strong>Work two examples by hand</strong>, one ordinary and one awkward (empty, single element, all equal).</li>
<li><strong>Say the brute force</strong> and its cost. It proves you understand the problem and gives you a fallback.</li>
<li><strong>Use the constraints</strong> to set a target: n up to 10⁵ means O(n²) is too slow.</li>
<li><strong>Look for a pattern</strong> (see the table below).</li>
<li><strong>Write clean code</strong> with meaningful names. Talk while you write.</li>
<li><strong>Dry-run</strong> your code on your examples, line by line, before declaring it done.</li>
<li><strong>State time and space</strong>, and mention what you would improve with more time.</li>
</ol>

<h2>Clues and the patterns they suggest</h2>
<table>
<thead><tr><th>If the problem says…</th><th>Try…</th></tr></thead>
<tbody>
<tr><td>sorted array, find a pair or position</td><td>two pointers, binary search</td></tr>
<tr><td>contiguous subarray or substring, longest / shortest</td><td>sliding window</td></tr>
<tr><td>sum of a range, many queries, exact subarray sum</td><td>prefix sums (plus a map)</td></tr>
<tr><td>"seen before", count, group, pair with a sum</td><td>hash map or set</td></tr>
<tr><td>minimum X such that a check passes</td><td>binary search on the answer</td></tr>
<tr><td>all combinations, subsets, arrangements</td><td>backtracking</td></tr>
<tr><td>number of ways, best value built from smaller cases</td><td>dynamic programming</td></tr>
<tr><td>fewest steps in a grid or network</td><td>BFS</td></tr>
<tr><td>matching brackets, most recent unfinished item</td><td>stack</td></tr>
</tbody>
</table>

<h2>A worked example: buy once, sell once</h2>
<p>You track the daily price of a second-hand phone model for a week and may buy on one day and sell on a later day. What is the best profit? Brute force tries every buy day against every later sell day: O(n²). The insight: if you sell today, the best buy day is simply the cheapest day <em>so far</em>. Keep that minimum as you go.</p>
<pre><code class="language-java">public class Main {
    static int bestProfit(int[] prices) {
        int minSoFar = Integer.MAX_VALUE, best = 0;
        for (int p : prices) {
            minSoFar = Math.min(minSoFar, p);      // cheapest day up to today
            best = Math.max(best, p - minSoFar);   // profit if we sell today
        }
        return best;
    }

    public static void main(String[] args) {
        System.out.println(bestProfit(new int[] {7, 1, 5, 3, 6, 4}));  // 5
        System.out.println(bestProfit(new int[] {9, 7, 4, 1}));        // 0: never buy
    }
}</code></pre>
<p>O(n) time, O(1) space. This "best so far, carried along" idea is worth remembering: the practice question on the best run of consecutive numbers uses the same shape. At each position, ask whether the best run <em>ending here</em> should extend the previous run or start fresh.</p>

<h2>Habits that impress</h2>
<ul>
<li>Think aloud. Silence for five minutes tells the interviewer nothing.</li>
<li>Name things well: <code>minSoFar</code> beats <code>m</code>.</li>
<li>Test edge cases out loud: empty input, one element, all equal, all negative, the largest n (overflow).</li>
<li>If you are stuck, solve a smaller version or a special case first — and say so.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>A question asks for the length of the longest stretch of days with attendance above 75%, n up to 10⁵. Which pattern fits first?</summary><p>A sliding window (variable size) over consecutive days: it is about a contiguous stretch and asks for the longest one, and O(n) fits the limit.</p></details>`,
        },
        {
          kind: 'practice',
          question: 'is-it-a-palindrome',
          title: 'Practice: is it a palindrome? (two pointers)',
          topic: 'Practice',
        },
        {
          kind: 'practice',
          question: 'java-longest-unique-substring',
          title: 'Practice: longest stretch without a repeated character (sliding window)',
          topic: 'Practice',
        },
        {
          kind: 'practice',
          question: 'dsa-max-subarray',
          title: 'Practice: best run of consecutive numbers',
          topic: 'Practice',
        },
      ],
    },
  ],
  assignments: ['DSA Interview Drills'],
  tests: [
    {
      title: 'Data Structures and Algorithms — on-demand practice test',
      kind: 'practice',
      description:
        'A short self-check you can take any time: complexity, searching, hashing, stacks and queues, recursion and sorting. Read each option carefully and estimate costs before you answer.',
      durationMinutes: 15,
      sections: [
        {
          title: 'Complexity and searching',
          questions: ['dsa-nested-loop-cost', 'dsa-binary-search-cost', 'dsa-hashmap-cost'],
        },
        {
          title: 'Structures, recursion and sorting',
          questions: ['dsa-stack-queue', 'dsa-recursion-base-case', 'dsa-sorting-stable'],
        },
      ],
    },
    {
      title: 'Data Structures and Algorithms — placement mock test',
      kind: 'mock',
      description:
        'A placement-style technical round: algorithm fundamentals, the Java collections they run on, and one written answer explaining how a HashMap finds a value. Write the explanation as you would say it to an interviewer: buckets, hash codes, equals and the cost.',
      durationMinutes: 40,
      sections: [
        {
          title: 'Algorithms',
          questions: [
            'dsa-nested-loop-cost',
            'dsa-binary-search-cost',
            'dsa-hashmap-cost',
            'dsa-stack-queue',
            'dsa-recursion-base-case',
            'dsa-sorting-stable',
          ],
        },
        {
          title: 'Java collections and strings',
          questions: [
            'java-arraylist-vs-linkedlist',
            'java-hashmap-order',
            'java-equals-hashcode',
            'java-string-immutable',
            'java-string-equals',
          ],
        },
        {
          title: 'Explain it',
          questions: ['java-explain-hashmap'],
        },
      ],
    },
  ],
};
