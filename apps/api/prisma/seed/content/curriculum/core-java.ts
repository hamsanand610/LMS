import type { CurriculumCourse } from './types.js';

export const COURSE: CurriculumCourse = {
  slug: 'core-java',
  title: 'Core Java',
  subject: 'core-java',
  level: 'beginner',
  description:
    'The Java you need for your first developer job, taught on Java 21: how the JVM runs your code, the language itself, classes and inheritance done properly, the collections framework, exceptions, files, lambdas, streams and dates — finishing with threads, memory and the questions interviewers ask most.',
  tags: ['java', 'core-java', 'oop', 'collections', 'streams', 'java-21', 'interviews'],
  modules: [
    {
      title: 'The language',
      summary:
        'How Java code is compiled and run, primitive types and conversions, operators and modern control flow, arrays and varargs, and methods with overloading and static members.',
      lessons: [
        {
          kind: 'article',
          title: 'How Java runs: JDK, JRE, JVM and bytecode',
          minutes: 15,
          html: `<p>Almost every Java interview opens with "explain JDK, JRE and JVM". More importantly, knowing what happens between typing <code>javac</code> and seeing output helps you read errors, understand performance and talk confidently about the platform you will work on every day.</p>
<h2>The journey of a Java program</h2>
<ol>
<li><strong>Write</strong> source code in <code>.java</code> files.</li>
<li><strong>Compile</strong>: <code>javac</code> checks syntax and types and writes one <code>.class</code> file per class — nested classes included, as files like <code>Outer$Inner.class</code>. These hold <strong>bytecode</strong>, a compact instruction set for an imaginary machine.</li>
<li><strong>Load</strong>: when you run <code>java Main</code>, the JVM's class loaders find <code>.class</code> files on the class path (or inside JAR files and modules) and load each class the first time it is used.</li>
<li><strong>Verify</strong>: before running anything, the JVM checks that the bytecode is well formed and type-safe, so a damaged or hostile class file cannot corrupt memory.</li>
<li><strong>Execute</strong>: the interpreter starts running bytecode at once. Meanwhile the just-in-time (JIT) compiler watches for "hot" methods that run often and compiles them into native machine code, which is why long-running Java servers get faster after warming up.</li>
<li><strong>Manage memory</strong>: the garbage collector reclaims objects your program can no longer reach. You never free memory yourself.</li>
</ol>
<h2>Looking at bytecode</h2>
<pre><code class="language-java">public class Fare {
    static int total(int fare, int passengers) {
        return fare * passengers;
    }
}</code></pre>
<p>Compile it and disassemble the class with <code>javap -c Fare</code>, a tool that ships with the JDK. The method becomes four stack-machine instructions — load two <code>int</code> values, multiply, return:</p>
<pre><code class="language-text">  static int total(int, int);
    Code:
       0: iload_0
       1: iload_1
       2: imul
       3: ireturn</code></pre>
<p>You will rarely read bytecode at work, but seeing it once makes "Java compiles to bytecode" concrete.</p>
<h2>JDK, JRE and JVM</h2>
<table>
<thead><tr><th scope="col">Term</th><th scope="col">What it is</th><th scope="col">Who needs it</th></tr></thead>
<tbody>
<tr><td>JVM</td><td>The virtual machine that loads, verifies and executes bytecode, with the JIT compiler and garbage collector</td><td>Every Java program, while running</td></tr>
<tr><td>JRE</td><td>A JVM plus the standard class library (<code>java.lang</code>, <code>java.util</code> and the rest)</td><td>Anyone who only runs Java programs</td></tr>
<tr><td>JDK</td><td>A runtime plus development tools: <code>javac</code>, <code>jshell</code>, <code>jar</code>, <code>javadoc</code>, <code>javap</code>, <code>jlink</code> and more</td><td>Developers — install this</td></tr>
</tbody>
</table>
<p>A modern detail worth knowing: since Java 11, Oracle no longer offers a separate JRE download (some other vendors still do). Applications often ship a trimmed runtime built with <code>jlink</code> instead. The JRE remains a useful idea, and interviewers still ask about it.</p>
<h2>"Platform independent" — precisely</h2>
<p>Bytecode is platform independent: the same <code>.class</code> file runs on Windows, Linux and macOS. The JVM is <em>not</em>: each operating system and processor needs its own JVM build. Saying it this way in an interview shows you understand the design rather than repeating a slogan.</p>
<h2>Versions you will hear about</h2>
<p>Java ships a new release every six months, and every few releases is a long-term support (LTS) release that companies standardise on: 8, 11, 17, 21 and 25. This course uses <strong>Java 21</strong>. Features from recent releases that you will use here:</p>
<ul>
<li><code>var</code> for local variables (Java 10)</li>
<li>switch expressions with arrows (Java 14)</li>
<li>text blocks for multi-line strings (Java 15)</li>
<li>records and pattern matching with <code>instanceof</code> (Java 16)</li>
<li>sealed classes and interfaces (Java 17)</li>
<li>pattern matching in <code>switch</code>, record patterns, virtual threads and sequenced collections (Java 21)</li>
</ul>
<h2>Check yourself</h2>
<ol>
<li>Which JDK tool turns <code>Main.java</code> into <code>Main.class</code>?</li>
<li>Is the JVM platform independent?</li>
<li>Why does a Java web service often respond faster after running for a few minutes?</li>
</ol>
<details><summary>Answers</summary>
<p>1. <code>javac</code>, the compiler.</p>
<p>2. No. The bytecode is; each platform needs its own JVM.</p>
<p>3. The JIT compiler has had time to find the hot methods and compile them to optimised machine code.</p>
</details>`,
          resources: [
            {
              title: 'The javac command (Java SE 21)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/specs/man/javac.html',
            },
            {
              title: 'Java language changes by release (Java SE 21)',
              url: 'https://docs.oracle.com/en/java/javase/21/language/java-language-changes.html',
            },
          ],
        },
        { kind: 'practice', question: 'java-jdk-jre-jvm' },
        {
          kind: 'article',
          title: 'Primitive types, wrapper classes and conversions',
          minutes: 20,
          html: `<p>Java has eight <strong>primitive</strong> types that hold plain values, and a <strong>wrapper class</strong> for each one so the value can travel as an object. Most of the surprises in this lesson — values that wrap around, decimals that are slightly off, <code>==</code> that works for 127 but not 128 — are classic interview questions and real production bugs.</p>
<h2>The eight primitives</h2>
<table>
<thead><tr><th scope="col">Type</th><th scope="col">Size</th><th scope="col">Range or use</th><th scope="col">Wrapper</th></tr></thead>
<tbody>
<tr><td><code>byte</code></td><td>8 bits</td><td>−128 to 127</td><td><code>Byte</code></td></tr>
<tr><td><code>short</code></td><td>16 bits</td><td>−32,768 to 32,767</td><td><code>Short</code></td></tr>
<tr><td><code>int</code></td><td>32 bits</td><td>about ±2.1 billion — the default for whole numbers</td><td><code>Integer</code></td></tr>
<tr><td><code>long</code></td><td>64 bits</td><td>about ±9.2 × 10<sup>18</sup>; literals end in <code>L</code></td><td><code>Long</code></td></tr>
<tr><td><code>float</code></td><td>32 bits</td><td>about 7 significant digits; literals end in <code>f</code></td><td><code>Float</code></td></tr>
<tr><td><code>double</code></td><td>64 bits</td><td>about 15–16 significant digits — the default for decimals</td><td><code>Double</code></td></tr>
<tr><td><code>char</code></td><td>16 bits</td><td>one UTF-16 code unit, 0 to 65,535</td><td><code>Character</code></td></tr>
<tr><td><code>boolean</code></td><td>—</td><td><code>true</code> or <code>false</code></td><td><code>Boolean</code></td></tr>
</tbody>
</table>
<p>Fields get default values (0, <code>false</code>, or <code>null</code> for references); local variables do not, and the compiler insists you assign them before use. Literals can be written in hex (<code>0xFF</code>), binary (<code>0b1010</code>) and with underscores for readability (<code>10_00_000</code>).</p>
<h2>Conversions: widening and narrowing</h2>
<p>Converting to a bigger type (<code>int</code> to <code>long</code>, <code>long</code> to <code>double</code>) is <strong>widening</strong> and happens automatically. Converting to a smaller type is <strong>narrowing</strong>: it needs an explicit cast, and you accept that data may be lost.</p>
<pre><code class="language-java">public class TypeTour {
    public static void main(String[] args) {
        byte level = 127;
        level++;
        System.out.println("byte after 127 + 1: " + level);

        int big = Integer.MAX_VALUE;
        System.out.println("int overflow: " + (big + 1));
        long safe = (long) big + 1;
        System.out.println("as long: " + safe);

        double d = 0.1 + 0.2;
        System.out.println("0.1 + 0.2 = " + d);

        int rupees = (int) 499.99;
        System.out.println("(int) 499.99 = " + rupees);
        System.out.println("Math.round(499.99) = " + Math.round(499.99));

        char grade = 'A';
        grade += 2;
        System.out.println("'A' + 2 as char: " + grade);
        System.out.println("'A' + 2 as int: " + ('A' + 2));

        System.out.println("(byte) 200 = " + (byte) 200);
    }
}</code></pre>
<pre><code class="language-text">byte after 127 + 1: -128
int overflow: -2147483648
as long: 2147483648
0.1 + 0.2 = 0.30000000000000004
(int) 499.99 = 499
Math.round(499.99) = 500
'A' + 2 as char: C
'A' + 2 as int: 67
(byte) 200 = -56</code></pre>
<ul>
<li>Integer types wrap around silently on overflow. Use <code>long</code>, or <code>Math.addExact</code> and <code>Math.multiplyExact</code>, which throw an exception instead of wrapping.</li>
<li>Casting a decimal to an integer type truncates towards zero; it does not round.</li>
<li><code>double</code> stores binary fractions, so 0.1 has no exact representation. Never use <code>double</code> for money in real systems: use <code>BigDecimal</code> (created from strings) or count paise in a <code>long</code>.</li>
<li>In arithmetic, <code>byte</code>, <code>short</code> and <code>char</code> are promoted to <code>int</code>. That is why <code>'A' + 2</code> prints 67.</li>
</ul>
<pre><code class="language-java">byte b = 10;
b = b + 1;   // does not compile: b + 1 is an int</code></pre>
<p>Yet <code>b += 1;</code> compiles, because compound assignment includes a hidden cast back to the variable's type. Interviewers love this one.</p>
<pre><code class="language-java">BigDecimal price = new BigDecimal("0.10");
BigDecimal total = price.add(new BigDecimal("0.20"));
System.out.println(total);   // 0.30, exactly</code></pre>
<h2>Wrapper classes and autoboxing</h2>
<p>Collections and generics work only with objects, so Java converts between primitives and wrappers automatically: <strong>autoboxing</strong> (<code>int</code> to <code>Integer</code>) and <strong>unboxing</strong> (back again). Convenient, but with two traps:</p>
<pre><code class="language-java">public class BoxingTraps {
    public static void main(String[] args) {
        Integer a = 127, b = 127;
        Integer c = 128, d = 128;
        System.out.println(a == b);        // true: small values are cached
        System.out.println(c == d);        // false: two different objects
        System.out.println(c.equals(d));   // true: compares the values

        int marks = Integer.parseInt("87");
        double fee = Double.parseDouble("12500.50");
        System.out.println(marks + 3);
        System.out.println(fee * 2);

        Integer missing = null;
        try {
            int value = missing;           // unboxing null
            System.out.println(value);
        } catch (NullPointerException e) {
            System.out.println("Unboxing null throws NullPointerException");
        }
    }
}</code></pre>
<pre><code class="language-text">true
false
true
90
25001.0
Unboxing null throws NullPointerException</code></pre>
<p><code>Integer.valueOf</code> caches the values from −128 to 127, so boxing 127 twice gives the same object and <code>==</code> happens to work. From 128 upwards you get separate objects. The rule is simple: compare wrapper objects with <code>equals</code>, never <code>==</code>. And a wrapper can be <code>null</code> where a primitive cannot, so unboxing a <code>null</code> — for example a missing value from a map — throws a <code>NullPointerException</code>.</p>
<h2>Check yourself</h2>
<p>What does <code>System.out.println((int) 'a' + 1 + "" + (char) ('a' + 1));</code> print?</p>
<details><summary>Answer</summary><p><code>98b</code>. <code>(int) 'a'</code> is 97, plus 1 is 98; joining with <code>""</code> makes it text; then <code>(char) ('a' + 1)</code> is <code>'b'</code>.</p></details>`,
          resources: [
            {
              title: 'The Java Tutorials: Primitive Data Types (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/java/nutsandbolts/datatypes.html',
            },
            {
              title: 'Integer (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Integer.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Operators and control flow, the modern way',
          minutes: 20,
          html: `<p>You may already know <code>if</code>, loops and the arithmetic operators. This lesson concentrates on the parts of Java's operators and control flow that trip people up in written tests, and on the modern <code>switch</code> that Java 21 gives you — far more powerful than the version in older textbooks.</p>
<h2>Increment puzzles and precedence</h2>
<p><code>x++</code> uses the current value and then adds one; <code>++x</code> adds one first and then uses the new value. Aptitude-style Java tests love to combine them:</p>
<pre><code class="language-java">int x = 5;
int y = x++ + ++x;   // 5 (then x is 6) + 7 (x becomes 7 first)
System.out.println(x + " " + y);   // 7 12</code></pre>
<p>In real code, never write an expression like this; use separate statements. For precedence, remember that unary operators bind tightest, then <code>* / %</code>, then <code>+ -</code>, then comparisons, then <code>&amp;&amp;</code>, then <code>||</code>, then the conditional <code>? :</code>, and assignment last. When in doubt, add brackets.</p>
<h2>Short-circuit and non-short-circuit</h2>
<p><code>&amp;&amp;</code> and <code>||</code> skip the right-hand side when the left already decides the answer. The single-character forms <code>&amp;</code> and <code>|</code> on booleans always evaluate both sides:</p>
<pre><code class="language-java">String name = null;
if (name != null &amp;&amp; name.length() &gt; 3) { }   // safe: length() never runs
if (name != null &amp; name.length() &gt; 3) { }    // NullPointerException</code></pre>
<p>Use the double forms for conditions. The single forms are mainly bitwise operators on integers, along with <code>^</code>, <code>~</code>, <code>&lt;&lt;</code> and <code>&gt;&gt;</code>.</p>
<h2>switch expressions, yield and enums</h2>
<p>Since Java 14, <code>switch</code> can be an <strong>expression</strong> that produces a value. Arrow cases never fall through, several labels can share a case, and a block can hand back its value with <code>yield</code>. Over an enum, the compiler checks that you covered every constant.</p>
<p>Since Java 21, <code>switch</code> can also match on the <strong>type</strong> of a value (pattern matching), add conditions with <code>when</code>, and handle <code>null</code> explicitly:</p>
<pre><code class="language-java">public class FareRules {
    enum Coach { SLEEPER, AC3, AC2 }

    static int paisePerKm(Coach coach, boolean tatkal) {
        return switch (coach) {
            case SLEEPER -&gt; 50;
            case AC3 -&gt; 125;
            case AC2 -&gt; {
                int base = 180;
                yield tatkal ? base + 60 : base;
            }
        };
    }

    static String describe(Object value) {
        return switch (value) {
            case null -&gt; "nothing";
            case Integer i when i &gt; 100 -&gt; "a large number: " + i;
            case Integer i -&gt; "a number: " + i;
            case String s -&gt; "text of length " + s.length();
            default -&gt; "something else: " + value;
        };
    }

    public static void main(String[] args) {
        System.out.println(paisePerKm(Coach.AC3, false));
        System.out.println(paisePerKm(Coach.AC2, true));
        System.out.println(describe(42));
        System.out.println(describe(250));
        System.out.println(describe("Chennai"));
        System.out.println(describe(3.5));
        System.out.println(describe(null));
    }
}</code></pre>
<pre><code class="language-text">125
240
a number: 42
a large number: 250
text of length 7
something else: 3.5
nothing</code></pre>
<p>Order matters in pattern switches: the guarded <code>case Integer i when i &gt; 100</code> must come before the plain <code>case Integer i</code>, or the compiler reports that it can never be reached. Without the <code>case null</code> line, passing <code>null</code> would throw a <code>NullPointerException</code>, as an old-style switch always does.</p>
<h2>Loops: the details that matter</h2>
<ul>
<li>The enhanced for loop (<code>for (String s : list)</code>) reads every element, but assigning to <code>s</code> does not change the collection.</li>
<li><code>break</code> and <code>continue</code> affect the innermost loop. To leave an outer loop, label it:</li>
</ul>
<pre><code class="language-java">int[][] grid = {{1, 2}, {3, -1}, {5, 6}};
search:
for (int[] row : grid) {
    for (int value : row) {
        if (value &lt; 0) {
            System.out.println("Found a negative value");
            break search;   // leaves both loops
        }
    }
}</code></pre>
<h2>Common mistakes</h2>
<ul>
<li>Writing an old-style <code>case</code> without <code>break</code> and getting fall-through.</li>
<li>Comparing strings in conditions with <code>==</code> instead of <code>equals</code>.</li>
<li>Comparing a <code>double</code> with <code>==</code> after arithmetic. Check that the difference is tiny instead: <code>Math.abs(a - b) &lt; 1e-9</code>.</li>
</ul>
<h2>Check yourself</h2>
<p>What does <code>int i = 10; i = i++ + i--;</code> leave in <code>i</code>?</p>
<details><summary>Answer</summary><p>21. <code>i++</code> gives 10 and makes <code>i</code> 11; <code>i--</code> gives 11 and makes <code>i</code> 10; then the assignment stores 10 + 11 = 21, overwriting both side effects.</p></details>`,
          resources: [
            {
              title: 'Switch expressions and statements (Java SE 21)',
              url: 'https://docs.oracle.com/en/java/javase/21/language/switch-expressions-and-statements.html',
            },
            {
              title: 'Controlling the flow of your program (dev.java)',
              url: 'https://dev.java/learn/language-basics/controlling-flow/',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Arrays, varargs and command-line arguments',
          minutes: 18,
          html: `<p>Arrays are Java's most basic container: fixed in size, fast to index, and the foundation that <code>ArrayList</code> and many other classes are built on. This lesson covers how Java arrays really work, the <code>Arrays</code> utility class, methods that take any number of arguments, and the <code>args</code> parameter of <code>main</code>.</p>
<h2>Arrays are objects</h2>
<p>An array variable holds a <em>reference</em> to an array object on the heap. That has consequences: assigning one array variable to another shares the array, <code>==</code> compares references, and a method that receives an array can change its contents. A two-dimensional array is really an array of arrays, so its rows may have different lengths — a <strong>jagged</strong> array.</p>
<pre><code class="language-java">import java.util.Arrays;

public class SeatingPlan {
    static int total(int... amounts) {
        int sum = 0;
        for (int a : amounts) {
            sum += a;
        }
        return sum;
    }

    public static void main(String[] args) {
        int[][] seats = new int[3][];        // rows of different lengths
        seats[0] = new int[4];
        seats[1] = new int[2];
        seats[2] = new int[3];
        seats[1][1] = 1;                     // book row 1, seat 1
        System.out.println(Arrays.deepToString(seats));

        int[] fees = new int[5];
        Arrays.fill(fees, 1500);
        fees[4] = 0;                         // a scholarship
        System.out.println(Arrays.toString(fees));

        int[] lastThree = Arrays.copyOfRange(fees, 2, 5);
        System.out.println(Arrays.toString(lastThree));

        System.out.println(total());
        System.out.println(total(250, 400));
        System.out.println(total(fees));

        System.out.println("Arguments received: " + args.length);
    }
}</code></pre>
<pre><code class="language-text">[[0, 0, 0, 0], [0, 1], [0, 0, 0]]
[1500, 1500, 1500, 1500, 0]
[1500, 1500, 0]
0
650
6000
Arguments received: 0</code></pre>
<h2>The Arrays utility class</h2>
<ul>
<li><code>toString</code> and <code>deepToString</code> (for nested arrays) for printing.</li>
<li><code>sort</code>, and <code>binarySearch</code> on a sorted array.</li>
<li><code>fill</code>, <code>copyOf</code> and <code>copyOfRange</code> (the end index is exclusive).</li>
<li><code>equals</code> and <code>deepEquals</code> to compare contents rather than references.</li>
<li><code>asList</code>, which wraps an array in a fixed-size list. The list is a <em>view</em>: <code>set</code> writes through to the array, while <code>add</code> and <code>remove</code> throw <code>UnsupportedOperationException</code>.</li>
</ul>
<pre><code class="language-java">String[] cities = {"Pune", "Delhi"};
List&lt;String&gt; view = Arrays.asList(cities);
view.set(0, "Goa");               // allowed, and changes the array too
System.out.println(cities[0]);    // Goa</code></pre>
<h2>Varargs: any number of arguments</h2>
<p><code>int... amounts</code> lets callers pass zero or more <code>int</code> values, or an existing <code>int[]</code>. Inside the method it is simply an array. A method can have only one varargs parameter, and it must be the last. <code>String.format</code> and <code>List.of</code> use this feature.</p>
<h2>Command-line arguments</h2>
<p>The <code>String[] args</code> in <code>main</code> holds the words typed after the class name. Running <code>java SeatingPlan Chennai 2026</code> gives <code>args[0]</code> = <code>"Chennai"</code> and <code>args[1]</code> = <code>"2026"</code> — always strings, so convert with <code>Integer.parseInt(args[1])</code>. With no arguments, <code>args</code> is an empty array, not <code>null</code>; check <code>args.length</code> before reading an element.</p>
<h2>Common mistakes</h2>
<ul>
<li>Printing an array with <code>println</code> and getting something like <code>[I@6d06d69c</code>: the type code and a hash, not the contents.</li>
<li>Comparing arrays with <code>==</code> or with the array's own <code>equals</code>, which also compares references. Use <code>Arrays.equals</code>.</li>
<li>Assuming <code>Arrays.asList(intArray)</code> gives a list of numbers. With an <code>int[]</code> you get a list holding one element — the array itself. Use <code>Integer[]</code>, or streams, instead.</li>
</ul>
<h2>Check yourself</h2>
<p>After <code>int[][] grid = new int[2][3];</code>, what are <code>grid.length</code> and <code>grid[0].length</code>?</p>
<details><summary>Answer</summary><p>2 and 3. The outer array has 2 rows, and each row is an <code>int[3]</code>.</p></details>`,
          resources: [
            {
              title: 'Arrays (dev.java)',
              url: 'https://dev.java/learn/language-basics/arrays/',
            },
            {
              title: 'Arrays (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Arrays.html',
            },
          ],
        },
        { kind: 'practice', question: 'java-matrix-transpose' },
        {
          kind: 'article',
          title: 'Methods, overloading and static members',
          minutes: 20,
          html: `<p>Methods are where your logic lives. This lesson sharpens three ideas that interviews probe constantly: how Java chooses between overloaded methods, what "Java is pass-by-value" really means for objects, and the difference between <code>static</code> and instance members.</p>
<h2>Overloading and how Java picks a method</h2>
<p>Overloaded methods share a name but differ in their parameter lists. The compiler picks one at compile time, trying in order: an exact match, then a match by widening (for example <code>byte</code> to <code>int</code>), then by boxing (<code>int</code> to <code>Integer</code>), and only then varargs.</p>
<pre><code class="language-java">public class Overloads {
    static void show(int x)     { System.out.println("int " + x); }
    static void show(long x)    { System.out.println("long " + x); }
    static void show(Integer x) { System.out.println("Integer " + x); }
    static void show(int... xs) { System.out.println("varargs " + xs.length); }

    public static void main(String[] args) {
        byte b = 5;
        show(7);                    // exact match
        show(b);                    // byte widens to int
        show(7L);                   // exact match for long
        show(Integer.valueOf(7));   // exact match for Integer
        show();                     // only varargs fits
        show(1, 2, 3);
    }
}</code></pre>
<pre><code class="language-text">int 7
int 5
long 7
Integer 7
varargs 0
varargs 3</code></pre>
<p>Two methods that differ <em>only</em> in their return type are not a valid overload; the compiler rejects them, because a call would not say which one you mean.</p>
<h2>Pass-by-value, even for objects</h2>
<p>Java always copies the argument into the parameter. For an object or array, what gets copied is the <strong>reference</strong>. So a method can change the object the reference points to, but reassigning the parameter has no effect outside:</p>
<pre><code class="language-java">public class ReferenceDemo {
    static void addGrace(int[] marks) {
        marks[0] += 5;               // changes the caller's array
    }

    static void replace(int[] marks) {
        marks = new int[] {100};     // changes only the local copy of the reference
    }

    public static void main(String[] args) {
        int[] marks = {35, 60};
        addGrace(marks);
        replace(marks);
        System.out.println(marks[0] + " " + marks[1]);
    }
}</code></pre>
<pre><code class="language-text">40 60</code></pre>
<p>A precise interview answer: "Java is strictly pass-by-value. For objects, the value passed is a copy of the reference, so both the caller and the method point to the same object."</p>
<h2>static versus instance</h2>
<p>An <strong>instance</strong> field belongs to each object; a <strong>static</strong> field belongs to the class and is shared by every object. Likewise, an instance method works on a particular object (it has <code>this</code>), while a static method belongs to the class and has no <code>this</code>.</p>
<pre><code class="language-java">public class Token {
    private static int issued = 0;   // one copy for the whole class
    private final int number;        // one copy per token

    Token() {
        issued++;
        number = issued;
    }

    static int issuedSoFar() {
        return issued;
    }

    public static void main(String[] args) {
        Token a = new Token();
        Token b = new Token();
        Token c = new Token();
        System.out.println(a.number + ", " + c.number + ", issued " + Token.issuedSoFar());
    }
}</code></pre>
<pre><code class="language-text">1, 3, issued 3</code></pre>
<p>Typical uses of <code>static</code>: constants (<code>static final double GST_RATE = 0.18;</code>), counters shared by all objects, and utility methods that need no object state, such as <code>Math.max</code> or <code>Integer.parseInt</code>. That is also why <code>main</code> is static: the JVM can call it before any object exists.</p>
<h2>Common mistakes</h2>
<ul>
<li>"non-static variable cannot be referenced from a static context": using an instance field or method from <code>main</code> without an object. Create an object, or make the member static if it truly belongs to the class.</li>
<li>Making everything static to silence that error. It turns objects into global variables and makes code hard to test.</li>
<li>Expecting a method to swap two <code>int</code> arguments for the caller. It cannot; it only swaps its copies.</li>
</ul>
<h2>Check yourself</h2>
<p>Given only <code>static void pay(long amount)</code> and <code>static void pay(Integer amount)</code>, which one does <code>pay(500)</code> call?</p>
<details><summary>Answer</summary><p><code>pay(long)</code>. Widening <code>int</code> to <code>long</code> is preferred over boxing <code>int</code> to <code>Integer</code>.</p></details>`,
          resources: [
            {
              title: 'Defining methods (dev.java)',
              url: 'https://dev.java/learn/classes-objects/defining-methods/',
            },
            {
              title: 'The Java Tutorials: Class Members (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/java/javaOO/classvars.html',
            },
          ],
        },
        { kind: 'lab', lab: 'debug-java-average' },
      ],
    },
    {
      title: 'Types and inheritance',
      summary:
        'Model real things with classes and objects, protect data with encapsulation, extend behaviour with inheritance, interfaces and polymorphism, and handle text, records and enums well.',
      lessons: [
        {
          kind: 'article',
          title: 'Classes and objects: modelling a train ticket',
          minutes: 20,
          html: `<p>Java is an object-oriented language: you model a problem as objects that hold data and offer behaviour. A railway system has tickets, passengers and trains; a fee system has students and payments. In this lesson you design one class from scratch and see what happens in memory when you create objects from it.</p>
<h2>A class is a blueprint, an object is a thing</h2>
<p>A <strong>class</strong> describes what every ticket has (its <strong>fields</strong>, or state) and what it can do (its <strong>methods</strong>, or behaviour). An <strong>object</strong> is one actual ticket made from that blueprint with <code>new</code>. One class, as many objects as you like.</p>
<pre><code class="language-java">public class Ticket {
    private final String pnr;
    private final String passenger;
    private final int fare;
    private boolean cancelled;

    public Ticket(String pnr, String passenger, int fare) {
        this.pnr = pnr;
        this.passenger = passenger;
        this.fare = fare;
    }

    public Ticket(String pnr, String passenger) {
        this(pnr, passenger, 0);        // a free pass: reuse the other constructor
    }

    public int cancel() {
        if (cancelled) {
            return 0;                   // already refunded
        }
        cancelled = true;
        return fare * 75 / 100;         // 75% refund
    }

    @Override
    public String toString() {
        return pnr + " " + passenger + " Rs." + fare + (cancelled ? " (cancelled)" : "");
    }

    public static void main(String[] args) {
        Ticket t1 = new Ticket("4521837690", "Lakshmi", 1240);
        Ticket t2 = new Ticket("4521837691", "Imran");
        Ticket t3 = t1;                 // a second reference to the same object
        System.out.println(t1);
        System.out.println(t2);
        System.out.println("Refund: " + t3.cancel());
        System.out.println("Refund again: " + t1.cancel());
        System.out.println(t1);
    }
}</code></pre>
<pre><code class="language-text">4521837690 Lakshmi Rs.1240
4521837691 Imran Rs.0
Refund: 930
Refund again: 0
4521837690 Lakshmi Rs.1240 (cancelled)</code></pre>
<h2>Constructors and this</h2>
<ul>
<li>A <strong>constructor</strong> has the class's name and no return type. It runs once, when <code>new</code> creates the object, and its job is to leave the object in a valid state.</li>
<li>If you write no constructor, Java supplies an empty no-argument one. As soon as you write any constructor, that default disappears.</li>
<li><code>this.pnr = pnr</code> separates the field (<code>this.pnr</code>) from the parameter with the same name.</li>
<li><code>this(pnr, passenger, 0)</code> calls another constructor of the same class, so the setup logic lives in one place. It must be the first statement.</li>
</ul>
<h2>Variables hold references</h2>
<p><code>new</code> creates the object on the <strong>heap</strong> and returns a reference to it. <code>t1</code> and <code>t3</code> hold the same reference, so cancelling through <code>t3</code> cancels "Lakshmi's" ticket, and the second refund is 0. A reference variable can also hold <code>null</code>, meaning "no object"; calling a method on it throws a <code>NullPointerException</code>, the most common exception in Java.</p>
<p>When no variable refers to an object any more, it becomes eligible for garbage collection. You never delete objects yourself.</p>
<h2>toString and @Override</h2>
<p>Every class inherits a <code>toString()</code> method from <code>Object</code>; by default it prints the class name and a hash code, such as <code>Ticket@1b6d3586</code>. Overriding it gives readable output in logs and in <code>println</code>. The <code>@Override</code> annotation asks the compiler to confirm you really are overriding — a typo such as <code>tostring</code> then becomes a compile error instead of a silent bug.</p>
<h2>Designing a class well</h2>
<ul>
<li>Name classes as nouns (<code>Ticket</code>, <code>FeeAccount</code>) and methods as verbs (<code>cancel</code>, <code>pay</code>).</li>
<li>Keep fields <code>private</code>, and make them <code>final</code> when they should never change after construction — as with the PNR here.</li>
<li>Put behaviour next to the data it uses: the refund rule lives in <code>Ticket</code>, not in some distant utility class.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Writing <code>void Ticket(...)</code>: with a return type it is an ordinary method, not a constructor.</li>
<li>Forgetting <code>this.</code> in <code>pnr = pnr;</code>, which assigns the parameter to itself and leaves the field empty.</li>
<li>Assuming <code>Ticket t3 = t1;</code> copies the ticket. It copies only the reference.</li>
</ul>
<h2>Check yourself</h2>
<p>If you delete both constructors from <code>Ticket</code>, does <code>new Ticket()</code> compile?</p>
<details><summary>Answer</summary><p>No — but only because of the <code>final</code> fields, which must be assigned in every constructor. Without them, Java's default no-argument constructor would make <code>new Ticket()</code> compile.</p></details>`,
          resources: [
            {
              title: 'The Java Tutorials: Classes and Objects (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/java/javaOO/index.html',
            },
            {
              title: 'Classes and objects (dev.java)',
              url: 'https://dev.java/learn/classes-objects/',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Encapsulation, access modifiers and packages',
          minutes: 18,
          html: `<p>Imagine a fee system where any part of the code can write <code>account.paid = -5000</code>. Sooner or later something will. <strong>Encapsulation</strong> means an object guards its own data: fields are private, and the only way to change them is through methods that enforce the rules. It is the first of the object-oriented principles interviewers ask about, and the one with the most practical value.</p>
<h2>An object that protects itself</h2>
<pre><code class="language-java">public class FeeAccount {
    private final String studentId;
    private final long totalFeePaise;
    private long paidPaise;

    public FeeAccount(String studentId, long totalFeePaise) {
        if (totalFeePaise &lt;= 0) {
            throw new IllegalArgumentException("Total fee must be positive");
        }
        this.studentId = studentId;
        this.totalFeePaise = totalFeePaise;
    }

    public void pay(long amountPaise) {
        if (amountPaise &lt;= 0) {
            throw new IllegalArgumentException("Payment must be positive");
        }
        if (paidPaise + amountPaise &gt; totalFeePaise) {
            throw new IllegalArgumentException("Payment exceeds the balance due");
        }
        paidPaise += amountPaise;
    }

    public long balancePaise() {
        return totalFeePaise - paidPaise;
    }

    public String studentId() {
        return studentId;
    }

    public static void main(String[] args) {
        FeeAccount account = new FeeAccount("SIA-2026-041", 45_000_00L);
        account.pay(20_000_00L);
        System.out.println("Balance: " + account.balancePaise() / 100);
        try {
            account.pay(30_000_00L);
        } catch (IllegalArgumentException e) {
            System.out.println("Refused: " + e.getMessage());
        }
        System.out.println("Balance: " + account.balancePaise() / 100);
    }
}</code></pre>
<pre><code class="language-text">Balance: 25000
Refused: Payment exceeds the balance due
Balance: 25000</code></pre>
<p>No caller can make the balance negative or skip validation, because there is no other way in. If the rule changes — say, part payments must be at least ₹1,000 — you change one method, and every caller gets the new rule.</p>
<h2>Getters and setters are not automatic</h2>
<p>Many tutorials generate a getter and a setter for every field. That is not encapsulation; it is a public field with extra typing. Expose what callers genuinely need (<code>balancePaise()</code>), offer meaningful operations (<code>pay</code>) instead of setters, and leave out the rest. Fields that never change should be <code>final</code>. A class whose fields are all <code>final</code> and that offers no way to change them is <strong>immutable</strong> — like <code>String</code> — and immutable objects are simple to reason about and safe to share.</p>
<h2>The four access levels</h2>
<table>
<thead><tr><th scope="col">Modifier</th><th scope="col">Same class</th><th scope="col">Same package</th><th scope="col">Subclass in another package</th><th scope="col">Everywhere</th></tr></thead>
<tbody>
<tr><td><code>private</code></td><td>yes</td><td>no</td><td>no</td><td>no</td></tr>
<tr><td>(none) — package-private</td><td>yes</td><td>yes</td><td>no</td><td>no</td></tr>
<tr><td><code>protected</code></td><td>yes</td><td>yes</td><td>yes</td><td>no</td></tr>
<tr><td><code>public</code></td><td>yes</td><td>yes</td><td>yes</td><td>yes</td></tr>
</tbody>
</table>
<p>A useful default: fields <code>private</code>, methods as restricted as possible, and <code>public</code> only for what other packages must call. A top-level class can only be <code>public</code> or package-private.</p>
<h2>Packages</h2>
<p>A <strong>package</strong> groups related classes and gives them a namespace, written as reversed domain names: <code>package com.siacademy.fees;</code> as the first line of the file, with the file stored in the folder <code>com/siacademy/fees/</code>. Other packages use the class through an <code>import</code> statement or its full name, <code>com.siacademy.fees.FeeAccount</code>. Classes in <code>java.lang</code> — <code>String</code>, <code>Math</code>, <code>Integer</code> — are imported automatically. Packages let two teams each have a class called <code>Account</code> without conflict, and package-private access lets classes in one package cooperate without exposing their internals.</p>
<h2>Common mistakes</h2>
<ul>
<li>Public fields "to save time". They make every later rule change a hunt across the whole codebase.</li>
<li>Returning a mutable internal list from a getter, which lets callers change your object behind your back. Return <code>List.copyOf(items)</code> or an unmodifiable view.</li>
<li>Validating in the caller instead of in the class, so the next caller forgets.</li>
</ul>
<h2>Check yourself</h2>
<p>A method is <code>protected</code> in class <code>A</code> of package <code>p</code>. Can an unrelated class in package <code>p</code> call it?</p>
<details><summary>Answer</summary><p>Yes. <code>protected</code> includes package access, plus access from subclasses in other packages.</p></details>`,
          resources: [
            {
              title: 'The Java Tutorials: Controlling Access (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/java/javaOO/accesscontrol.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Inheritance, overriding and polymorphism',
          minutes: 22,
          html: `<p>A shop accepts card payments, UPI and cash on delivery. All three are payments with an amount and a fee, but each calculates its fee differently. <strong>Inheritance</strong> lets you write the shared parts once, and <strong>polymorphism</strong> lets the rest of the code treat every payment the same way while each one behaves correctly.</p>
<h2>One parent, three children</h2>
<p>In a project each class would live in its own file. Here they are nested inside one class so the whole example fits in a single file you can run:</p>
<pre><code class="language-java">public class Payments {
    static class Payment {
        protected final long amount;        // in rupees

        Payment(long amount) {
            this.amount = amount;
        }

        long fee() {
            return 0;
        }

        String describe() {
            return getClass().getSimpleName() + " of Rs." + amount + ", fee Rs." + fee();
        }
    }

    static class CardPayment extends Payment {
        CardPayment(long amount) {
            super(amount);                  // the parent's constructor runs first
        }

        @Override
        long fee() {
            return amount * 2 / 100;        // 2% card charge
        }
    }

    static class UpiPayment extends Payment {
        UpiPayment(long amount) {
            super(amount);
        }
        // inherits fee() unchanged: no charge
    }

    static class CashOnDelivery extends Payment {
        CashOnDelivery(long amount) {
            super(amount);
        }

        @Override
        long fee() {
            return super.fee() + 40;        // a flat handling charge
        }
    }

    public static void main(String[] args) {
        Payment[] payments = {
            new CardPayment(2500), new UpiPayment(2500), new CashOnDelivery(2500)
        };
        long fees = 0;
        for (Payment p : payments) {
            System.out.println(p.describe());
            fees += p.fee();
        }
        System.out.println("Total fees: Rs." + fees);

        Payment first = payments[0];
        if (first instanceof CardPayment card) {
            System.out.println("Card fee via pattern variable: " + card.fee());
        }
    }
}</code></pre>
<pre><code class="language-text">CardPayment of Rs.2500, fee Rs.50
UpiPayment of Rs.2500, fee Rs.0
CashOnDelivery of Rs.2500, fee Rs.40
Total fees: Rs.90
Card fee via pattern variable: 50</code></pre>
<h2>What inheritance gives you</h2>
<ul>
<li><code>extends</code> makes <code>CardPayment</code> a <code>Payment</code>: it gets the <code>amount</code> field and the <code>fee</code> and <code>describe</code> methods.</li>
<li>Constructors are not inherited. Each subclass constructor must call a parent constructor with <code>super(...)</code> as its first statement; if you leave it out, Java inserts <code>super()</code> and fails to compile when the parent has no such constructor.</li>
<li><code>super.fee()</code> calls the parent's version from inside an override.</li>
<li>Java allows only one parent class. Every class ultimately extends <code>Object</code>.</li>
</ul>
<h2>Polymorphism: decided at run time</h2>
<p>The loop variable <code>p</code> has the <em>declared</em> type <code>Payment</code>, yet <code>p.fee()</code> runs the version of the actual object — card, UPI or cash. The JVM picks the method at run time from the object's real class. This is <strong>dynamic dispatch</strong>, and it is why <code>describe()</code>, written once in the parent, prints the right fee for every child. Add a <code>WalletPayment</code> next year and the loop needs no change.</p>
<p>To use something that exists only in a subclass, check the type first. Since Java 16, <code>instanceof</code> can declare a variable of the narrower type in the same step, as with <code>card</code> above, so you never need a separate cast.</p>
<h2>The rules of overriding</h2>
<ul>
<li>Same name and same parameter types. Different parameters create an <em>overload</em> instead — <code>@Override</code> catches that mistake.</li>
<li>The return type must be the same or a subtype.</li>
<li>Access cannot be narrower: a <code>public</code> method cannot become <code>protected</code>.</li>
<li><code>private</code>, <code>static</code> and <code>final</code> methods are not overridden. A static method with the same signature in a subclass merely <em>hides</em> the parent's.</li>
<li>Fields are never polymorphic: they are chosen by the declared type. Keep fields private and use methods.</li>
<li>A <code>final</code> class, like <code>String</code>, cannot be extended at all.</li>
</ul>
<h2>Inheritance or composition?</h2>
<p>Use inheritance only for a true "is-a" relationship: a card payment <em>is a</em> payment. For "has-a" — an order <em>has a</em> payment and a delivery address — put an object in a field instead. Composition is more flexible, because you can swap the parts without being locked into a class hierarchy.</p>
<h2>Check yourself</h2>
<p>If <code>Payment</code> declared <code>static String kind() { return "payment"; }</code> and <code>CardPayment</code> declared the same method returning <code>"card"</code>, what would <code>Payment p = new CardPayment(100); p.kind()</code> return?</p>
<details><summary>Answer</summary><p><code>"payment"</code>. Static methods are chosen by the declared type at compile time; they are hidden, not overridden.</p></details>`,
          resources: [
            {
              title: 'The Java Tutorials: Interfaces and Inheritance (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/java/IandI/index.html',
            },
            { title: 'Inheritance (dev.java)', url: 'https://dev.java/learn/inheritance/' },
          ],
        },
        { kind: 'practice', question: 'java-final-class' },
        {
          kind: 'article',
          title: 'Abstract classes and interfaces',
          minutes: 22,
          html: `<p>Sometimes a parent class should never be used on its own: there is no such thing as a plain "invoice", only GST invoices, export invoices and so on. And sometimes unrelated classes need to promise the same ability, such as "can be applied to a bill". Java gives you <strong>abstract classes</strong> for the first case and <strong>interfaces</strong> for the second.</p>
<h2>Both in one example</h2>
<pre><code class="language-java">import java.util.List;

public class Discounts {
    interface Discount {
        long apply(long amount);              // abstract: every discount must say how

        default String label() {              // default: shared behaviour, may be overridden
            return "discount";
        }

        static long atLeastZero(long value) { // static helper that belongs to the interface
            return Math.max(0, value);
        }
    }

    static class FlatDiscount implements Discount {
        private final long off;

        FlatDiscount(long off) {
            this.off = off;
        }

        @Override
        public long apply(long amount) {
            return Discount.atLeastZero(amount - off);
        }

        @Override
        public String label() {
            return "Rs." + off + " off";
        }
    }

    static class PercentDiscount implements Discount {
        private final int percent;

        PercentDiscount(int percent) {
            this.percent = percent;
        }

        @Override
        public long apply(long amount) {
            return amount - amount * percent / 100;
        }
    }

    abstract static class Invoice {
        private final long amount;

        Invoice(long amount) {
            this.amount = amount;
        }

        abstract String header();             // each kind of invoice decides

        final String print(Discount d) {     // fixed steps that call the abstract one
            return header() + ": " + amount + " -&gt; " + d.apply(amount) + " (" + d.label() + ")";
        }
    }

    static class GstInvoice extends Invoice {
        GstInvoice(long amount) {
            super(amount);
        }

        @Override
        String header() {
            return "GST invoice";
        }
    }

    public static void main(String[] args) {
        Invoice invoice = new GstInvoice(1200);
        List&lt;Discount&gt; offers = List.of(new FlatDiscount(150), new PercentDiscount(10), new FlatDiscount(5000));
        for (Discount d : offers) {
            System.out.println(invoice.print(d));
        }
    }
}</code></pre>
<pre><code class="language-text">GST invoice: 1200 -&gt; 1050 (Rs.150 off)
GST invoice: 1200 -&gt; 1080 (discount)
GST invoice: 1200 -&gt; 0 (Rs.5000 off)</code></pre>
<h2>Abstract classes</h2>
<ul>
<li>Declared <code>abstract</code>; you cannot create one with <code>new</code>.</li>
<li>May have <code>abstract</code> methods (no body) that every concrete subclass must implement, alongside ordinary methods, fields and constructors.</li>
<li><code>Invoice.print</code> is a <strong>template method</strong>: the fixed steps live in the parent, which calls an abstract step (<code>header</code>) that each child fills in. Marking it <code>final</code> stops children from changing the steps.</li>
</ul>
<h2>Interfaces</h2>
<ul>
<li>An interface is a contract: "anything that implements me can do these things". Its abstract methods are implicitly <code>public</code>, which is why the implementations above must be <code>public</code>.</li>
<li>Since Java 8 it can contain <code>default</code> methods (with a body, inherited by implementers) and <code>static</code> methods; since Java 9, <code>private</code> helper methods too. Any field is implicitly <code>public static final</code> — a constant.</li>
<li>A class extends one class but may implement many interfaces: <code>class Ticket implements Comparable&lt;Ticket&gt;, Serializable</code>.</li>
<li>If two interfaces give a class the same default method, the class must override it, and may call one of them explicitly with <code>InterfaceName.super.label()</code>.</li>
</ul>
<h2>Which one should you choose?</h2>
<table>
<thead><tr><th scope="col"></th><th scope="col">Abstract class</th><th scope="col">Interface</th></tr></thead>
<tbody>
<tr><td>A class can have</td><td>one parent class</td><td>many interfaces</td></tr>
<tr><td>Instance fields (state)</td><td>yes</td><td>no — constants only</td></tr>
<tr><td>Constructors</td><td>yes</td><td>no</td></tr>
<tr><td>Best for</td><td>a family of closely related classes sharing state and code</td><td>a capability that unrelated classes can offer</td></tr>
</tbody>
</table>
<p>Start with an interface. Add an abstract class when several implementations share real state or code. Many well-designed libraries offer both: an interface such as <code>List</code> and an abstract helper such as <code>AbstractList</code>.</p>
<h2>Sealed types and functional interfaces</h2>
<p>Since Java 17 you can write <code>sealed interface Discount permits FlatDiscount, PercentDiscount</code> to fix the list of implementations, which lets a <code>switch</code> over them be checked for completeness. And an interface with exactly one abstract method, like <code>Discount</code>, is a <strong>functional interface</strong>: you will soon implement such interfaces in one line with a lambda.</p>
<h2>Common mistakes</h2>
<ul>
<li>Implementing an interface method without <code>public</code>: "attempting to assign weaker access privileges".</li>
<li>Trying to instantiate an abstract class or an interface with <code>new</code>.</li>
<li>Forgetting that a concrete class must implement <em>every</em> abstract method it inherits, or be declared abstract itself.</li>
</ul>
<h2>Check yourself</h2>
<p>Can an abstract class have a constructor, given that you cannot instantiate it?</p>
<details><summary>Answer</summary><p>Yes. It runs when a subclass is created, through the subclass constructor's <code>super(...)</code> call, and initialises the shared fields — as <code>Invoice</code> does.</p></details>`,
          resources: [
            { title: 'Interfaces (dev.java)', url: 'https://dev.java/learn/interfaces/' },
            {
              title: 'Sealed classes and interfaces (Java SE 21)',
              url: 'https://docs.oracle.com/en/java/javase/21/language/sealed-classes-and-interfaces.html',
            },
          ],
        },
        { kind: 'practice', question: 'java-interface-default' },
        {
          kind: 'article',
          title: 'Strings in depth: immutability, the pool and StringBuilder',
          minutes: 20,
          html: `<p>Strings are the most used class in Java and the subject of more interview questions than almost any other: why are they immutable, what is the string pool, when should you use <code>StringBuilder</code>, and how does it differ from <code>StringBuffer</code>? This lesson answers all of them with code you can run.</p>
<h2>The pool, equality and immutability</h2>
<pre><code class="language-java">public class StringDeepDive {
    public static void main(String[] args) {
        String a = "SI Academy";
        String b = "SI Academy";
        String c = new String("SI Academy");
        System.out.println(a == b);              // the same pooled literal
        System.out.println(a == c);              // new String always makes a new object
        System.out.println(a.equals(c));
        System.out.println(a == c.intern());     // intern() returns the pooled copy

        String s = "java";
        String upper = s.toUpperCase();
        System.out.println(s + " " + upper);     // s itself never changes

        System.out.println("  ".isBlank() + " " + "ab".repeat(3) + " " + String.join("-", "2026", "10", "09"));
        System.out.println("Asha".compareTo("Arjun") &gt; 0);
        System.out.println("Total: %d marks".formatted(437));

        StringBuilder sb = new StringBuilder();
        for (int i = 1; i &lt;= 5; i++) {
            sb.append(i);
            if (i &lt; 5) {
                sb.append(',');
            }
        }
        sb.insert(0, '[').append(']');
        System.out.println(sb + " length " + sb.length());
        System.out.println(sb.reverse());

        String report = """
            Name:  Asha
            Marks: 91
            """;
        System.out.print(report);
    }
}</code></pre>
<pre><code class="language-text">true
false
true
true
java JAVA
true ababab 2026-10-09
true
Total: 437 marks
[1,2,3,4,5] length 11
]5,4,3,2,1[
Name:  Asha
Marks: 91</code></pre>
<ul>
<li>String <strong>literals</strong> are stored once in the <strong>string pool</strong>, so <code>a</code> and <code>b</code> refer to the same object. <code>new String(...)</code> deliberately creates another object.</li>
<li><code>==</code> compares references; <code>equals</code> compares characters. Always use <code>equals</code> (or <code>equalsIgnoreCase</code>) for content.</li>
<li><code>compareTo</code> compares alphabetically, character by character, and returns a negative, zero or positive number. "Asha" comes after "Arjun" because 's' comes after 'r'.</li>
<li>A <strong>text block</strong> (Java 15) between <code>"""</code> markers keeps line breaks and strips the common indentation, which is perfect for SQL, JSON or report templates.</li>
</ul>
<h2>Why are strings immutable?</h2>
<ul>
<li><strong>Sharing is safe</strong>: the pool can hand the same object to every part of the program, because nobody can change it.</li>
<li><strong>Security</strong>: a file path, URL or class name checked for permission cannot be altered afterwards.</li>
<li><strong>Thread safety</strong>: immutable objects can be shared between threads without locking.</li>
<li><strong>Fast hashing</strong>: a string caches its hash code, which makes strings excellent <code>HashMap</code> keys.</li>
</ul>
<h2>String, StringBuilder, StringBuffer</h2>
<table>
<thead><tr><th scope="col">Class</th><th scope="col">Changeable?</th><th scope="col">Thread-safe?</th><th scope="col">Use it for</th></tr></thead>
<tbody>
<tr><td><code>String</code></td><td>no</td><td>yes (immutable)</td><td>almost all text</td></tr>
<tr><td><code>StringBuilder</code></td><td>yes</td><td>no</td><td>building text step by step, especially in loops</td></tr>
<tr><td><code>StringBuffer</code></td><td>yes</td><td>yes (synchronized methods)</td><td>legacy code; rarely needed today</td></tr>
</tbody>
</table>
<p>Joining with <code>+</code> inside a loop creates a new <code>String</code> every round and copies all the characters so far, so the total work grows with the square of the length. A <code>StringBuilder</code> appends into one growing buffer. Outside loops, a simple <code>+</code> is fine; the compiler optimises it.</p>
<h2>Common mistakes</h2>
<ul>
<li>Calling a method on a string that may be <code>null</code>: <code>input.equals("yes")</code> throws when <code>input</code> is <code>null</code>. Write <code>"yes".equals(input)</code> or use <code>Objects.equals(a, b)</code>.</li>
<li>Forgetting that <code>split</code> takes a regular expression: <code>"10.5".split(".")</code> returns an empty array, because <code>.</code> means "any character". Escape it: <code>split("\\\\.")</code>.</li>
<li>Ignoring a result: <code>s.trim();</code> on its own line changes nothing.</li>
</ul>
<h2>Check yourself</h2>
<p>How many <code>String</code> objects can <code>new String("hello")</code> involve, if "hello" is not yet in the pool?</p>
<details><summary>Answer</summary><p>Two: the pooled literal "hello" and the separate object created by <code>new</code>. If the literal is already in the pool, only one new object is created.</p></details>`,
          resources: [
            {
              title: 'Strings (dev.java)',
              url: 'https://dev.java/learn/numbers-strings/strings/',
            },
            {
              title: 'Text blocks (Java SE 21)',
              url: 'https://docs.oracle.com/en/java/javase/21/language/text-blocks.html',
            },
            {
              title: 'StringBuilder (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/StringBuilder.html',
            },
          ],
        },
        { kind: 'practice', question: 'java-string-equals' },
        {
          kind: 'article',
          title: 'Records, enums and the methods every object has',
          minutes: 20,
          html: `<p>Every class inherits a few methods from <code>Object</code> that decide how its objects print and compare. Getting them right by hand is tedious and error-prone, so modern Java gives you two special kinds of class that get them right for you: <strong>records</strong> for plain data and <strong>enums</strong> for a fixed set of constants.</p>
<h2>What every object inherits</h2>
<ul>
<li><code>toString()</code>: by default the class name and a hash, such as <code>Student@4e25154f</code>.</li>
<li><code>equals(Object)</code>: by default the same as <code>==</code>, so two objects with identical data are "not equal".</li>
<li><code>hashCode()</code>: a number used by hash-based collections; equal objects must return equal hash codes.</li>
<li><code>getClass()</code>: the object's run-time class.</li>
</ul>
<p>When a class represents a value — a student, a money amount, a date range — you normally want <code>equals</code> to compare the data. The Collections module shows what goes wrong when <code>equals</code> and <code>hashCode</code> disagree.</p>
<h2>Records and enums together</h2>
<pre><code class="language-java">import java.util.List;

public class SmallTypes {
    record Student(String code, String name, int marks) {
        Student {                                 // compact constructor: validate the data
            if (marks &lt; 0 || marks &gt; 100) {
                throw new IllegalArgumentException("marks out of range: " + marks);
            }
        }

        boolean passed() {
            return marks &gt;= 40;
        }
    }

    enum Grade {
        DISTINCTION(75), FIRST_CLASS(60), SECOND_CLASS(50), PASS(40), FAIL(0);

        private final int minimum;

        Grade(int minimum) {
            this.minimum = minimum;
        }

        static Grade of(int marks) {
            for (Grade g : values()) {            // in declaration order
                if (marks &gt;= g.minimum) {
                    return g;
                }
            }
            return FAIL;
        }
    }

    public static void main(String[] args) {
        Student a = new Student("SIA041", "Asha", 82);
        Student b = new Student("SIA041", "Asha", 82);
        System.out.println(a);
        System.out.println(a.equals(b) + " " + (a.hashCode() == b.hashCode()) + " " + (a == b));
        System.out.println(a.name() + " passed? " + a.passed());

        for (Student s : List.of(a, new Student("SIA042", "Ravi", 58), new Student("SIA043", "Meena", 39))) {
            Grade g = Grade.of(s.marks());
            String note = switch (g) {
                case DISTINCTION, FIRST_CLASS -&gt; "eligible for the placement drive";
                case SECOND_CLASS, PASS -&gt; "joins the improvement track";
                case FAIL -&gt; "must re-sit";
            };
            System.out.println(s.name() + ": " + g + ", " + note);
        }

        Object o = a;
        if (o instanceof Student(String code, String name, int marks) &amp;&amp; marks &gt; 80) {
            System.out.println("Record pattern: " + code + " scored " + marks);
        }

        try {
            new Student("SIA044", "Kiran", 120);
        } catch (IllegalArgumentException e) {
            System.out.println("Rejected: " + e.getMessage());
        }
    }
}</code></pre>
<pre><code class="language-text">Student[code=SIA041, name=Asha, marks=82]
true true false
Asha passed? true
Asha: DISTINCTION, eligible for the placement drive
Ravi: SECOND_CLASS, joins the improvement track
Meena: FAIL, must re-sit
Record pattern: SIA041 scored 82
Rejected: marks out of range: 120</code></pre>
<h2>Records (Java 16)</h2>
<ul>
<li>One line declares the fields, and Java generates a constructor, accessor methods named after the fields (<code>name()</code>, not <code>getName()</code>), and <code>equals</code>, <code>hashCode</code> and <code>toString</code> based on all the fields.</li>
<li>Fields are <code>private final</code>, so records are immutable — shallowly. A record holding a <code>List</code> should store <code>List.copyOf(list)</code> to stay truly unchangeable.</li>
<li>A <strong>compact constructor</strong> validates or normalises the data without repeating the assignments.</li>
<li>Records may add methods, static factories and implement interfaces, but cannot extend another class (they already extend <code>java.lang.Record</code>) and cannot be extended.</li>
<li>Java 21's <strong>record patterns</strong> take a record apart while testing its type, as in the <code>instanceof</code> line above.</li>
</ul>
<h2>Enums</h2>
<ul>
<li>An enum is a class with a fixed list of instances. The compiler rejects anything else, unlike <code>int</code> or <code>String</code> constants where a typo slips through.</li>
<li>Enums can have fields, constructors (always private) and methods, as <code>Grade</code> does.</li>
<li><code>values()</code> returns all constants in declaration order, <code>valueOf("PASS")</code> finds one by name, and <code>name()</code> returns its name.</li>
<li>A <code>switch</code> expression over an enum must cover every constant, so adding a new constant later shows you every place to update.</li>
<li><code>ordinal()</code> gives the position, but never store it in a database: reordering the constants silently changes every value.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Writing a full class with getters, <code>equals</code> and <code>hashCode</code> for plain data that a record would express in one line.</li>
<li>Looking for <code>getMarks()</code> on a record; the accessor is <code>marks()</code>.</li>
<li>Comparing enums with <code>equals</code> where <code>==</code> is fine and null-safe: each constant exists exactly once.</li>
</ul>
<h2>Check yourself</h2>
<p>Two different <code>Student</code> record objects are created with identical data. What do <code>==</code> and <code>equals</code> return?</p>
<details><summary>Answer</summary><p><code>==</code> is <code>false</code> (two objects); <code>equals</code> is <code>true</code>, because a record's generated <code>equals</code> compares every field.</p></details>`,
          resources: [
            {
              title: 'Record classes (Java SE 21)',
              url: 'https://docs.oracle.com/en/java/javase/21/language/records.html',
            },
            {
              title: 'The Java Tutorials: Enum Types (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/java/javaOO/enum.html',
            },
            {
              title: 'Object (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Object.html',
            },
          ],
        },
      ],
    },
    {
      title: 'Collections',
      summary:
        'Use generics and the collections framework with confidence: lists, queues, sets and maps, how HashMap works, the equals and hashCode contract, and sorting with Comparable and Comparator.',
      lessons: [
        {
          kind: 'article',
          title: 'Generics: type-safe code you write once',
          minutes: 20,
          html: `<p>Before Java 5, a list could hold anything, and every read needed a cast that might fail at run time. <strong>Generics</strong> let you say "a list of <code>String</code>" so the compiler checks every add and every read for you. You use generics every day through the collections, and writing your own generic classes and methods is a skill interviewers test.</p>
<h2>The problem generics solve</h2>
<pre><code class="language-java">List raw = new ArrayList();       // a raw type: no element type
raw.add("Asha");
raw.add(42);                       // nothing stops this
String s = (String) raw.get(1);    // ClassCastException at run time</code></pre>
<p>With <code>List&lt;String&gt;</code>, the second <code>add</code> is a compile error and the cast disappears. Moving errors from run time to compile time is the whole point. Never use raw types in new code; the compiler warns you when you do.</p>
<h2>Writing generic classes and methods</h2>
<pre><code class="language-java">import java.util.ArrayList;
import java.util.List;

public class GenericsTour {
    // A generic class: A and B are type parameters chosen by the user
    static class Pair&lt;A, B&gt; {
        private final A first;
        private final B second;

        Pair(A first, B second) {
            this.first = first;
            this.second = second;
        }

        A first() { return first; }
        B second() { return second; }

        @Override
        public String toString() {
            return "(" + first + ", " + second + ")";
        }
    }

    // A generic method: works for any element type
    static &lt;T&gt; T lastOrDefault(List&lt;T&gt; items, T fallback) {
        return items.isEmpty() ? fallback : items.get(items.size() - 1);
    }

    // A bounded type parameter: T must be comparable with itself
    static &lt;T extends Comparable&lt;T&gt;&gt; T maxOf(List&lt;T&gt; items) {
        T best = items.get(0);
        for (T item : items) {
            if (item.compareTo(best) &gt; 0) {
                best = item;
            }
        }
        return best;
    }

    // A wildcard: accepts List&lt;Integer&gt;, List&lt;Double&gt;, List&lt;Long&gt; ...
    static double total(List&lt;? extends Number&gt; amounts) {
        double sum = 0;
        for (Number n : amounts) {
            sum += n.doubleValue();
        }
        return sum;
    }

    public static void main(String[] args) {
        Pair&lt;String, Integer&gt; topper = new Pair&lt;&gt;("Asha", 96);
        String name = topper.first();       // no cast needed
        int marks = topper.second();        // unboxed automatically
        System.out.println(topper + " " + name.length() + " " + (marks + 4));

        List&lt;String&gt; cities = new ArrayList&lt;&gt;(List.of("Pune", "Kochi", "Agra"));
        System.out.println(lastOrDefault(cities, "none"));
        System.out.println(lastOrDefault(new ArrayList&lt;String&gt;(), "none"));
        System.out.println(maxOf(cities) + " " + maxOf(List.of(42, 7, 99, 15)));
        System.out.println(total(List.of(1200, 450)) + " " + total(List.of(99.5, 0.5)));
    }
}</code></pre>
<pre><code class="language-text">(Asha, 96) 4 100
Agra
none
Pune 99
1650.0 100.0</code></pre>
<ul>
<li>A generic method declares its type parameter before the return type: <code>static &lt;T&gt; T lastOrDefault(...)</code>. The compiler infers <code>T</code> from the arguments.</li>
<li><code>&lt;T extends Comparable&lt;T&gt;&gt;</code> is a <strong>bound</strong>: only types that can compare themselves are allowed, which is what lets <code>maxOf</code> call <code>compareTo</code>.</li>
<li><code>List&lt;? extends Number&gt;</code> accepts a list of any subtype of <code>Number</code> for <em>reading</em>. You cannot add to it, because Java does not know which exact type it holds. The reverse, <code>List&lt;? super Integer&gt;</code>, is for <em>writing</em> integers. A memory aid: producer <code>extends</code>, consumer <code>super</code>.</li>
</ul>
<h2>Why List&lt;Integer&gt; is not a List&lt;Number&gt;</h2>
<p>It feels as if it should be, but if it were, you could pass a <code>List&lt;Integer&gt;</code> to a method expecting <code>List&lt;Number&gt;</code>, which could then add a <code>Double</code> to your integers. Generics are deliberately <strong>invariant</strong>; wildcards are the safe way to accept "a list of some kind of number".</p>
<h2>Type erasure and its limits</h2>
<p>Generics are checked by the compiler and then <strong>erased</strong>: at run time, <code>List&lt;String&gt;</code> and <code>List&lt;Integer&gt;</code> are the same class, <code>ArrayList</code>. Erasure keeps old and new code compatible, but explains several rules:</p>
<ul>
<li>You cannot write <code>new T()</code> or <code>new T[10]</code>: at run time there is no <code>T</code> to create.</li>
<li>You cannot test <code>obj instanceof List&lt;String&gt;</code>; only <code>List&lt;?&gt;</code> can be checked.</li>
<li>Type arguments must be reference types: <code>List&lt;int&gt;</code> is illegal, so use <code>List&lt;Integer&gt;</code>.</li>
<li>A static field cannot use the class's type parameter, because one static field is shared by every parameterisation.</li>
</ul>
<h2>Check yourself</h2>
<p>Will <code>List&lt;Object&gt; objects = new ArrayList&lt;String&gt;();</code> compile?</p>
<details><summary>Answer</summary><p>No. Generic types are invariant, so <code>ArrayList&lt;String&gt;</code> is not a <code>List&lt;Object&gt;</code>. <code>List&lt;?&gt; anything = new ArrayList&lt;String&gt;();</code> would compile.</p></details>`,
          resources: [
            { title: 'Generics (dev.java)', url: 'https://dev.java/learn/generics/' },
            {
              title: 'The Java Tutorials: Generics (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/java/generics/index.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Lists and queues: ArrayList, LinkedList and ArrayDeque',
          minutes: 20,
          html: `<p>The collections framework is a family of interfaces with several implementations each. Choosing well — and knowing the traps of iterating and modifying — separates confident Java developers from people who copy code from forums. This lesson maps the family and goes deep on lists and queues.</p>
<h2>The family at a glance</h2>
<pre><code class="language-text">Iterable
  Collection
    List   ordered, by index, duplicates allowed    ArrayList, LinkedList
    Set    no duplicates                             HashSet, LinkedHashSet, TreeSet
    Queue  processing order                          ArrayDeque, PriorityQueue
Map        key to value (not a Collection)           HashMap, LinkedHashMap, TreeMap</code></pre>
<p>Declare variables with the interface (<code>List&lt;String&gt; names = new ArrayList&lt;&gt;();</code>) so you can change the implementation without touching the code that uses it.</p>
<h2>ArrayList or LinkedList?</h2>
<table>
<thead><tr><th scope="col">Operation</th><th scope="col">ArrayList</th><th scope="col">LinkedList</th></tr></thead>
<tbody>
<tr><td><code>get(i)</code>, <code>set(i, x)</code></td><td>O(1): direct index into an array</td><td>O(n): walks node by node</td></tr>
<tr><td>add at the end</td><td>O(1) on average (occasionally grows the array by about half)</td><td>O(1)</td></tr>
<tr><td>add or remove at the front</td><td>O(n): shifts every element</td><td>O(1)</td></tr>
<tr><td>memory</td><td>compact</td><td>an extra node object, with two links, per element</td></tr>
</tbody>
</table>
<p>In practice <code>ArrayList</code> wins almost every time, because index access and iteration over a compact array are very fast on modern processors. If you need cheap work at both ends, use <code>ArrayDeque</code> rather than <code>LinkedList</code>.</p>
<h2>Modifying a list safely</h2>
<pre><code class="language-java">import java.util.ArrayList;
import java.util.ConcurrentModificationException;
import java.util.Iterator;
import java.util.List;

public class ListToolkit {
    public static void main(String[] args) {
        List&lt;Integer&gt; marks = new ArrayList&lt;&gt;(List.of(72, 35, 88, 39, 91, 64));

        marks.removeIf(m -&gt; m &lt; 40);                 // remove matching elements safely
        System.out.println(marks);

        Iterator&lt;Integer&gt; it = marks.iterator();      // the classic way: Iterator.remove
        while (it.hasNext()) {
            if (it.next() &gt; 90) {
                it.remove();
            }
        }
        System.out.println(marks);

        marks.replaceAll(m -&gt; Math.min(100, m + 5)); // grace marks, capped at 100
        System.out.println(marks);

        // Java 21: lists are sequenced collections
        System.out.println(marks.getFirst() + " " + marks.getLast() + " " + marks.reversed());

        List&lt;Integer&gt; fixed = List.of(1, 2, 3);
        try {
            fixed.add(4);
        } catch (UnsupportedOperationException e) {
            System.out.println("List.of is unmodifiable");
        }

        try {
            for (Integer m : marks) {
                if (m &lt; 80) {
                    marks.remove(m);
                }
            }
        } catch (ConcurrentModificationException e) {
            System.out.println("Removing inside for-each: ConcurrentModificationException");
        }
    }
}</code></pre>
<pre><code class="language-text">[72, 88, 91, 64]
[72, 88, 64]
[77, 93, 69]
77 69 [69, 93, 77]
List.of is unmodifiable
Removing inside for-each: ConcurrentModificationException</code></pre>
<p>The arrows (<code>m -&gt; m &lt; 40</code>) are lambdas: small functions passed as arguments. The next module covers them properly. The last block shows the classic bug: a for-each loop uses an iterator behind the scenes, and changing the list underneath it makes the iterator fail fast. Use <code>removeIf</code> or <code>Iterator.remove</code> instead.</p>
<h2>Three kinds of "read-only" list</h2>
<ul>
<li><code>List.of(...)</code> and <code>List.copyOf(...)</code>: truly unmodifiable, and they reject <code>null</code> elements.</li>
<li><code>Arrays.asList(array)</code>: fixed size but <code>set</code> works, and it writes through to the array.</li>
<li><code>Collections.unmodifiableList(list)</code>: a read-only <em>view</em>; changes to the original list still show through it.</li>
</ul>
<h2>Queues and deques</h2>
<p><code>ArrayDeque</code> is the go-to class for both stacks (<code>push</code>, <code>pop</code>) and FIFO queues (<code>offer</code>, <code>poll</code>). <code>PriorityQueue</code> always hands out the smallest element first, according to natural order or a comparator — you will use it in the sorting lesson. Prefer the <code>offer</code>/<code>poll</code>/<code>peek</code> methods, which return <code>false</code> or <code>null</code> when they cannot proceed, over <code>add</code>/<code>remove</code>/<code>element</code>, which throw.</p>
<h2>Check yourself</h2>
<p>You need to read elements by position millions of times and rarely insert. Which list do you pick, and why?</p>
<details><summary>Answer</summary><p><code>ArrayList</code>: <code>get(i)</code> is O(1) because it indexes straight into its internal array, while <code>LinkedList</code> must walk to position <code>i</code>.</p></details>`,
          resources: [
            {
              title: 'The Collections Framework (dev.java)',
              url: 'https://dev.java/learn/api/collections-framework/',
            },
            {
              title: 'List (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/List.html',
            },
          ],
        },
        { kind: 'practice', question: 'java-arraylist-vs-linkedlist' },
        {
          kind: 'article',
          title: 'Sets and maps: HashSet, HashMap, LinkedHashMap and TreeMap',
          minutes: 22,
          html: `<p>Maps are the workhorse of real Java code: caches, lookups by ID, counts, grouping records by city or batch. Sets answer "have I seen this?" in an instant. This lesson covers the modern map API that removes most boilerplate, and then the question every Java interview asks: how does a <code>HashMap</code> actually work?</p>
<h2>The API you will use every day</h2>
<pre><code class="language-java">import java.util.*;

public class MapToolkit {
    public static void main(String[] args) {
        String[] attendance = {"Ravi", "Asha", "Ravi", "Zoya", "Asha", "Ravi"};

        Set&lt;String&gt; hashed = new HashSet&lt;&gt;(Arrays.asList(attendance));
        Set&lt;String&gt; linked = new LinkedHashSet&lt;&gt;(Arrays.asList(attendance));
        Set&lt;String&gt; sorted = new TreeSet&lt;&gt;(Arrays.asList(attendance));
        System.out.println(linked + " " + sorted + " size " + hashed.size());

        Map&lt;String, Integer&gt; days = new TreeMap&lt;&gt;();
        for (String name : attendance) {
            days.merge(name, 1, Integer::sum);        // start at 1, or add 1
        }
        System.out.println(days);

        Map&lt;String, List&lt;String&gt;&gt; byCity = new TreeMap&lt;&gt;();
        String[][] students = {{"Asha", "Chennai"}, {"Ravi", "Pune"}, {"Zoya", "Chennai"}};
        for (String[] s : students) {
            byCity.computeIfAbsent(s[1], city -&gt; new ArrayList&lt;&gt;()).add(s[0]);
        }
        System.out.println(byCity);

        for (Map.Entry&lt;String, Integer&gt; e : days.entrySet()) {
            if (e.getValue() &gt;= 2) {
                System.out.println(e.getKey() + " attended " + e.getValue() + " days");
            }
        }

        TreeMap&lt;Integer, String&gt; slabs = new TreeMap&lt;&gt;(Map.of(0, "no discount", 1000, "5% off", 5000, "10% off"));
        System.out.println(slabs.floorEntry(3200).getValue());   // greatest key &lt;= 3200
        days.putIfAbsent("Imran", 0);
        System.out.println(days.getOrDefault("Kiran", 0) + " " + days.containsKey("Imran"));
    }
}</code></pre>
<pre><code class="language-text">[Ravi, Asha, Zoya] [Asha, Ravi, Zoya] size 3
{Asha=2, Ravi=3, Zoya=1}
{Chennai=[Asha, Zoya], Pune=[Ravi]}
Asha attended 2 days
Ravi attended 3 days
5% off
0 true</code></pre>
<ul>
<li><code>merge(key, 1, Integer::sum)</code> is the one-line counter: insert 1 if the key is new, otherwise combine the old value and 1 with <code>Integer.sum</code>.</li>
<li><code>computeIfAbsent(key, k -&gt; new ArrayList&lt;&gt;())</code> creates the list the first time a key appears and returns the existing one after that — perfect for grouping.</li>
<li><code>putIfAbsent</code> and <code>getOrDefault</code> remove most <code>if (map.containsKey(...))</code> checks.</li>
<li><code>TreeMap</code> keeps keys sorted and adds navigation: <code>floorEntry</code>, <code>ceilingKey</code>, <code>firstKey</code>, <code>headMap</code>. Fee slabs, tax brackets and time-based lookups become one call.</li>
</ul>
<h2>How a HashMap works</h2>
<ol>
<li><code>put(key, value)</code> calls <code>key.hashCode()</code>, mixes the bits, and maps the result to an index in an internal array of <strong>buckets</strong>.</li>
<li>If the bucket is empty, the entry goes there. If not, the map walks the entries in that bucket and uses <code>equals</code> to see whether the key is already present: if so, the value is replaced; if not, the new entry joins the bucket. Different keys in one bucket are a <strong>collision</strong>.</li>
<li><code>get(key)</code> repeats the same steps: hash to find the bucket, <code>equals</code> to find the entry.</li>
<li>When the number of entries passes the capacity times the <strong>load factor</strong> (0.75 by default), the array doubles in size and every entry is redistributed.</li>
<li>Since Java 8, a bucket that collects many entries (more than 8, once the table has at least 64 buckets) is converted from a linked list into a balanced tree, so even heavy collisions cost O(log n) rather than O(n).</li>
</ol>
<p>With a good <code>hashCode</code>, entries spread evenly and <code>get</code> and <code>put</code> take constant time on average. This is also why keys must implement <code>equals</code> and <code>hashCode</code> consistently — the subject of the next lesson. <code>HashMap</code> allows one <code>null</code> key; <code>TreeMap</code> does not, because it must compare keys.</p>
<h2>Choosing a map or set</h2>
<table>
<thead><tr><th scope="col">Need</th><th scope="col">Choose</th></tr></thead>
<tbody>
<tr><td>fastest lookups, order irrelevant</td><td><code>HashMap</code> / <code>HashSet</code></td></tr>
<tr><td>remember insertion order</td><td><code>LinkedHashMap</code> / <code>LinkedHashSet</code></td></tr>
<tr><td>sorted keys, ranges, nearest key</td><td><code>TreeMap</code> / <code>TreeSet</code> — O(log n) operations</td></tr>
<tr><td>shared between threads</td><td><code>ConcurrentHashMap</code></td></tr>
</tbody>
</table>
<h2>Check yourself</h2>
<p>Why can iterating over a <code>HashMap</code> print entries in a different order from the order you inserted them?</p>
<details><summary>Answer</summary><p>Iteration follows the bucket array, and a key's bucket depends on its hash, not on when it was inserted. Resizing can also change the order. Use a <code>LinkedHashMap</code> when insertion order matters.</p></details>`,
          resources: [
            {
              title: 'Maps (dev.java)',
              url: 'https://dev.java/learn/api/collections-framework/maps/',
            },
            {
              title: 'HashMap (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html',
            },
          ],
        },
        { kind: 'practice', question: 'java-character-frequency' },
        {
          kind: 'article',
          title: 'equals and hashCode: making your own keys work',
          minutes: 18,
          html: `<p>Put a student code into a <code>HashMap</code>, create an identical code later, look it up — and get <code>null</code>. This bug has cost teams days of debugging. It happens when a class overrides <code>equals</code> but not <code>hashCode</code>, and it is one of the most popular Java interview questions. Here is why it happens and how to prevent it.</p>
<h2>The bug and the fix</h2>
<pre><code class="language-java">import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public class KeysThatWork {
    static class BrokenCode {
        private final String batch;
        private final int roll;

        BrokenCode(String batch, int roll) {
            this.batch = batch;
            this.roll = roll;
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof BrokenCode other &amp;&amp; roll == other.roll &amp;&amp; batch.equals(other.batch);
        }
        // hashCode() is NOT overridden, so equal objects get different hash codes
    }

    static final class StudentCode {
        private final String batch;
        private final int roll;

        StudentCode(String batch, int roll) {
            this.batch = batch;
            this.roll = roll;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) {
                return true;
            }
            if (!(o instanceof StudentCode other)) {
                return false;
            }
            return roll == other.roll &amp;&amp; batch.equals(other.batch);
        }

        @Override
        public int hashCode() {
            return Objects.hash(batch, roll);
        }
    }

    record CodeRecord(String batch, int roll) { }   // equals and hashCode generated

    public static void main(String[] args) {
        Map&lt;BrokenCode, String&gt; broken = new HashMap&lt;&gt;();
        broken.put(new BrokenCode("JFS-B1", 41), "Asha");
        System.out.println("Broken lookup: " + broken.get(new BrokenCode("JFS-B1", 41)));

        Map&lt;StudentCode, String&gt; fixed = new HashMap&lt;&gt;();
        fixed.put(new StudentCode("JFS-B1", 41), "Asha");
        System.out.println("Fixed lookup: " + fixed.get(new StudentCode("JFS-B1", 41)));

        Set&lt;CodeRecord&gt; codes = new HashSet&lt;&gt;();
        codes.add(new CodeRecord("JFS-B1", 41));
        codes.add(new CodeRecord("JFS-B1", 41));
        System.out.println("Record set size: " + codes.size());
    }
}</code></pre>
<pre><code class="language-text">Broken lookup: null
Fixed lookup: Asha
Record set size: 1</code></pre>
<p>The broken lookup fails before <code>equals</code> is ever called. The inherited <code>hashCode</code> is based on object identity, so the second <code>BrokenCode</code> almost certainly hashes to a different bucket, and the map looks in the wrong place.</p>
<h2>The contract</h2>
<ul>
<li>If <code>a.equals(b)</code> is true, then <code>a.hashCode() == b.hashCode()</code> <strong>must</strong> be true.</li>
<li>Unequal objects <em>may</em> share a hash code. That is a collision: allowed, but many of them slow a map down.</li>
<li><code>hashCode</code> must return the same value every time while the fields it uses do not change.</li>
</ul>
<p>And <code>equals</code> itself must be <strong>reflexive</strong> (<code>a.equals(a)</code>), <strong>symmetric</strong> (if <code>a.equals(b)</code> then <code>b.equals(a)</code>), <strong>transitive</strong>, <strong>consistent</strong> across calls, and must return <code>false</code> for <code>null</code>. The pattern above — same object check, type check with a pattern variable, then field comparison — satisfies all of these for a <code>final</code> class.</p>
<h2>Writing them correctly</h2>
<ul>
<li>Use exactly the same fields in <code>equals</code> and <code>hashCode</code>.</li>
<li><code>Objects.hash(...)</code> combines several fields; <code>Objects.equals(a, b)</code> compares fields that may be <code>null</code>.</li>
<li>Better still, for pure data use a <strong>record</strong>: both methods are generated from all its fields, as <code>CodeRecord</code> shows.</li>
<li>Your IDE can generate both methods, but read what it generates.</li>
</ul>
<h2>The mutable-key trap</h2>
<p>If you change a field that <code>hashCode</code> uses <em>after</em> putting the object in a <code>HashMap</code> or <code>HashSet</code>, the entry stays in the bucket for its old hash. Lookups now search the wrong bucket, and the entry is effectively lost, even though iterating still shows it. Keys should be immutable; strings, wrapper types and records make ideal keys.</p>
<h2>Common mistakes</h2>
<ul>
<li>Overriding <code>equals(StudentCode other)</code> instead of <code>equals(Object o)</code>. That is an overload, not an override, and collections never call it. <code>@Override</code> catches the mistake.</li>
<li>Including a field in <code>hashCode</code> that is not in <code>equals</code>, such as a "last updated" timestamp.</li>
<li>Comparing <code>String</code> fields with <code>==</code> inside <code>equals</code>.</li>
</ul>
<h2>Check yourself</h2>
<p>Is <code>public int hashCode() { return 42; }</code> legal? Is it a good idea?</p>
<details><summary>Answer</summary><p>It is legal — equal objects do get equal hash codes. But every key lands in the same bucket, so the map loses its constant-time lookups: every operation searches that one crowded bucket. A legal hash code is not the same as a good one.</p></details>`,
          resources: [
            {
              title: 'Object.hashCode and equals (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Object.html',
            },
          ],
        },
        { kind: 'practice', question: 'java-equals-hashcode' },
        {
          kind: 'article',
          title: 'Sorting with Comparable and Comparator',
          minutes: 20,
          html: `<p>Merit lists, leaderboards, "cheapest first", "latest first": sorting objects is everywhere. Java separates two ideas: a class's <strong>natural order</strong>, defined once by implementing <code>Comparable</code>, and any number of other orders, expressed as <code>Comparator</code> objects. Modern Java builds comparators so fluently that most sort rules fit on one line.</p>
<h2>Natural order and custom orders</h2>
<pre><code class="language-java">import java.util.*;

public class MeritList {
    record Candidate(String name, int marks, int age) implements Comparable&lt;Candidate&gt; {
        @Override
        public int compareTo(Candidate other) {
            return name.compareTo(other.name);           // natural order: by name
        }
    }

    public static void main(String[] args) {
        List&lt;Candidate&gt; list = new ArrayList&lt;&gt;(List.of(
                new Candidate("Ravi", 88, 22),
                new Candidate("Asha", 92, 21),
                new Candidate("Zoya", 88, 20),
                new Candidate("Imran", 75, 23)));

        Collections.sort(list);                          // uses compareTo
        System.out.println(names(list));

        list.sort(Comparator.comparingInt(Candidate::marks).reversed()
                .thenComparingInt(Candidate::age));      // marks high to low, then younger first
        System.out.println(names(list));

        PriorityQueue&lt;Candidate&gt; topTwo = new PriorityQueue&lt;&gt;(Comparator.comparingInt(Candidate::marks));
        for (Candidate c : list) {
            topTwo.offer(c);
            if (topTwo.size() &gt; 2) {
                topTwo.poll();                           // drop the lowest seen so far
            }
        }
        System.out.println("Top two marks: " + topTwo.poll().marks() + ", " + topTwo.poll().marks());

        TreeSet&lt;Candidate&gt; byAge = new TreeSet&lt;&gt;(Comparator.comparingInt(Candidate::age));
        byAge.addAll(list);
        System.out.println("Youngest: " + byAge.first().name());
    }

    static List&lt;String&gt; names(List&lt;Candidate&gt; list) {
        List&lt;String&gt; out = new ArrayList&lt;&gt;();
        for (Candidate c : list) {
            out.add(c.name() + "(" + c.marks() + ")");
        }
        return out;
    }
}</code></pre>
<pre><code class="language-text">[Asha(92), Imran(75), Ravi(88), Zoya(88)]
[Asha(92), Zoya(88), Ravi(88), Imran(75)]
Top two marks: 88, 92
Youngest: Zoya</code></pre>
<h2>Comparable: the natural order</h2>
<p><code>compareTo</code> returns a negative number if <code>this</code> comes first, zero if the two are equal in order, and a positive number if <code>this</code> comes after. <code>String</code>, the wrapper classes and <code>LocalDate</code> already implement it, which is why <code>Collections.sort</code> works on them directly. Give a class a natural order only when there is one obvious order; use comparators for everything else.</p>
<h2>Comparator: any order you need</h2>
<ul>
<li><code>Comparator.comparing(Candidate::name)</code> and <code>comparingInt(Candidate::marks)</code> build a comparator from a key. <code>Candidate::marks</code> is a method reference, a short way to say "call <code>marks()</code> on each candidate".</li>
<li><code>.reversed()</code> flips the order; <code>.thenComparing...</code> breaks ties.</li>
<li><code>Comparator.nullsFirst(...)</code> and <code>nullsLast(...)</code> handle missing values.</li>
<li><code>list.sort(comparator)</code> sorts in place. Object sorting in Java is <strong>stable</strong>, so a second sort keeps the order from the first among ties.</li>
</ul>
<h2>Priority queues and sorted sets</h2>
<p>A <code>PriorityQueue</code> always hands out its smallest element first. Keeping a min-heap of size k, as above, finds the top k items in O(n log k) without sorting everything — a favourite coding-round technique. A <code>TreeSet</code> or <code>TreeMap</code> with a comparator stays sorted as you add to it.</p>
<p>One trap: sorted sets and maps use the comparator, not <code>equals</code>, to detect duplicates. In <code>byAge</code>, two candidates of the same age would count as the <em>same</em> element, and the second would silently be dropped. Make such comparators break ties on a unique field.</p>
<h2>Common mistakes</h2>
<ul>
<li>Writing <code>(a, b) -&gt; a.marks() - b.marks()</code>. Subtraction can overflow for large or negative values; use <code>Integer.compare</code> or <code>comparingInt</code>.</li>
<li>Calling <code>reversed()</code> in the wrong place: <code>comparing(x).thenComparing(y).reversed()</code> reverses <em>both</em> keys.</li>
<li>Expecting a <code>PriorityQueue</code> to print in sorted order. Only <code>poll</code> respects priority; iteration order is the heap's internal layout.</li>
</ul>
<h2>Check yourself</h2>
<p>Write a comparator that sorts candidates by name length, shortest first, and alphabetically when lengths are equal.</p>
<details><summary>Answer</summary><p><code>Comparator.comparingInt((Candidate c) -&gt; c.name().length()).thenComparing(Candidate::name)</code>. The explicit parameter type helps the compiler infer the type when the chain continues.</p></details>`,
          resources: [
            {
              title: 'Comparator (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Comparator.html',
            },
            {
              title: 'The Java Tutorials: Object Ordering (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/collections/interfaces/order.html',
            },
          ],
        },
      ],
    },
    {
      title: 'Getting things done',
      summary:
        'Handle failures with exceptions, read and write files with java.nio.file, write lambdas and stream pipelines, use Optional well, and work with dates and times through java.time.',
      lessons: [
        {
          kind: 'article',
          title: 'Exceptions: failing clearly and recovering well',
          minutes: 22,
          html: `<p>Real programs meet bad input, missing files and full trains. Java reports such problems with <strong>exceptions</strong>: objects that interrupt the normal flow and travel up the call stack until some code handles them. Handling them well means users see a clear message, nothing is left half done, and the logs tell developers exactly what happened.</p>
<h2>The exception family</h2>
<pre><code class="language-text">Throwable
  Error                  serious JVM problems: OutOfMemoryError, StackOverflowError (do not catch)
  Exception              checked: the compiler makes you handle or declare them (IOException ...)
    RuntimeException     unchecked: programming errors and invalid arguments
                         (NullPointerException, IllegalArgumentException, ArithmeticException ...)</code></pre>
<p>A <strong>checked</strong> exception describes a problem a correct program should still expect — a file that does not exist, a network that is down. The compiler forces every caller to either catch it or declare it with <code>throws</code>. An <strong>unchecked</strong> exception (a <code>RuntimeException</code> or one of its subclasses) usually signals a bug or a broken rule, and the compiler leaves it to you.</p>
<h2>Throwing, catching and cleaning up</h2>
<pre><code class="language-java">import java.util.HashMap;
import java.util.Map;

public class SeatBooking {
    static class SeatsUnavailableException extends Exception {
        SeatsUnavailableException(String message) {
            super(message);
        }
    }

    private static final Map&lt;String, Integer&gt; seatsLeft = new HashMap&lt;&gt;(Map.of("12635", 2));

    static void book(String train, int seats) throws SeatsUnavailableException {
        if (seats &lt;= 0) {
            throw new IllegalArgumentException("seats must be positive: " + seats);
        }
        Integer left = seatsLeft.get(train);
        if (left == null) {
            throw new IllegalArgumentException("unknown train " + train);
        }
        if (left &lt; seats) {
            throw new SeatsUnavailableException("only " + left + " seat(s) left on " + train);
        }
        seatsLeft.put(train, left - seats);
    }

    static String tryBooking(String train, int seats) {
        try {
            book(train, seats);
            return "booked " + seats + " on " + train;
        } catch (SeatsUnavailableException e) {
            return "waitlisted: " + e.getMessage();
        } catch (IllegalArgumentException e) {
            return "rejected: " + e.getMessage();
        } finally {
            System.out.println("[audit] request for " + seats + " on " + train);
        }
    }

    public static void main(String[] args) {
        System.out.println(tryBooking("12635", 1));
        System.out.println(tryBooking("12635", 3));
        System.out.println(tryBooking("99999", 1));
        System.out.println(tryBooking("12635", 0));
    }
}</code></pre>
<pre><code class="language-text">[audit] request for 1 on 12635
booked 1 on 12635
[audit] request for 3 on 12635
waitlisted: only 1 seat(s) left on 12635
[audit] request for 1 on 99999
rejected: unknown train 99999
[audit] request for 0 on 12635
rejected: seats must be positive: 0</code></pre>
<ul>
<li><code>throw</code> raises an exception; <code>throws</code> in a method header declares the checked exceptions it may pass on.</li>
<li><code>catch</code> blocks are tried in order, so put specific types before general ones. To handle several types the same way, use a multi-catch: <code>catch (NumberFormatException | ArithmeticException e)</code>.</li>
<li><code>finally</code> runs whether the <code>try</code> finished normally, returned, or threw. Notice that every audit line prints <em>before</em> the result: the <code>finally</code> block ran after the <code>return</code> value was decided but before the method actually returned.</li>
<li>A custom exception is a small class extending <code>Exception</code> (checked) or <code>RuntimeException</code> (unchecked). Give it a name that says what went wrong in business terms.</li>
</ul>
<h2>Keep the cause</h2>
<p>When you catch a low-level exception and throw a higher-level one, pass the original as the <strong>cause</strong>: <code>throw new BookingFailedException("could not save booking " + pnr, e);</code>. The stack trace then shows both, joined by a "Caused by:" line — often exactly the clue you need in production.</p>
<h2>Good habits</h2>
<ul>
<li>Never swallow an exception with an empty <code>catch</code>. At the very least, log it with its stack trace.</li>
<li>Catch only what you can handle at that level; let the rest travel up to a place that can report it.</li>
<li>Validate arguments early and throw <code>IllegalArgumentException</code> or <code>IllegalStateException</code> with a message that includes the bad value.</li>
<li>Do not use exceptions for ordinary control flow, such as ending a loop.</li>
<li>Close resources with try-with-resources (next lesson) rather than in <code>finally</code> by hand.</li>
</ul>
<h2>Check yourself</h2>
<p>What does <code>static int f() { try { return 1; } finally { return 2; } }</code> return?</p>
<details><summary>Answer</summary><p>2. The <code>finally</code> block runs after <code>return 1</code> is evaluated, and its own <code>return</code> replaces the result. That is exactly why you should never return from a <code>finally</code> block — it can also hide an exception.</p></details>`,
          resources: [
            {
              title: 'The Java Tutorials: Exceptions (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/essential/exceptions/index.html',
            },
            { title: 'Exceptions (dev.java)', url: 'https://dev.java/learn/exceptions/' },
          ],
        },
        { kind: 'practice', question: 'java-checked-exceptions' },
        {
          kind: 'article',
          title: 'Files with java.nio.file and try-with-resources',
          minutes: 18,
          html: `<p>Mark sheets arrive as CSV files, reports go out as text, and logs pile up on disk. The <code>java.nio.file</code> package — <code>Path</code> to name a file and <code>Files</code> to work with it — handles all of this in a few lines. You will also learn try-with-resources, the reliable way to close anything that must be closed.</p>
<h2>Read, process and write a CSV file</h2>
<pre><code class="language-java">import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

public class MarksFile {
    public static void main(String[] args) throws IOException {
        Path file = Files.createTempFile("marks", ".csv");
        Files.writeString(file, """
                name,maths,physics
                Asha,91,84
                Ravi,67,72
                Zoya,88,95
                """);

        List&lt;String&gt; lines = Files.readAllLines(file);
        System.out.println("Lines: " + lines.size() + ", header: " + lines.get(0));

        int sum = 0;
        int count = 0;
        int best = -1;
        String topper = "";
        try (BufferedReader reader = Files.newBufferedReader(file)) {
            reader.readLine();                              // skip the header
            String line;
            while ((line = reader.readLine()) != null) {
                String[] parts = line.split(",");
                int total = Integer.parseInt(parts[1]) + Integer.parseInt(parts[2]);
                System.out.printf("%-5s %3d%n", parts[0], total);
                sum += total;
                count++;
                if (total &gt; best) {
                    best = total;
                    topper = parts[0];
                }
            }
        }

        Path report = Files.createTempFile("report", ".txt");
        Files.write(report, List.of("Topper: " + topper, "Average total: %.2f".formatted((double) sum / count)));
        for (String line : Files.readAllLines(report)) {
            System.out.println(line);
        }
        Files.delete(report);
        Files.delete(file);
        System.out.println("Cleaned up: " + !Files.exists(file));
    }
}</code></pre>
<pre><code class="language-text">Lines: 4, header: name,maths,physics
Asha  175
Ravi  139
Zoya  183
Topper: Zoya
Average total: 165.67
Cleaned up: true</code></pre>
<h2>The Files methods worth knowing</h2>
<table>
<thead><tr><th scope="col">Method</th><th scope="col">Use</th></tr></thead>
<tbody>
<tr><td><code>readString</code>, <code>readAllLines</code></td><td>small files, read in one go</td></tr>
<tr><td><code>newBufferedReader</code>, <code>lines</code></td><td>large files, read line by line without loading everything</td></tr>
<tr><td><code>writeString</code>, <code>write</code></td><td>write text or a list of lines (replacing the file by default)</td></tr>
<tr><td><code>exists</code>, <code>createDirectories</code>, <code>copy</code>, <code>move</code>, <code>delete</code></td><td>manage files and folders</td></tr>
</tbody>
</table>
<p><code>Path.of("data", "marks.csv")</code> builds a path with the right separator for the operating system. A relative path is resolved against the directory the program was started from — a frequent source of "file not found" surprises when you run from an IDE. Since Java 18 the default character set is UTF-8 everywhere, and the <code>Files</code> methods have always defaulted to UTF-8, so Tamil, Hindi or Kannada text in your files is safe.</p>
<h2>try-with-resources</h2>
<p>Readers, writers, database connections and sockets hold operating-system resources that must be released. Any object that implements <code>AutoCloseable</code> can be declared in the brackets after <code>try</code>, and Java closes it when the block ends — normally or through an exception — in the reverse order of opening. If closing also fails, that second exception is attached to the first as a <em>suppressed</em> exception instead of hiding it.</p>
<pre><code class="language-java">try (Stream&lt;String&gt; lines = Files.lines(Path.of("attendance.log"))) {
    long absences = lines.filter(l -&gt; l.endsWith("ABSENT")).count();
    System.out.println(absences);
}</code></pre>
<p><code>Files.lines</code> keeps the file open while the stream is in use, so it belongs in try-with-resources too. You will learn streams properly two lessons from now.</p>
<h2>Common mistakes</h2>
<ul>
<li>Reading a huge log file with <code>readAllLines</code> and running out of memory. Stream it instead.</li>
<li>Catching <code>IOException</code> and printing nothing useful. Include the path in your message.</li>
<li>Forgetting that <code>write</code> replaces the file. Pass <code>StandardOpenOption.APPEND</code> to add to it.</li>
<li>Building paths by joining strings with <code>"\\\\"</code>, which breaks on Linux servers. Use <code>Path.of</code> or <code>resolve</code>.</li>
</ul>
<h2>Check yourself</h2>
<p>Two resources are opened in one try-with-resources statement: <code>try (var in = ...; var out = ...)</code>. Which is closed first?</p>
<details><summary>Answer</summary><p><code>out</code>. Resources are closed in the reverse order of their creation.</p></details>`,
          resources: [
            {
              title: 'Files (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/nio/file/Files.html',
            },
            {
              title: 'Accessing the file system (dev.java)',
              url: 'https://dev.java/learn/java-io/file-system/',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Lambdas, functional interfaces and method references',
          minutes: 20,
          html: `<p>Often you want to pass <em>behaviour</em> to a method: how to compare two students, which fees to waive, what to do with each line of a file. Before Java 8 that meant writing a whole anonymous class. A <strong>lambda</strong> says the same thing in one line, and it is the foundation of streams, modern collections code and most frameworks you will use at work.</p>
<h2>From anonymous class to lambda</h2>
<pre><code class="language-java">Comparator&lt;String&gt; byLengthOld = new Comparator&lt;&gt;() {
    @Override
    public int compare(String a, String b) {
        return Integer.compare(a.length(), b.length());
    }
};
Comparator&lt;String&gt; byLength = (a, b) -&gt; Integer.compare(a.length(), b.length());</code></pre>
<p>Both create a <code>Comparator</code>. The lambda keeps only what matters: the parameters, an arrow, and the body. With one parameter the brackets are optional (<code>m -&gt; m &gt;= 40</code>); with a block body you write braces and an explicit <code>return</code>.</p>
<h2>Functional interfaces</h2>
<p>A lambda needs a target: an interface with exactly <strong>one abstract method</strong>, called a functional interface. <code>Comparator</code>, <code>Runnable</code> and your own one-method interfaces all qualify. The <code>java.util.function</code> package provides the common shapes:</p>
<table>
<thead><tr><th scope="col">Interface</th><th scope="col">Method</th><th scope="col">Shape</th></tr></thead>
<tbody>
<tr><td><code>Predicate&lt;T&gt;</code></td><td><code>test</code></td><td>T to boolean — filters</td></tr>
<tr><td><code>Function&lt;T, R&gt;</code></td><td><code>apply</code></td><td>T to R — conversions</td></tr>
<tr><td><code>Consumer&lt;T&gt;</code></td><td><code>accept</code></td><td>T to nothing — actions</td></tr>
<tr><td><code>Supplier&lt;T&gt;</code></td><td><code>get</code></td><td>nothing to T — factories</td></tr>
<tr><td><code>BiFunction&lt;T, U, R&gt;</code></td><td><code>apply</code></td><td>two inputs to R</td></tr>
<tr><td><code>UnaryOperator&lt;T&gt;</code></td><td><code>apply</code></td><td>T to T</td></tr>
</tbody>
</table>
<pre><code class="language-java">import java.util.ArrayList;
import java.util.List;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;

public class LambdaTour {
    @FunctionalInterface
    interface FeeRule {
        long apply(long fee);
    }

    public static void main(String[] args) {
        FeeRule earlyBird = fee -&gt; fee * 90 / 100;
        FeeRule sibling = fee -&gt; fee - 2000;
        System.out.println(sibling.apply(earlyBird.apply(40000)));

        Predicate&lt;Integer&gt; passed = m -&gt; m &gt;= 40;
        Predicate&lt;Integer&gt; distinction = m -&gt; m &gt;= 75;
        System.out.println(passed.test(52) + " " + passed.and(distinction).test(52) + " " + passed.negate().test(30));

        Function&lt;String, Integer&gt; length = String::length;          // method reference
        Function&lt;Integer, Integer&gt; doubled = n -&gt; n * 2;
        System.out.println(length.andThen(doubled).apply("Madurai"));

        BiFunction&lt;Integer, Integer, Integer&gt; percent = (part, whole) -&gt; part * 100 / whole;
        System.out.println(percent.apply(437, 500) + "%");

        Supplier&lt;List&lt;String&gt;&gt; fresh = ArrayList::new;             // constructor reference
        List&lt;String&gt; names = fresh.get();
        Consumer&lt;String&gt; addName = names::add;                     // method of one particular object
        addName.accept("Asha");
        addName.accept("Ravi");
        UnaryOperator&lt;String&gt; shout = String::toUpperCase;
        names.replaceAll(shout);
        names.forEach(System.out::println);

        int bonus = 5;                                            // effectively final
        Function&lt;Integer, Integer&gt; withBonus = m -&gt; m + bonus;
        System.out.println(withBonus.apply(70));
    }
}</code></pre>
<pre><code class="language-text">34000
true false true
14
87%
ASHA
RAVI
75</code></pre>
<h2>Method references</h2>
<p>When a lambda only calls an existing method, a <strong>method reference</strong> is shorter. There are four kinds:</p>
<ul>
<li>A static method: <code>Integer::parseInt</code> for <code>s -&gt; Integer.parseInt(s)</code>.</li>
<li>An instance method of the argument: <code>String::length</code> for <code>s -&gt; s.length()</code>.</li>
<li>An instance method of a particular object: <code>names::add</code>, or <code>System.out::println</code>.</li>
<li>A constructor: <code>ArrayList::new</code>.</li>
</ul>
<p>The default methods <code>and</code>, <code>or</code>, <code>negate</code> on <code>Predicate</code> and <code>andThen</code>, <code>compose</code> on <code>Function</code> let you build bigger rules from small ones.</p>
<h2>Capturing variables</h2>
<p>A lambda may use local variables from the surrounding method only if they are <strong>effectively final</strong> — never reassigned after their first value. Add <code>bonus = 10;</code> anywhere in <code>main</code> above and the lambda stops compiling. The rule exists because the lambda may run later, possibly on another thread, and must see one stable value. Fields have no such restriction, but changing shared fields from lambdas invites bugs.</p>
<h2>Common mistakes</h2>
<ul>
<li>Writing long, multi-step lambdas. Move the logic into a named method and pass a method reference.</li>
<li>Using a lambda where the target interface has more than one abstract method: it will not compile.</li>
<li>Throwing checked exceptions inside lambdas for <code>Function</code> or <code>Consumer</code>: their methods do not declare any, so you must handle them inside the lambda.</li>
</ul>
<h2>Check yourself</h2>
<p>Rewrite <code>s -&gt; s.isBlank()</code> and <code>() -&gt; new HashMap&lt;String, Integer&gt;()</code> as method references.</p>
<details><summary>Answer</summary><p><code>String::isBlank</code> and <code>HashMap::new</code> (with the target type, such as <code>Supplier&lt;Map&lt;String, Integer&gt;&gt;</code>, supplying the type arguments).</p></details>`,
          resources: [
            { title: 'Lambda expressions (dev.java)', url: 'https://dev.java/learn/lambdas/' },
            {
              title: 'java.util.function (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/function/package-summary.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Streams and Optional: processing data step by step',
          minutes: 24,
          html: `<p>"The names of learners scoring 75 or more, sorted." "How many learners per city?" "The best scorer, if there is one." With loops, each needs a variable, a loop and some <code>if</code> statements. With <strong>streams</strong>, you describe the steps — filter, transform, collect — and Java runs them. Stream code is short, readable once you know the vocabulary, and asked about in nearly every Java interview.</p>
<h2>A report in one pipeline per question</h2>
<pre><code class="language-java">import java.util.*;
import java.util.stream.*;

public class StreamReport {
    record Learner(String name, String city, int marks) { }

    public static void main(String[] args) {
        List&lt;Learner&gt; learners = List.of(
                new Learner("Asha", "Chennai", 91),
                new Learner("Ravi", "Pune", 67),
                new Learner("Zoya", "Chennai", 88),
                new Learner("Imran", "Kochi", 35),
                new Learner("Meena", "Pune", 74));

        List&lt;String&gt; toppers = learners.stream()
                .filter(l -&gt; l.marks() &gt;= 75)
                .map(Learner::name)
                .sorted()
                .toList();
        System.out.println("75 and above: " + toppers);

        double average = learners.stream().mapToInt(Learner::marks).average().orElse(0);
        System.out.printf("Average: %.1f%n", average);

        Map&lt;String, Long&gt; perCity = learners.stream()
                .collect(Collectors.groupingBy(Learner::city, TreeMap::new, Collectors.counting()));
        System.out.println("Per city: " + perCity);

        Map&lt;Boolean, List&lt;String&gt;&gt; passFail = learners.stream()
                .collect(Collectors.partitioningBy(l -&gt; l.marks() &gt;= 40,
                        Collectors.mapping(Learner::name, Collectors.toList())));
        System.out.println("Failed: " + passFail.get(false));

        String roll = learners.stream().map(Learner::name).collect(Collectors.joining(", ", "[", "]"));
        System.out.println(roll);

        Optional&lt;Learner&gt; best = learners.stream().max(Comparator.comparingInt(Learner::marks));
        System.out.println("Best: " + best.map(Learner::name).orElse("nobody"));

        Optional&lt;Learner&gt; fromDelhi = learners.stream().filter(l -&gt; l.city().equals("Delhi")).findFirst();
        System.out.println("From Delhi: " + fromDelhi.map(Learner::name).orElse("nobody"));

        System.out.println("1 to 10: " + IntStream.rangeClosed(1, 10).sum());
    }
}</code></pre>
<pre><code class="language-text">75 and above: [Asha, Zoya]
Average: 71.0
Per city: {Chennai=2, Kochi=1, Pune=2}
Failed: [Imran]
[Asha, Ravi, Zoya, Imran, Meena]
Best: Asha
From Delhi: nobody
1 to 10: 55</code></pre>
<h2>How a stream pipeline works</h2>
<ol>
<li>A <strong>source</strong>: <code>list.stream()</code>, <code>Arrays.stream(array)</code>, <code>Stream.of(...)</code>, <code>IntStream.range(...)</code>, <code>Files.lines(path)</code>.</li>
<li>Zero or more <strong>intermediate operations</strong>, each returning a new stream: <code>filter</code>, <code>map</code>, <code>sorted</code>, <code>distinct</code>, <code>limit</code>, <code>skip</code>, <code>flatMap</code>.</li>
<li>One <strong>terminal operation</strong> that produces a result: <code>toList</code>, <code>collect</code>, <code>count</code>, <code>sum</code>, <code>max</code>, <code>findFirst</code>, <code>anyMatch</code>, <code>forEach</code>, <code>reduce</code>.</li>
</ol>
<p>Streams are <strong>lazy</strong>: nothing happens until the terminal operation runs, and then elements flow through the steps one at a time, so <code>findFirst</code> can stop early. A stream can be used only once; a second terminal operation throws <code>IllegalStateException</code>. A stream never changes its source list.</p>
<p>For numbers, <code>mapToInt</code> gives an <code>IntStream</code> with <code>sum</code>, <code>average</code> and <code>max</code>, avoiding boxing. The <code>Collectors</code> class builds results: <code>groupingBy</code> (like SQL's GROUP BY), <code>partitioningBy</code> (two groups, true and false), <code>counting</code>, <code>joining</code>, <code>toMap</code>.</p>
<h2>Optional: an answer that may be missing</h2>
<p><code>max</code>, <code>min</code> and <code>findFirst</code> return an <code>Optional</code>, because an empty stream has no maximum. An <code>Optional</code> forces the caller to decide what "no answer" means instead of silently receiving <code>null</code>:</p>
<ul>
<li><code>orElse(value)</code> and <code>orElseGet(() -&gt; ...)</code> supply a fallback; <code>orElseThrow()</code> throws if empty.</li>
<li><code>map</code> transforms the value if present; <code>ifPresent</code> runs an action only if there is one.</li>
<li>Avoid calling <code>get()</code> without checking — it is just a <code>NullPointerException</code> with a different name.</li>
<li>Use <code>Optional</code> as a return type. Do not use it for fields, method parameters or collections.</li>
</ul>
<h2>Streams or loops?</h2>
<p>Use streams for transformations and aggregations like the ones above. Prefer a plain loop when you need to stop on complex conditions, update several variables at once, or throw checked exceptions. Avoid side effects inside stream steps — adding to an outside list from <code>map</code>, for example. <code>parallelStream()</code> exists, but only helps on large, CPU-heavy workloads; measure before using it.</p>
<h2>Check yourself</h2>
<p>What does <code>Stream.of("pune", "agra", "kochi").filter(s -&gt; s.length() == 4).map(String::toUpperCase).toList()</code> return?</p>
<details><summary>Answer</summary><p><code>[PUNE, AGRA]</code>. "kochi" has five letters and is filtered out; the rest are upper-cased in their original order.</p></details>`,
          resources: [
            {
              title: 'The Java Tutorials: Aggregate Operations (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/collections/streams/index.html',
            },
            {
              title: 'java.util.stream (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/stream/package-summary.html',
            },
            {
              title: 'Optional (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Optional.html',
            },
          ],
        },
        { kind: 'practice', question: 'java-stream-output' },
        { kind: 'practice', question: 'java-optional' },
        {
          kind: 'article',
          title: 'Dates and times with java.time',
          minutes: 18,
          html: `<p>Fee due dates, late fines, class timetables, exam schedules, a learner joining a live class from another country: dates and times appear in almost every business application. Since Java 8, the <code>java.time</code> package makes them clear and safe. Older code used <code>java.util.Date</code> and <code>Calendar</code>, which are mutable, count months from 0 and are easy to misuse; use <code>java.time</code> in all new code.</p>
<h2>A fee calendar</h2>
<pre><code class="language-java">import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

public class FeeCalendar {
    public static void main(String[] args) {
        LocalDate joined = LocalDate.of(2026, 7, 15);
        LocalDate firstDue = joined.plusMonths(1);
        LocalDate lastDay = joined.withDayOfMonth(joined.lengthOfMonth());
        System.out.println(firstDue + " " + firstDue.getDayOfWeek() + " " + lastDay);

        LocalDate paidOn = LocalDate.of(2026, 8, 27);
        long daysLate = ChronoUnit.DAYS.between(firstDue, paidOn);
        long lateFee = Math.max(0, daysLate) * 50;
        System.out.println("Days late: " + daysLate + ", late fee: Rs." + lateFee);

        Period course = Period.between(joined, LocalDate.of(2027, 1, 10));
        System.out.println("Course length: " + course.getMonths() + " months " + course.getDays() + " days");

        DateTimeFormatter indian = DateTimeFormatter.ofPattern("dd-MM-yyyy");
        LocalDate exam = LocalDate.parse("05-12-2026", indian);
        System.out.println(exam + " is shown as " + exam.format(indian));

        LocalDateTime classStart = LocalDateTime.of(2026, 10, 9, 18, 30);
        Duration length = Duration.ofMinutes(90);
        System.out.println("Class ends " + classStart.plus(length).toLocalTime());

        ZonedDateTime inChennai = classStart.atZone(ZoneId.of("Asia/Kolkata"));
        ZonedDateTime inLondon = inChennai.withZoneSameInstant(ZoneId.of("Europe/London"));
        System.out.println("For a learner in London: " + inLondon.toLocalTime());

        System.out.println(Year.isLeap(2028) + " " + LocalDate.of(2026, 2, 28).plusDays(1));
    }
}</code></pre>
<pre><code class="language-text">2026-08-15 SATURDAY 2026-07-31
Days late: 12, late fee: Rs.600
Course length: 5 months 26 days
2026-12-05 is shown as 05-12-2026
Class ends 20:00
For a learner in London: 14:00
true 2026-03-01</code></pre>
<h2>Pick the right type</h2>
<table>
<thead><tr><th scope="col">Type</th><th scope="col">Holds</th><th scope="col">Example use</th></tr></thead>
<tbody>
<tr><td><code>LocalDate</code></td><td>a date, no time or zone</td><td>date of birth, fee due date</td></tr>
<tr><td><code>LocalTime</code></td><td>a time of day</td><td>"class starts at 18:30"</td></tr>
<tr><td><code>LocalDateTime</code></td><td>date and time, no zone</td><td>a timetable slot in one city</td></tr>
<tr><td><code>ZonedDateTime</code></td><td>date, time and time zone</td><td>a live class seen from several countries</td></tr>
<tr><td><code>Instant</code></td><td>a point on the global timeline (UTC)</td><td>timestamps stored in databases and logs</td></tr>
<tr><td><code>Period</code> / <code>Duration</code></td><td>an amount of time in days-months-years / in hours-minutes-seconds</td><td>course length / class length</td></tr>
</tbody>
</table>
<h2>Rules that prevent bugs</h2>
<ul>
<li>Every <code>java.time</code> object is <strong>immutable</strong>. <code>date.plusDays(1)</code> returns a new date; on its own line, it does nothing.</li>
<li>Months run from 1 to 12, and <code>Month.JANUARY</code> and friends make code even clearer.</li>
<li>Month arithmetic clamps: <code>LocalDate.of(2026, 1, 31).plusMonths(1)</code> is 28 February 2026, not 3 March.</li>
<li>In format patterns, <code>MM</code> is the month and <code>mm</code> the minute; <code>yyyy</code> is the year, while <code>YYYY</code> is the "week-based year" and gives wrong results around New Year. Copy patterns carefully.</li>
<li>India has no daylight saving time, but other zones do. Store <code>Instant</code> values (UTC) and convert to the viewer's zone only when displaying. On 9 October 2026, London is on summer time, one hour ahead of UTC, which is why 18:30 in Chennai is 14:00 there.</li>
<li><code>LocalDate.now()</code> makes code hard to test. In real projects, pass in a <code>Clock</code> so tests can fix "today".</li>
</ul>
<h2>Check yourself</h2>
<p>A library book is issued on 25 December 2026 for 14 days. Write the expression for the due date, and say what it is.</p>
<details><summary>Answer</summary><p><code>LocalDate.of(2026, 12, 25).plusDays(14)</code>, which is 8 January 2027 — <code>java.time</code> handles the change of month and year for you.</p></details>`,
          resources: [
            { title: 'The Date Time API (dev.java)', url: 'https://dev.java/learn/date-time/' },
            {
              title: 'java.time (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/time/package-summary.html',
            },
            {
              title: 'DateTimeFormatter (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/time/format/DateTimeFormatter.html',
            },
          ],
        },
      ],
    },
    {
      title: 'Java for interviews',
      summary:
        'Threads and thread safety, memory and garbage collection, the core Java questions interviewers ask most, and a plan for solving coding rounds in Java under time pressure.',
      lessons: [
        {
          kind: 'article',
          title: 'Threads, race conditions and thread safety',
          minutes: 24,
          html: `<p>A web server handles hundreds of requests at once; a payment app checks balance, fraud rules and offers in parallel. Each runs on a <strong>thread</strong>, an independent path of execution inside one program. Threads share memory, which makes them powerful and dangerous. Interviews for Java roles almost always include a few concurrency questions, so this lesson covers the essentials precisely.</p>
<h2>The race condition</h2>
<pre><code class="language-java">class UnsafeCounter {
    private int count = 0;

    void increment() {
        count++;          // read, add one, write back: three steps, not one
    }

    int get() {
        return count;
    }
}</code></pre>
<p>If two threads each call <code>increment()</code> 100,000 times, the final count is usually <em>less</em> than 200,000, and different on every run. Here is how one update gets lost:</p>
<table>
<thead><tr><th scope="col">Step</th><th scope="col">Thread A</th><th scope="col">Thread B</th><th scope="col">count</th></tr></thead>
<tbody>
<tr><td>1</td><td>reads 41</td><td></td><td>41</td></tr>
<tr><td>2</td><td></td><td>reads 41</td><td>41</td></tr>
<tr><td>3</td><td>writes 42</td><td></td><td>42</td></tr>
<tr><td>4</td><td></td><td>writes 42</td><td>42</td></tr>
</tbody>
</table>
<p>Two increments ran, but the count rose by one. Any shared, changing data accessed by several threads without coordination can break like this.</p>
<h2>Fixing it, and using threads properly</h2>
<pre><code class="language-java">import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

public class SafeCounters {
    private static int syncCount = 0;
    private static final Object lock = new Object();
    private static final AtomicInteger atomicCount = new AtomicInteger();

    public static void main(String[] args) throws Exception {
        Runnable work = () -&gt; {
            for (int i = 0; i &lt; 100_000; i++) {
                synchronized (lock) {        // one thread at a time in this block
                    syncCount++;
                }
                atomicCount.incrementAndGet(); // a single atomic step
            }
        };
        Thread t1 = new Thread(work);
        Thread t2 = new Thread(work);
        t1.start();
        t2.start();
        t1.join();                           // wait for both to finish
        t2.join();
        System.out.println(syncCount + " " + atomicCount.get());

        try (ExecutorService pool = Executors.newFixedThreadPool(4)) {
            List&lt;Future&lt;Long&gt;&gt; parts = new ArrayList&lt;&gt;();
            for (int part = 0; part &lt; 4; part++) {
                long from = part * 250_000L + 1;
                long to = from + 249_999;
                parts.add(pool.submit(() -&gt; sumRange(from, to)));
            }
            long total = 0;
            for (Future&lt;Long&gt; f : parts) {
                total += f.get();            // waits for that task's result
            }
            System.out.println("Sum 1..1,000,000 = " + total);
        }

        try (ExecutorService virtual = Executors.newVirtualThreadPerTaskExecutor()) {
            Future&lt;String&gt; reply = virtual.submit(() -&gt;
                    "hello from a " + (Thread.currentThread().isVirtual() ? "virtual" : "platform") + " thread");
            System.out.println(reply.get());
        }
    }

    static long sumRange(long from, long to) {
        long sum = 0;
        for (long n = from; n &lt;= to; n++) {
            sum += n;
        }
        return sum;
    }
}</code></pre>
<pre><code class="language-text">200000 200000
Sum 1..1,000,000 = 500000500000
hello from a virtual thread</code></pre>
<h2>The tools, and when to use each</h2>
<ul>
<li><code>synchronized</code> lets only one thread at a time run a block guarded by the same lock object, and guarantees that changes made inside are visible to the next thread that takes the lock.</li>
<li><strong>Atomic classes</strong> (<code>AtomicInteger</code>, <code>AtomicLong</code>) make single operations such as increment indivisible, without locking.</li>
<li><code>volatile</code> makes every read see the latest write to a field, but it does <em>not</em> make <code>count++</code> atomic. Use it for simple flags, such as "stop requested".</li>
<li><strong>Concurrent collections</strong> — <code>ConcurrentHashMap</code>, <code>CopyOnWriteArrayList</code>, <code>BlockingQueue</code> — are built for sharing between threads.</li>
<li>An <code>ExecutorService</code> manages a pool of threads for you. Submit tasks; get <code>Future</code> results. Since Java 19 it can be closed with try-with-resources, which waits for submitted tasks.</li>
<li><strong>Virtual threads</strong> (Java 21) are lightweight threads managed by the JVM. You can run many thousands of them, which suits servers that spend most of their time waiting on databases and networks. They do not make number-crunching faster.</li>
</ul>
<h2>Classic interview points</h2>
<ul>
<li><code>start()</code> creates a new thread that runs <code>run()</code>; calling <code>run()</code> directly just runs it on the current thread. Starting the same thread twice throws <code>IllegalThreadStateException</code>.</li>
<li><code>join()</code> waits for a thread to finish.</li>
<li>A <strong>deadlock</strong> happens when thread A holds lock 1 and waits for lock 2 while thread B holds lock 2 and waits for lock 1. Prevent it by always taking locks in the same order.</li>
<li>Immutable objects — strings, records with immutable fields — are thread-safe without any locking.</li>
</ul>
<h2>Check yourself</h2>
<p>Would marking <code>count</code> as <code>volatile</code> fix <code>UnsafeCounter</code>?</p>
<details><summary>Answer</summary><p>No. <code>volatile</code> guarantees visibility, but <code>count++</code> is still a separate read, add and write, so two threads can still interleave and lose updates. Use <code>AtomicInteger</code> or <code>synchronized</code>.</p></details>`,
          resources: [
            {
              title: 'The Java Tutorials: Concurrency (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/essential/concurrency/index.html',
            },
            {
              title: 'Virtual threads (Java SE 21)',
              url: 'https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html',
            },
          ],
        },
        { kind: 'practice', question: 'java-thread-safety' },
        {
          kind: 'article',
          title: 'Memory: the stack, the heap and garbage collection',
          minutes: 18,
          html: `<p>"Where are objects stored?", "When is an object garbage collected?", "What is the difference between <code>StackOverflowError</code> and <code>OutOfMemoryError</code>?" These questions test whether you understand what your code does to memory. The answers also help you fix real production problems, from slow services to crashes.</p>
<h2>Two areas: stack and heap</h2>
<ul>
<li>Each thread has its own <strong>stack</strong>. Every method call pushes a <strong>frame</strong> holding that call's parameters and local variables; the frame disappears when the method returns. Primitive locals live here directly; object locals hold only a <em>reference</em>.</li>
<li>The <strong>heap</strong> is shared by all threads. Every object and array created with <code>new</code> — and every string — lives here, for as long as something refers to it.</li>
</ul>
<pre><code class="language-java">public class MemoryPicture {
    record Ticket(String passenger, int seats) { }

    static Ticket book(String passenger, int seats) {
        Ticket t = new Ticket(passenger, seats);   // object on the heap, reference in book's frame
        return t;                                   // book's frame goes; the object stays
    }

    public static void main(String[] args) {
        int seats = 2;                    // a primitive, stored in main's frame
        String name = "Asha";             // reference in the frame, String on the heap
        int[] marks = {80, 90};           // reference in the frame, array on the heap
        Ticket ticket = book(name, seats);
        System.out.println(ticket + " " + marks.length);
        ticket = null;                    // the Ticket is now unreachable
    }
}</code></pre>
<pre><code class="language-text">Ticket[passenger=Asha, seats=2] 2</code></pre>
<p>Just before <code>ticket = null</code>, memory looks like this:</p>
<pre><code class="language-text">STACK: main's frame             HEAP
seats  = 2
name   -----------------------&gt; "Asha"  (String, in the string pool)
marks  -----------------------&gt; int[] {80, 90}
ticket -----------------------&gt; Ticket[passenger=Asha, seats=2]</code></pre>
<h2>Garbage collection</h2>
<p>The garbage collector (GC) starts from the <strong>roots</strong> — local variables in every thread's stack, static fields, and a few JVM internals — and follows references. Anything it cannot reach is garbage, and its memory is reclaimed. After <code>ticket = null</code>, nothing reaches the <code>Ticket</code>, so it is <em>eligible</em> for collection; exactly when the GC runs is up to the JVM.</p>
<ul>
<li>Most objects die young, so the heap is split into generations: a young area collected often and cheaply, and an old area for long-lived objects.</li>
<li>G1 is the default collector on typical servers; ZGC offers very short pauses for large heaps, and Java 21 added a generational mode for it.</li>
<li><code>System.gc()</code> is only a hint. <code>finalize()</code> is deprecated; release resources with try-with-resources instead.</li>
<li>The string pool has lived in the heap since Java 7.</li>
</ul>
<h2>When memory runs out</h2>
<table>
<thead><tr><th scope="col">Error</th><th scope="col">Usual cause</th><th scope="col">First step</th></tr></thead>
<tbody>
<tr><td><code>StackOverflowError</code></td><td>recursion that never stops, or is far too deep</td><td>check the base case; convert deep recursion to a loop</td></tr>
<tr><td><code>OutOfMemoryError: Java heap space</code></td><td>too much live data, or a leak</td><td>take a heap dump and see what holds the memory</td></tr>
</tbody>
</table>
<p>Java has garbage collection, yet it can still leak: objects stay reachable when you no longer need them. Typical culprits are static collections that only grow, caches without a size limit, listeners that are never removed, and resources that are never closed. Useful JVM options: <code>-Xmx</code> sets the maximum heap (<code>-Xmx512m</code>), <code>-Xss</code> the stack size per thread, and <code>-XX:+HeapDumpOnOutOfMemoryError</code> writes a heap dump when the heap runs out. The JDK's <code>jcmd</code> tool can print thread dumps and heap statistics from a running program.</p>
<h2>Check yourself</h2>
<p>A method creates a large <code>ArrayList</code>, stores it in a local variable, and returns nothing. Is the list eligible for GC after the method returns?</p>
<details><summary>Answer</summary><p>Yes, as long as no reference escaped — for example into a static field or a returned object. The only reference lived in the method's stack frame, which is gone.</p></details>`,
          resources: [
            {
              title: 'Garbage Collection Tuning Guide (Java SE 21)',
              url: 'https://docs.oracle.com/en/java/javase/21/gctuning/index.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Core Java questions interviewers ask most',
          minutes: 25,
          html: `<p>Technical rounds for Java roles return to the same core questions again and again. Knowing them is not about memorising lines; it is about giving a crisp definition, a small example and the trade-off — in that order. Try to answer each question aloud before opening the model answer, and keep your own answer under a minute.</p>
<h2>The language</h2>
<details><summary>1. Is Java a purely object-oriented language?</summary><p>No. It has eight primitive types that are not objects, and static members that belong to no object. Wrapper classes and autoboxing bridge primitives into the object world when needed, for example in collections.</p></details>
<details><summary>2. What is the difference between == and equals()?</summary><p><code>==</code> compares primitive values, or, for objects, whether two references point to the same object. <code>equals()</code> compares logical content, as each class defines it; <code>String</code>, the wrappers and records compare their data. Always compare strings and wrapper objects with <code>equals()</code>.</p></details>
<details><summary>3. final, finally and finalize — what is each?</summary><p><code>final</code> is a modifier: a final variable is assigned once, a final method cannot be overridden, a final class cannot be extended. <code>finally</code> is the block after <code>try</code> that runs whether or not an exception occurred. <code>finalize()</code> is an old <code>Object</code> method the garbage collector could call before reclaiming an object; it is deprecated, and try-with-resources replaces it.</p></details>
<pre><code class="language-java">final int maxSeats = 72;            // final: cannot be reassigned
try {
    int requested = Integer.parseInt("seventy");
    System.out.println(requested &lt;= maxSeats);
} catch (NumberFormatException e) {
    System.out.println("Not a number: " + e.getMessage());
} finally {
    System.out.println("finally runs either way");
}</code></pre>
<details><summary>4. Why is String immutable, and what is the string pool?</summary><p>The pool stores one shared copy of each string literal, which is only safe because strings cannot change. Immutability also makes strings safe to share between threads, safe to use as map keys (the hash code is cached), and safe for security-sensitive values such as file paths. Use <code>StringBuilder</code> to build strings; <code>StringBuffer</code> is its older synchronized twin.</p></details>
<details><summary>5. Can you override a static method or a private method? Can you overload main?</summary><p>No to both: a static method with the same signature in a subclass <em>hides</em> the parent's (chosen by declared type), and a private method is invisible to subclasses. Yes, <code>main</code> can be overloaded, but the JVM only calls <code>public static void main(String[] args)</code>.</p></details>
<h2>Object-oriented design</h2>
<details><summary>6. What are the four pillars of OOP? Give a Java example of each.</summary><p>Encapsulation: private fields with validating methods. Inheritance: <code>class CardPayment extends Payment</code>. Polymorphism: a <code>Payment</code> reference calling the subclass's <code>fee()</code> at run time. Abstraction: callers use an interface such as <code>List</code> without knowing it is an <code>ArrayList</code>.</p></details>
<details><summary>7. Overloading versus overriding?</summary><p>Overloading: same name, different parameter lists, in the same class; chosen by the compiler (compile-time polymorphism). Overriding: a subclass redefines an inherited method with the same signature; chosen at run time from the object's class (run-time polymorphism).</p></details>
<details><summary>8. Abstract class versus interface?</summary><p>An abstract class can hold state and constructors, and a class extends only one. An interface defines a capability; since Java 8 it can have default and static methods, but no instance state, and a class can implement many. Prefer interfaces for types, and abstract classes to share code among close relatives.</p></details>
<h2>Collections and exceptions</h2>
<details><summary>9. How does HashMap work internally?</summary><p>It hashes the key to choose a bucket in an array, then uses <code>equals</code> to find the key among the entries in that bucket. It resizes when it passes 75% full, and since Java 8 turns crowded buckets into balanced trees. Average <code>get</code> and <code>put</code> are O(1), which depends on keys with consistent <code>equals</code> and <code>hashCode</code>.</p></details>
<details><summary>10. HashMap, Hashtable or ConcurrentHashMap?</summary><p><code>HashMap</code> is not thread-safe and allows one null key. <code>Hashtable</code> is a legacy class that locks the whole table on every call and allows no nulls. <code>ConcurrentHashMap</code> is the modern thread-safe map: it allows concurrent reads and updates to different parts, and also rejects nulls.</p></details>
<details><summary>11. Fail-fast versus fail-safe iterators?</summary><p>Iterators of <code>ArrayList</code> and <code>HashMap</code> are fail-fast: if the collection is structurally changed during iteration (except through the iterator), they throw <code>ConcurrentModificationException</code>. Iterators of concurrent collections such as <code>CopyOnWriteArrayList</code> and <code>ConcurrentHashMap</code> do not throw; they work on a snapshot or a weakly consistent view.</p></details>
<details><summary>12. Checked versus unchecked exceptions?</summary><p>Checked exceptions (subclasses of <code>Exception</code> but not <code>RuntimeException</code>) must be caught or declared; they model recoverable conditions such as a missing file. Unchecked exceptions (<code>RuntimeException</code> and its subclasses) usually signal programming errors such as a null reference, and the compiler does not force handling.</p></details>
<details><summary>13. Comparable versus Comparator?</summary><p><code>Comparable</code> is implemented by the class itself (<code>compareTo</code>) and defines its one natural order. A <code>Comparator</code> is a separate object defining any other order, and modern Java builds them with <code>Comparator.comparing(...)</code>.</p></details>
<h2>Modern Java</h2>
<details><summary>14. Which recent Java features have you used?</summary><p>A good answer names a few with a sentence each: records for data classes, switch expressions and pattern matching for clearer branching, text blocks for SQL and JSON, sealed interfaces for closed hierarchies, and virtual threads for servers that wait on I/O. Mentioning that your projects use Java 21 shows you are current.</p></details>
<h2>How to answer well</h2>
<ul>
<li>Lead with a one-sentence definition, then give a tiny example — ideally from a project you built.</li>
<li>Mention the trade-off or the "when would you not use it", which is where most candidates stop short.</li>
<li>If you do not know, say how you would find out. Guessing confidently is worse than an honest "I have not used it, but I would expect…".</li>
</ul>`,
          resources: [
            {
              title: 'The Java Tutorials: Learning the Java Language (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/java/index.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Cracking the Java coding round',
          minutes: 22,
          html: `<p>Most IT hiring drives include an online coding round: two or three problems, 60 to 90 minutes, automatic judging. Strong candidates fail it not for lack of knowledge but because of slow input reading, a wrong output format, an overflow, or poor use of time. This lesson gives you a Java toolkit and a plan so none of that happens to you.</p>
<h2>A plan for the round</h2>
<ol>
<li>Spend the first five minutes reading <em>every</em> problem and its limits. Start with the one you are most confident about.</li>
<li>From the limits, decide the Big-O you need: n up to 10<sup>5</sup> rules out O(n²); n up to 20 may allow trying every subset.</li>
<li>Work the sample by hand before coding, and write down two edge cases of your own.</li>
<li>If the clever solution does not come, submit a correct brute force first. Many platforms award partial marks for the tests it passes.</li>
<li>Test with the samples and your edge cases, then submit. Time-box each problem so one stubborn bug does not cost you the round.</li>
</ol>
<h2>Fast input and output</h2>
<p><code>Scanner</code> is convenient but slow on very large inputs. <code>BufferedReader</code> reads whole lines quickly, and a <code>StringTokenizer</code> splits them. Collect output and print it once:</p>
<pre><code class="language-java">import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.util.StringTokenizer;

public class FastIO {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(in.readLine().trim());
        StringTokenizer st = new StringTokenizer(in.readLine());
        long sum = 0;
        int max = Integer.MIN_VALUE;
        for (int i = 0; i &lt; n; i++) {
            int x = Integer.parseInt(st.nextToken());
            sum += x;
            max = Math.max(max, x);
        }
        PrintWriter out = new PrintWriter(System.out);
        out.println(sum);
        out.println(max);
        out.flush();                 // nothing appears until you flush
    }
}</code></pre>
<p>For the input below it prints <code>19</code> and then <code>9</code>.</p>
<pre><code class="language-text">5
4 -2 9 7 1</code></pre>
<h2>Your Java toolkit</h2>
<table>
<thead><tr><th scope="col">Need</th><th scope="col">Reach for</th></tr></thead>
<tbody>
<tr><td>sort numbers or objects</td><td><code>Arrays.sort</code>, <code>list.sort(Comparator.comparing(...))</code></td></tr>
<tr><td>count things</td><td><code>map.merge(key, 1, Integer::sum)</code>, or <code>int[26]</code> for letters</td></tr>
<tr><td>seen before? where?</td><td><code>HashSet</code>, <code>HashMap</code></td></tr>
<tr><td>stack or queue</td><td><code>ArrayDeque</code></td></tr>
<tr><td>always the smallest or largest next</td><td><code>PriorityQueue</code></td></tr>
<tr><td>nearest key, ranges</td><td><code>TreeMap.floorKey</code>, <code>ceilingKey</code></td></tr>
<tr><td>build output or strings</td><td><code>StringBuilder</code></td></tr>
<tr><td>very large numbers</td><td><code>long</code>; <code>BigInteger</code> beyond that</td></tr>
<tr><td>remainder of a negative number</td><td><code>Math.floorMod(a, m)</code></td></tr>
</tbody>
</table>
<h2>Bugs that cost marks</h2>
<ul>
<li><strong>Overflow</strong>: sums and products of <code>int</code> values silently wrap. If the total can pass about two billion, use <code>long</code> — and cast before multiplying: <code>(long) a * b</code>.</li>
<li><strong>Comparing <code>Integer</code> objects with <code>==</code></strong>, which works for small values and fails above 127. Unbox or use <code>equals</code>.</li>
<li><strong>Output format</strong>: extra spaces, missing new lines, "Answer:" prefixes or leftover debug prints all fail an exact-match judge.</li>
<li><strong>Edge cases</strong>: n = 0 or 1, all values equal, negative numbers, already sorted or reverse-sorted input, the maximum allowed size.</li>
<li><strong>Deep recursion</strong> on large inputs can overflow the stack; an iterative version is safer.</li>
<li><strong>Building strings with <code>+=</code> in a loop</strong> turns an O(n) solution into O(n²).</li>
<li><strong>Class name</strong>: many judges require <code>public class Main</code>. Read the platform's instructions.</li>
</ul>
<h2>Check yourself</h2>
<p>You must multiply two values that can each be up to 10<sup>6</sup> and are read into <code>int</code> variables <code>a</code> and <code>b</code>. What is wrong with <code>long product = a * b;</code>?</p>
<details><summary>Answer</summary><p><code>a * b</code> is calculated in <code>int</code> arithmetic and overflows (10<sup>12</sup> is far beyond the <code>int</code> limit) <em>before</em> the result is widened to <code>long</code>. Write <code>long product = (long) a * b;</code>.</p></details>`,
          resources: [
            {
              title: 'BufferedReader (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/io/BufferedReader.html',
            },
          ],
        },
        { kind: 'practice', question: 'java-longest-unique-substring' },
      ],
    },
  ],
  assignments: [
    'Java Foundations: First Programs',
    'Core Java: Objects and Collections',
    'Company Round Practice: Java',
  ],
  tests: [
    {
      title: 'Core Java — on-demand practice test',
      kind: 'practice',
      description:
        'A self-check across the whole course that you can take at any time: the JVM, classes and inheritance, strings, collections, exceptions, streams and threads. Use it to find weak topics, revisit those lessons, and retake it until every answer is right.',
      durationMinutes: 30,
      sections: [
        {
          title: 'Language and objects',
          questions: [
            'java-jdk-jre-jvm',
            'java-final-class',
            'java-string-equals',
            'java-string-immutable',
            'java-overloading-vs-overriding',
            'java-interface-default',
            'java-record',
          ],
        },
        {
          title: 'Collections and generics',
          questions: [
            'java-arraylist-vs-linkedlist',
            'java-hashmap-order',
            'java-equals-hashcode',
            'java-generics-erasure',
          ],
        },
        {
          title: 'Exceptions, streams and threads',
          questions: [
            'java-checked-exceptions',
            'java-finally',
            'java-stream-output',
            'java-optional',
            'java-thread-safety',
          ],
        },
      ],
    },
    {
      title: 'Core Java — company round mock test',
      kind: 'mock',
      description:
        'A timed rehearsal of a typical IT company written round: a short aptitude section, technical multiple-choice questions on Java and problem solving, and two written answers that your trainer marks. Sit it in one go, without notes, exactly as you would on drive day.',
      durationMinutes: 60,
      sections: [
        {
          title: 'Aptitude',
          questions: ['aptitude-percentage', 'aptitude-time-work', 'aptitude-series'],
        },
        {
          title: 'Technical',
          questions: [
            'java-string-equals',
            'java-overloading-vs-overriding',
            'java-equals-hashcode',
            'java-hashmap-order',
            'java-checked-exceptions',
            'java-stream-output',
            'java-thread-safety',
            'dsa-nested-loop-cost',
            'dsa-binary-search-cost',
            'dsa-hashmap-cost',
          ],
        },
        {
          title: 'Written',
          questions: ['java-explain-polymorphism', 'java-explain-hashmap'],
        },
      ],
    },
  ],
};
