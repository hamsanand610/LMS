import type { CurriculumCourse } from './types.js';

export const COURSE: CurriculumCourse = {
  slug: 'programming-foundations',
  title: 'Programming Foundations',
  subject: 'programming',
  level: 'beginner',
  description:
    'Start from zero and learn to think like a programmer. You turn problems into clear steps, write and run Java 21 programs, work with numbers, decisions, loops, methods, arrays, strings, lists and maps, and finish with the searching, sorting and Big-O thinking that placement coding rounds test.',
  tags: ['programming', 'problem-solving', 'java', 'algorithms', 'beginner', 'placement'],
  modules: [
    {
      title: 'Thinking like a programmer',
      summary:
        'What a program is, how to turn a problem into clear steps, and how to write, compile and run your first Java 21 programs that read input and print results.',
      lessons: [
        {
          kind: 'article',
          title: 'What a program is and how Java runs it',
          minutes: 10,
          html: `<p>Every app you use — the railway booking site, your bank's UPI app, the marks portal at college — is a program: a list of precise instructions that a computer follows. In this lesson you will see what that really means, and how a Java program goes from text you type to something your computer can run.</p>
<h2>Instructions, not intelligence</h2>
<p>A computer is fast and tireless, but it does exactly what it is told and nothing more. If you ask a friend to "get some snacks for the match", they fill in the gaps themselves. A computer cannot. It needs every step spelled out: which shop, how much money, and what to do if the shop is closed.</p>
<p>That is why programming is less about typing and more about <strong>thinking clearly</strong>. The hard part is deciding the steps. Writing them in Java is the easier part once the steps are right.</p>
<h2>Input, processing, output</h2>
<p>Almost every program has the same shape:</p>
<ul>
<li><strong>Input</strong>: data comes in — numbers you type, a file, a tap on the screen.</li>
<li><strong>Processing</strong>: the program calculates, compares, sorts or searches.</li>
<li><strong>Output</strong>: a result goes out — text on the screen, a saved file, a message.</li>
</ul>
<p>A marks calculator, for example, takes five subject marks as input, adds them and works out the percentage, and prints the total and the grade. When you meet a new problem, ask three questions first: what comes in, what must happen to it, and what must come out?</p>
<h2>From Java source to a running program</h2>
<p>The processor inside your laptop only understands machine code: long sequences of numbers that differ between Intel, AMD and ARM chips. Nobody writes that by hand. You write <strong>source code</strong> in a language like Java, which people can read, and tools translate it.</p>
<p>Java uses two steps:</p>
<ol>
<li>The <strong>compiler</strong>, <code>javac</code>, checks your source file and translates it into <strong>bytecode</strong>, stored in a <code>.class</code> file. If you made a grammar mistake, such as a missing semicolon, the compiler stops and tells you the line.</li>
<li>The <strong>Java Virtual Machine</strong> (JVM), started with the <code>java</code> command, loads that bytecode and runs it, turning the busiest parts into fast machine code while the program runs.</li>
</ol>
<pre><code class="language-text">Hello.java  --javac--&gt;  Hello.class (bytecode)  --java (JVM)--&gt;  output on the screen</code></pre>
<p>Every operating system has its own JVM, so the same <code>.class</code> file runs on Windows, Linux and macOS. This portability is one reason Java is used so widely in banks, insurance companies and large IT services firms.</p>
<h2>JDK, JRE and JVM in one line each</h2>
<ul>
<li><strong>JVM</strong>: the engine that runs bytecode.</li>
<li><strong>JRE</strong>: a JVM plus the standard libraries a program needs while it runs.</li>
<li><strong>JDK</strong>: everything needed to run Java plus the developer tools — <code>javac</code>, <code>jshell</code> and more. As a developer, you install the JDK.</li>
</ul>
<p>In this course you use <strong>Java 21</strong>, a long-term support (LTS) release that companies run in production.</p>
<h2>Check yourself</h2>
<ol>
<li>Name the input, processing and output of a program that prints a shop bill.</li>
<li>Which tool reports a missing semicolon: <code>javac</code> or the JVM?</li>
<li>Why can one <code>.class</code> file run on both Windows and Linux?</li>
</ol>
<details><summary>Answers</summary>
<p>1. Input: items, quantities and prices. Processing: multiply and add, then apply any discount or GST. Output: the printed bill with the total.</p>
<p>2. <code>javac</code>. Grammar mistakes are compile-time errors, so the program never reaches the JVM.</p>
<p>3. The file holds bytecode, not machine code, and each operating system has a JVM that understands the same bytecode.</p>
</details>
<p><strong>Interview tip:</strong> "Is Java compiled or interpreted?" is a favourite question. A strong answer is "both": <code>javac</code> compiles source code to bytecode, and the JVM interprets that bytecode and compiles the frequently used parts to machine code at run time (just-in-time compilation).</p>`,
          resources: [
            {
              title: 'The Java Tutorials: Getting Started (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/getStarted/index.html',
            },
            { title: 'Learn Java (dev.java)', url: 'https://dev.java/learn/' },
          ],
        },
        {
          kind: 'article',
          title: 'From problem to steps: algorithms, pseudocode and dry runs',
          minutes: 15,
          html: `<p>Before you write a single line of Java, you need a plan. Programmers call such a plan an <strong>algorithm</strong>: a finite list of clear steps that solves a problem for every valid input. In this lesson you build one and test it with nothing more than pen and paper.</p>
<h2>A worked problem: the shop bill</h2>
<p>A stationery shop gives 10% off when a bill reaches ₹1,000 or more. Given the bill amount, print the amount the customer pays.</p>
<p>Start in plain English, the way you would explain it to a friend:</p>
<ol>
<li>Read the bill amount.</li>
<li>If the amount is 1,000 or more, take 10% off.</li>
<li>Otherwise, leave it as it is.</li>
<li>Print the amount to pay.</li>
</ol>
<p>Notice what the steps do <em>not</em> mention: Java, variables or semicolons. Get the logic right first; the syntax can wait.</p>
<h2>Pseudocode: halfway to code</h2>
<p>Pseudocode is structured English. It looks a little like a program but ignores the strict rules of any one language:</p>
<pre><code class="language-text">READ amount
IF amount &gt;= 1000 THEN
    pay = amount - amount * 10 / 100
ELSE
    pay = amount
END IF
PRINT pay</code></pre>
<p>A <strong>flowchart</strong> shows the same plan as shapes and arrows: a parallelogram for input and output, a rectangle for a calculation, and a diamond for a yes-or-no question. Use whichever helps you think. In interviews you are often asked to talk through pseudocode before coding.</p>
<p>Here is the plan in Java. You will learn every piece of it in the next module, but see how closely it follows the pseudocode:</p>
<pre><code class="language-java">public class ShopBill {
    public static void main(String[] args) {
        double amount = 1250.0;
        double pay;
        if (amount &gt;= 1000) {
            pay = amount - amount * 10 / 100;
        } else {
            pay = amount;
        }
        System.out.println("Amount to pay: " + pay);
    }
}</code></pre>
<pre><code class="language-text">Amount to pay: 1125.0</code></pre>
<h2>Dry runs: testing on paper</h2>
<p>A <strong>dry run</strong> means following your steps by hand with sample inputs and writing down every value. It catches mistakes before the computer does. Pick ordinary values, and also <strong>edge cases</strong>: values on a boundary or at an extreme.</p>
<table>
<thead><tr><th scope="col">amount</th><th scope="col">amount &gt;= 1000?</th><th scope="col">pay</th></tr></thead>
<tbody>
<tr><td>450</td><td>no</td><td>450</td></tr>
<tr><td>999.99</td><td>no</td><td>999.99</td></tr>
<tr><td>1000</td><td>yes</td><td>900</td></tr>
<tr><td>2500</td><td>yes</td><td>2250</td></tr>
</tbody>
</table>
<p>The row for exactly 1,000 matters most. Had you written "more than 1,000" instead of "1,000 or more", that customer would miss the discount. Mistakes at boundaries are among the most common bugs in real software.</p>
<h2>What makes a good algorithm</h2>
<ul>
<li><strong>Clear</strong>: each step has exactly one meaning.</li>
<li><strong>Finite</strong>: it always stops.</li>
<li><strong>Correct</strong>: it gives the right answer for every valid input, including the edges.</li>
<li><strong>Efficient enough</strong>: it finishes in reasonable time for the input sizes you expect. You will learn to measure this at the end of the course.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Typing code before you can explain the steps aloud.</li>
<li>Testing only the "happy" input and forgetting zero, negative numbers, empty input or the exact boundary.</li>
<li>Writing a step that needs a human to fill a gap, such as "find the biggest" without saying how.</li>
</ul>
<h2>Check yourself</h2>
<p>Write plain-English steps that find the highest of three cricket scores, then dry-run them with 45, 72 and 72.</p>
<details><summary>One possible answer</summary>
<ol>
<li>Read the three scores a, b and c.</li>
<li>Set highest to a.</li>
<li>If b is greater than highest, set highest to b.</li>
<li>If c is greater than highest, set highest to c.</li>
<li>Print highest.</li>
</ol>
<p>Dry run: highest starts at 45, becomes 72 at step 3, and stays 72 at step 4 because 72 is not greater than 72. The output is 72, so a tie causes no trouble.</p>
</details>`,
        },
        {
          kind: 'article',
          title: 'Writing, compiling and running your first Java program',
          minutes: 20,
          html: `<p>Time to make the computer do something. In this lesson you set up Java 21, write a small program, compile and run it, and learn to read the error messages you will certainly meet along the way.</p>
<h2>Set up once</h2>
<p>Install a <strong>JDK 21</strong> build (Oracle JDK or an OpenJDK build such as Eclipse Temurin). Then open a terminal (Command Prompt or PowerShell on Windows) and check both tools:</p>
<pre><code class="language-text">java -version
javac -version</code></pre>
<p>Both should report version 21. If Windows says a command is not recognised, the JDK's <code>bin</code> folder is not on your <code>PATH</code>; fix that before going further. Later you will work in an IDE such as IntelliJ IDEA or VS Code, but running the tools by hand once shows you what the IDE does for you.</p>
<h2>Your first program</h2>
<p>Create a folder and, inside it, a file named exactly <code>Hello.java</code>:</p>
<pre><code class="language-java">public class Hello {
    public static void main(String[] args) {
        System.out.println("Welcome to SI Academy!");
        System.out.println("Let us write some Java.");
    }
}</code></pre>
<p>Compile it, then run it:</p>
<pre><code class="language-text">&gt; javac Hello.java
&gt; java Hello
Welcome to SI Academy!
Let us write some Java.</code></pre>
<p><code>javac</code> created <code>Hello.class</code> next to your source file, and <code>java Hello</code> (no <code>.java</code>, no <code>.class</code>) asked the JVM to run that class. For a program in a single file you may also run <code>java Hello.java</code>: the launcher compiles the file in memory and runs it straight away.</p>
<h2>Reading the program line by line</h2>
<ul>
<li><code>public class Hello</code>: all Java code lives inside a class. A <code>public</code> class must be in a file with the same name, so <code>Hello</code> goes in <code>Hello.java</code>.</li>
<li><code>public static void main(String[] args)</code>: the <strong>entry point</strong>, where the JVM starts. Type it exactly; you will understand every word by the end of Core Java.</li>
<li><code>System.out.println(...)</code> prints its argument and moves to a new line. <code>System.out.print(...)</code> prints without moving to a new line.</li>
<li>Curly braces <code>{ }</code> group code, and each statement ends with a semicolon.</li>
<li>Text between double quotes is a <strong>string</strong>, printed exactly as written.</li>
</ul>
<h2>Printing numbers and text together</h2>
<p>The <code>+</code> sign adds numbers, but it joins text when either side is a string. Java works from left to right, which surprises many beginners:</p>
<pre><code class="language-java">public class Scoreboard {
    public static void main(String[] args) {
        System.out.print("India ");
        System.out.println("287/6");
        System.out.println(287 + 13);
        System.out.println("Total: " + 287 + 13);
        System.out.println("Total: " + (287 + 13));
    }
}</code></pre>
<pre><code class="language-text">India 287/6
300
Total: 28713
Total: 300</code></pre>
<p>On the fourth line, <code>"Total: " + 287</code> becomes the text <code>"Total: 287"</code>, and adding 13 to text simply sticks <code>13</code> on the end. Brackets make the sum happen first.</p>
<h2>When it goes wrong</h2>
<p>You will see compile errors every day, and that is normal. Read the <strong>first</strong> error first, because later ones are often caused by it:</p>
<pre><code class="language-text">Hello.java:3: error: ';' expected
        System.out.println("Welcome to SI Academy!")
                                                    ^
1 error</code></pre>
<ul>
<li><strong>';' expected</strong>: a missing semicolon at the end of the line shown.</li>
<li><strong>class Hello is public, should be declared in a file named Hello.java</strong>: the file and class names differ. Names are case-sensitive, so <code>hello.java</code> is not <code>Hello.java</code>.</li>
<li><strong>cannot find symbol</strong>: a misspelt name, such as <code>system.out</code> instead of <code>System.out</code>, or <code>printIn</code> (capital i) instead of <code>println</code> (small L).</li>
<li><strong>unclosed string literal</strong>: a missing closing quote.</li>
</ul>
<h2>Try ideas quickly with jshell</h2>
<p>The JDK includes <code>jshell</code>, where you type a line of Java and see the result at once. It is ideal for checking how an expression behaves:</p>
<pre><code class="language-text">jshell&gt; 7 / 2
$1 ==&gt; 3

jshell&gt; "Total: " + 7 / 2
$2 ==&gt; "Total: 3"</code></pre>
<h2>Check yourself</h2>
<p>What does <code>System.out.println(1 + 2 + "3" + 4 + 5);</code> print?</p>
<details><summary>Answer</summary><p><code>3345</code>. Java adds 1 and 2 to get 3, then meets the string "3" and switches to joining text: "33", then "334", then "3345".</p></details>`,
          resources: [
            {
              title: 'The java launcher (Java SE 21)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/specs/man/java.html',
            },
            { title: 'The jshell tool (dev.java)', url: 'https://dev.java/learn/jshell-tool/' },
          ],
        },
        {
          kind: 'article',
          title: 'Reading input with Scanner and printing tidy output',
          minutes: 20,
          html: `<p>A program that always prints the same thing is not much use. Real programs read data. In this lesson you read numbers and words with <code>Scanner</code>, and print results neatly with <code>printf</code>.</p>
<h2>Reading with Scanner</h2>
<p>This program reads the number of passengers and the fare per passenger, and prints the total:</p>
<pre><code class="language-java">import java.util.Scanner;

public class TicketTotal {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int passengers = in.nextInt();
        double fare = in.nextDouble();
        double total = passengers * fare;
        System.out.printf("Total fare: %.2f%n", total);
    }
}</code></pre>
<p>With the input <code>3 455.5</code> it prints:</p>
<pre><code class="language-text">Total fare: 1366.50</code></pre>
<ul>
<li><code>import java.util.Scanner;</code> tells the compiler where <code>Scanner</code> lives.</li>
<li><code>new Scanner(System.in)</code> creates a scanner that reads standard input (the keyboard, or whatever is fed to the program). Create one per program, not one per value.</li>
<li><code>nextInt()</code> reads the next whole number, <code>nextDouble()</code> a decimal number, <code>next()</code> one word, and <code>nextLine()</code> the rest of the current line.</li>
</ul>
<p>The values may be on one line separated by spaces, or on separate lines: <code>nextInt()</code> and <code>nextDouble()</code> skip spaces and line breaks to find the next value.</p>
<h2>Prompts or no prompts?</h2>
<p>When a person runs your program, a prompt such as <code>System.out.print("Passengers: ");</code> is friendly. But automatic judges — the coding practice in this course, and the online tests companies use in placement drives — compare your output with the expected answer character by character. An extra "Passengers: " turns a correct program into a failed one. In practice problems, print <strong>only</strong> what the question asks for.</p>
<h2>Formatting output with printf</h2>
<p><code>printf</code> takes a <strong>format string</strong> with placeholders, followed by the values that fill them:</p>
<table>
<thead><tr><th scope="col">Placeholder</th><th scope="col">Meaning</th><th scope="col">Example output</th></tr></thead>
<tbody>
<tr><td><code>%d</code></td><td>whole number</td><td><code>437</code></td></tr>
<tr><td><code>%.2f</code></td><td>decimal with two places</td><td><code>87.40</code></td></tr>
<tr><td><code>%s</code></td><td>text</td><td><code>Divya</code></td></tr>
<tr><td><code>%5d</code></td><td>whole number, at least 5 wide, right-aligned</td><td><code>  437</code></td></tr>
<tr><td><code>%-8s</code></td><td>text, at least 8 wide, left-aligned</td><td><code>Divya   </code></td></tr>
<tr><td><code>%n</code> and <code>%%</code></td><td>a new line, and a percent sign</td><td></td></tr>
</tbody>
</table>
<pre><code class="language-java">public class ReportLine {
    public static void main(String[] args) {
        String name = "Divya";
        int total = 437;
        double percent = total / 5.0;
        System.out.printf("%-8s|%5d|%7.2f%%%n", name, total, percent);
        System.out.printf("%-8s|%5d|%7.2f%%%n", "Arjun", 389, 389 / 5.0);
    }
}</code></pre>
<pre><code class="language-text">Divya   |  437|  87.40%
Arjun   |  389|  77.80%</code></pre>
<p>Widths line the columns up, which is exactly what a printed mark sheet or bill needs. <code>String.format</code> takes the same placeholders but returns the text instead of printing it.</p>
<h2>The nextLine trap</h2>
<p>Suppose the input is a roll number on one line and a full name on the next:</p>
<pre><code class="language-text">42
Priya Sharma</code></pre>
<pre><code class="language-java">Scanner in = new Scanner(System.in);
int roll = in.nextInt();
String name = in.nextLine();   // gives "" -- not the name!</code></pre>
<p><code>nextInt()</code> reads <code>42</code> but leaves the line break behind it. The following <code>nextLine()</code> reads the rest of that first line, which is empty. The fix is one extra <code>nextLine()</code> to throw away the rest of the line:</p>
<pre><code class="language-java">import java.util.Scanner;

public class StudentCard {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int roll = in.nextInt();
        in.nextLine(); // skip the rest of the roll-number line
        String name = in.nextLine();
        System.out.println(roll + ": " + name);
    }
}</code></pre>
<pre><code class="language-text">42: Priya Sharma</code></pre>
<h2>Common mistakes</h2>
<ul>
<li>Forgetting the import, which gives "cannot find symbol" for <code>Scanner</code>.</li>
<li>Reading with <code>nextInt()</code> when the input has a decimal point: you get an <code>InputMismatchException</code>.</li>
<li>Printing prompts or extra spaces in judged problems.</li>
<li>Using <code>%d</code> for a <code>double</code>: <code>printf</code> throws an <code>IllegalFormatConversionException</code>.</li>
</ul>
<h2>Check yourself</h2>
<p>Write the <code>printf</code> call that prints <code>double price = 49.5;</code> as <code>Price: 49.50</code> followed by a new line.</p>
<details><summary>Answer</summary><p><code>System.out.printf("Price: %.2f%n", price);</code></p></details>`,
          resources: [
            {
              title: 'Scanner (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Scanner.html',
            },
          ],
        },
        { kind: 'practice', question: 'add-two-numbers' },
        { kind: 'practice', question: 'java-jdk-jre-jvm' },
      ],
    },
    {
      title: 'Data and decisions',
      summary:
        'Store values in variables of the right type, calculate with operators, choose between paths with if and switch, and repeat work with loops.',
      lessons: [
        {
          kind: 'article',
          title: 'Variables, types and literals',
          minutes: 15,
          html: `<p>Programs remember things: a student's name, a ticket fare, whether a payment went through. They keep each value in a <strong>variable</strong>, a named box with a fixed <strong>type</strong>. In this lesson you learn to choose the right type and to name your variables well.</p>
<h2>Declaring and using variables</h2>
<pre><code class="language-java">public class StudentRecord {
    public static void main(String[] args) {
        String name = "Karthik";
        int age = 21;
        double cgpa = 8.45;
        char section = 'B';
        boolean placed = false;

        System.out.println(name + " (" + age + "), section " + section);
        System.out.println("CGPA: " + cgpa + ", placed: " + placed);

        placed = true; // a variable can change
        System.out.println("Placed now? " + placed);
    }
}</code></pre>
<pre><code class="language-text">Karthik (21), section B
CGPA: 8.45, placed: false
Placed now? true</code></pre>
<p>Each declaration says the type, then the name, then (usually) a starting value. After that you use the name alone, and you can give the variable a new value with <code>=</code>. In Java, <code>=</code> means "store", not "is equal to".</p>
<h2>The types you will use most</h2>
<table>
<thead><tr><th scope="col">Type</th><th scope="col">Holds</th><th scope="col">Example literal</th></tr></thead>
<tbody>
<tr><td><code>int</code></td><td>whole numbers up to about ±2.1 billion</td><td><code>87</code>, <code>-5</code>, <code>1_00_000</code></td></tr>
<tr><td><code>long</code></td><td>much larger whole numbers</td><td><code>9876543210L</code></td></tr>
<tr><td><code>double</code></td><td>numbers with a decimal point</td><td><code>49.99</code>, <code>2.5e3</code></td></tr>
<tr><td><code>boolean</code></td><td><code>true</code> or <code>false</code></td><td><code>true</code></td></tr>
<tr><td><code>char</code></td><td>one character, in single quotes</td><td><code>'A'</code>, <code>'7'</code></td></tr>
<tr><td><code>String</code></td><td>text, in double quotes</td><td><code>"Chennai"</code></td></tr>
</tbody>
</table>
<p>Underscores inside number literals are ignored by Java, so you can group digits the Indian way (<code>1_00_000</code>) for readability. A whole number too big for <code>int</code> needs a <code>long</code> and an <code>L</code> at the end of the literal. A ten-digit mobile number does not fit in an <code>int</code> — but you should store phone numbers as <code>String</code> anyway, because you never do arithmetic on them and they may start with <code>+91</code>.</p>
<h2>Why types matter</h2>
<p>The type tells Java how much memory to set aside and which operations make sense. You can divide two <code>double</code> values, but not two <code>boolean</code> values. The compiler checks every assignment, so many mistakes are caught before the program ever runs:</p>
<pre><code class="language-java">int marks = 87.5;        // does not compile: possible lossy conversion
char grade = "A";        // does not compile: a String is not a char
int big = 9876543210;    // does not compile: integer number too large</code></pre>
<h2>Naming well</h2>
<ul>
<li>Use <strong>camelCase</strong>: <code>totalMarks</code>, <code>ticketFare</code>, <code>isPaid</code>.</li>
<li>Start with a letter. No spaces, and no Java keywords such as <code>class</code> or <code>int</code>.</li>
<li>Names are case-sensitive: <code>total</code> and <code>Total</code> are two different variables.</li>
<li>Prefer meaning over brevity. <code>fare</code> tells a reader far more than <code>f</code>.</li>
</ul>
<h2>Constants and var</h2>
<p>A value that must never change is declared <code>final</code>, and by convention named in capitals: <code>final double GST_RATE = 0.18;</code>. Assigning to it again is a compile error, which protects you from accidents.</p>
<p>Inside a method you may write <code>var</code> and let Java work out the type from the value: <code>var city = "Madurai";</code> makes a <code>String</code>. The type is still fixed; <code>var</code> only saves typing. Use it when the type is obvious from the right-hand side.</p>
<h2>Common mistakes</h2>
<ul>
<li>Using a local variable before giving it a value: "variable might not have been initialized".</li>
<li>Mixing up <code>'A'</code> (a <code>char</code>) and <code>"A"</code> (a <code>String</code>).</li>
<li>Choosing <code>int</code> for money with paise. Use <code>double</code> while learning; real billing systems use <code>BigDecimal</code> or count paise in a <code>long</code>.</li>
</ul>
<h2>Check yourself</h2>
<p>Choose a type for: a train's PNR number, the number of seats in a coach, the average rating of a course, and whether a seat is booked.</p>
<details><summary>Answer</summary><p>PNR: <code>String</code> (an identifier, not a quantity). Seats: <code>int</code>. Average rating: <code>double</code>. Booked: <code>boolean</code>.</p></details>`,
          resources: [
            {
              title: 'The Java Tutorials: Variables (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/java/nutsandbolts/variables.html',
            },
            {
              title: 'Creating variables (dev.java)',
              url: 'https://dev.java/learn/language-basics/variables/',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Operators: arithmetic, integer division and remainder',
          minutes: 18,
          html: `<p>Most programs calculate something: a total, an average, a time, a discount. Java's arithmetic looks like school maths, with two twists that catch almost every beginner: whole-number division and the remainder operator. Learn them well; they appear in many coding-round problems.</p>
<h2>The arithmetic operators</h2>
<p><code>+</code>, <code>-</code>, <code>*</code> and <code>/</code> do what you expect, and <code>%</code> gives the <strong>remainder</strong> after division. Multiplication, division and remainder happen before addition and subtraction; use brackets whenever the order is not obvious to a reader.</p>
<pre><code class="language-java">public class MatchTime {
    public static void main(String[] args) {
        int totalMinutes = 437;
        int hours = totalMinutes / 60;
        int minutes = totalMinutes % 60;
        System.out.println(hours + " h " + minutes + " min");

        int runs = 287, overs = 50;
        System.out.println("Run rate (int): " + runs / overs);
        System.out.println("Run rate: " + (double) runs / overs);
        System.out.printf("Run rate: %.2f%n", (double) runs / overs);

        int number = 4719;
        System.out.println("Last digit: " + number % 10);
        System.out.println("Without last digit: " + number / 10);
        System.out.println("Is even? " + (number % 2 == 0));
    }
}</code></pre>
<pre><code class="language-text">7 h 17 min
Run rate (int): 5
Run rate: 5.74
Run rate: 5.74
Last digit: 9
Without last digit: 471
Is even? false</code></pre>
<h2>Integer division throws away the fraction</h2>
<p>When both sides of <code>/</code> are whole numbers, the answer is a whole number too: <code>287 / 50</code> is <code>5</code>, not 5.74. Java does not round; it simply drops everything after the decimal point. To get the exact answer, make at least one side a <code>double</code> <em>before</em> dividing:</p>
<ul>
<li><code>(double) runs / overs</code> gives 5.74, because <code>runs</code> becomes 287.0 first.</li>
<li><code>(double) (runs / overs)</code> gives 5.0, because the whole-number division already happened.</li>
<li><code>runs / 50.0</code> also works, because <code>50.0</code> is a <code>double</code> literal.</li>
</ul>
<h2>Remainder is more useful than it looks</h2>
<ul>
<li><code>n % 2 == 0</code> tells you whether <code>n</code> is even.</li>
<li><code>n % 10</code> is the last digit, and <code>n / 10</code> removes it. Repeat both in a loop to walk through every digit of a number.</li>
<li><code>(day + 3) % 7</code> wraps around a week: three days after Saturday (day 6, counting Sunday as 0) is <code>9 % 7</code>, which is 2, a Tuesday.</li>
</ul>
<h2>Shortcuts and Math helpers</h2>
<p><code>total += price;</code> means <code>total = total + price;</code>, and the same works with <code>-=</code>, <code>*=</code>, <code>/=</code> and <code>%=</code>. <code>count++</code> adds one and <code>count--</code> subtracts one. The <code>Math</code> class has ready-made helpers: <code>Math.max(a, b)</code>, <code>Math.min(a, b)</code>, <code>Math.abs(x)</code>, <code>Math.sqrt(x)</code>, <code>Math.round(x)</code> and <code>Math.pow(a, b)</code>, which returns a <code>double</code>.</p>
<h2>Overflow: when a number is too big for its type</h2>
<p>An <code>int</code> cannot go past 2,147,483,647. Go further and the value silently wraps around to a negative number. No error is raised, which makes this bug hard to spot:</p>
<pre><code class="language-java">int crowd = 2_000_000_000;
System.out.println(crowd + crowd);          // -294967296
System.out.println((long) crowd + crowd);   // 4000000000</code></pre>
<p>When a total can grow large — sums of many values, products, factorials — use <code>long</code>.</p>
<h2>Common mistakes</h2>
<ul>
<li>Computing an average or percentage with whole-number division, such as <code>total / count</code> with two <code>int</code> values.</li>
<li>Casting too late: <code>(double) (a / b)</code>.</li>
<li>Expecting <code>Math.pow(2, 10)</code> to be an <code>int</code>. It is the <code>double</code> 1024.0.</li>
<li>Dividing by zero: whole-number division by zero throws an <code>ArithmeticException</code>.</li>
</ul>
<h2>Check yourself</h2>
<p>What do <code>17 / 5</code>, <code>17 % 5</code>, <code>17 / 5.0</code> and <code>-17 % 5</code> give?</p>
<details><summary>Answer</summary><p><code>3</code>, <code>2</code>, <code>3.4</code> and <code>-2</code>. In Java the remainder takes the sign of the left-hand number.</p></details>`,
          resources: [
            {
              title: 'The Java Tutorials: Operators (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/java/nutsandbolts/operators.html',
            },
            {
              title: 'Math (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Math.html',
            },
          ],
        },
        { kind: 'lab', lab: 'debug-java-average' },
        {
          kind: 'article',
          title: 'Making decisions with if, else and switch',
          minutes: 18,
          html: `<p>Programs become interesting when they behave differently for different inputs: a discount for large bills, a concession for senior citizens, a "seat not available" message. Java makes decisions with <code>if</code> and <code>switch</code>, both driven by conditions that are either true or false.</p>
<h2>Conditions</h2>
<p>A condition is a <code>boolean</code> expression. You build one with the comparison operators <code>==</code>, <code>!=</code>, <code>&lt;</code>, <code>&gt;</code>, <code>&lt;=</code> and <code>&gt;=</code>, and combine conditions with the logical operators:</p>
<ul>
<li><code>a &amp;&amp; b</code> (and): true only when both are true.</li>
<li><code>a || b</code> (or): true when at least one is true.</li>
<li><code>!a</code> (not): flips true and false.</li>
</ul>
<p><code>&amp;&amp;</code> and <code>||</code> are <strong>short-circuit</strong> operators: if the left side already decides the answer, Java never evaluates the right side. That makes <code>count != 0 &amp;&amp; total / count &gt; 50</code> safe, because the division never runs when <code>count</code> is zero.</p>
<h2>if, else if, else</h2>
<p>A hypothetical railway charges nothing for children under 5, half fare from 5 to 11, and 60% of the fare for passengers aged 60 or more. Everyone else pays the full fare:</p>
<pre><code class="language-java">public class FareCalculator {
    public static void main(String[] args) {
        int age = 64;
        double baseFare = 820.0;
        double fare;

        if (age &lt; 5) {
            fare = 0;
        } else if (age &lt; 12) {
            fare = baseFare / 2;
        } else if (age &gt;= 60) {
            fare = baseFare * 60 / 100;
        } else {
            fare = baseFare;
        }
        System.out.println("Fare: " + fare);

        boolean confirmed = true;
        boolean hasId = true;
        if (confirmed &amp;&amp; hasId) {
            System.out.println("You may board.");
        } else {
            System.out.println("Please see the ticket examiner.");
        }
    }
}</code></pre>
<pre><code class="language-text">Fare: 492.0
You may board.</code></pre>
<p>Java checks the conditions from top to bottom and runs only the <strong>first</strong> branch whose condition is true. That is why the second test can simply say <code>age &lt; 12</code>: any age under 5 was already handled. Order your conditions carefully, and put the final <code>else</code> last to catch everything else.</p>
<h2>switch for one value with many cases</h2>
<p>When you compare one value against a list of fixed options, a <code>switch</code> is clearer than a long ladder. Modern Java (14 and later, so including Java 21) has an arrow form that can also produce a value:</p>
<pre><code class="language-java">public class BatchType {
    public static void main(String[] args) {
        String day = "SAT";
        String batch = switch (day) {
            case "SAT", "SUN" -&gt; "Weekend batch";
            case "MON", "TUE", "WED", "THU", "FRI" -&gt; "Weekday batch";
            default -&gt; "Not a day code";
        };
        System.out.println(batch);
    }
}</code></pre>
<pre><code class="language-text">Weekend batch</code></pre>
<p>Each arrow case runs only its own code. You will also see the older form with <code>case "SAT":</code> and a <code>break;</code> at the end of each case. There, forgetting a <code>break</code> lets execution "fall through" into the next case — a classic bug that the arrow form avoids.</p>
<h2>Common mistakes</h2>
<ul>
<li>Writing <code>=</code> (store) where you mean <code>==</code> (compare). With <code>int</code> values the compiler refuses <code>if (x = 5)</code>, which is a helpful error.</li>
<li>A stray semicolon: <code>if (age &gt;= 60);</code> ends the <code>if</code> immediately, so the block below always runs.</li>
<li>Leaving out braces and then adding a second line that you think belongs to the <code>if</code>. Always use braces.</li>
<li>Comparing strings with <code>==</code>. Use <code>name.equals("Asha")</code>; you will see why in the Collections module.</li>
<li>Gaps or overlaps in ranges, such as <code>marks &gt; 40</code> in one branch and <code>marks &lt; 40</code> in the next, which leaves exactly 40 unhandled.</li>
</ul>
<h2>Check yourself</h2>
<p>For <code>int x = 7;</code>, which of these are true: <code>x &gt; 5 &amp;&amp; x &lt; 7</code>, <code>x &gt; 5 || x &lt; 7</code>, <code>!(x == 7)</code>?</p>
<details><summary>Answer</summary><p>Only the second. The first fails because 7 is not less than 7, and the third is the opposite of a true condition.</p></details>`,
          resources: [
            {
              title: 'The Java Tutorials: Control Flow Statements (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/java/nutsandbolts/flow.html',
            },
            {
              title: 'Switch expressions and statements (Java SE 21)',
              url: 'https://docs.oracle.com/en/java/javase/21/language/switch-expressions-and-statements.html',
            },
          ],
        },
        { kind: 'practice', question: 'java-grade-from-marks' },
        {
          kind: 'article',
          title: 'Repeating work with while, for and do-while loops',
          minutes: 20,
          html: `<p>Computers shine at repetition: adding a thousand marks, printing every row of a bill, trying every possible divisor. A <strong>loop</strong> repeats a block of code while a condition holds. Java has three loops, and each fits a different kind of problem.</p>
<h2>while: repeat until something becomes true</h2>
<p>Use <code>while</code> when you do not know in advance how many rounds you need. Suppose you save ₹3,500 a month in an account that adds 1% interest every month. How many months until you have ₹50,000?</p>
<pre><code class="language-java">public class SavingsGoal {
    public static void main(String[] args) {
        double balance = 0;
        int months = 0;
        while (balance &lt; 50000) {
            balance = balance + 3500;
            balance = balance + balance * 0.01;
            months++;
        }
        System.out.println("Months needed: " + months);
        System.out.printf("Balance then: %.2f%n", balance);
    }
}</code></pre>
<pre><code class="language-text">Months needed: 14
Balance then: 52839.13</code></pre>
<p>The condition is checked <em>before</em> each round. Something inside the loop must eventually make it false; otherwise the loop never ends.</p>
<h2>for: repeat a known number of times</h2>
<p>A <code>for</code> loop packs the three parts of a counting loop into one line: a start, a condition, and an update that runs after each round.</p>
<pre><code class="language-java">public class CountingLoops {
    public static void main(String[] args) {
        int sum = 0;
        for (int i = 1; i &lt;= 10; i++) {
            sum += i;
        }
        System.out.println("1 + 2 + ... + 10 = " + sum);

        int multiplesOfSeven = 0;
        for (int n = 1; n &lt;= 100; n++) {
            if (n % 7 == 0) {
                multiplesOfSeven++;
            }
        }
        System.out.println("Multiples of 7 up to 100: " + multiplesOfSeven);

        // break: stop as soon as you have the answer
        int number = 221;
        int smallest = number;
        for (int d = 2; d &lt; number; d++) {
            if (number % d == 0) {
                smallest = d;
                break;
            }
        }
        System.out.println("Smallest divisor of 221 above 1: " + smallest);

        // continue: skip the rest of this round and go on to the next
        for (int n = 1; n &lt;= 10; n++) {
            if (n % 2 == 0) {
                continue;
            }
            System.out.print(n + " ");
        }
        System.out.println();
    }
}</code></pre>
<pre><code class="language-text">1 + 2 + ... + 10 = 55
Multiples of 7 up to 100: 14
Smallest divisor of 221 above 1: 13
1 3 5 7 9</code></pre>
<h2>Tracing a loop by hand</h2>
<p>When a loop misbehaves, trace it in a table. Here is the first loop above, cut down to <code>i &lt;= 4</code>:</p>
<table>
<thead><tr><th scope="col">i</th><th scope="col">i &lt;= 4?</th><th scope="col">sum after the round</th></tr></thead>
<tbody>
<tr><td>1</td><td>yes</td><td>1</td></tr>
<tr><td>2</td><td>yes</td><td>3</td></tr>
<tr><td>3</td><td>yes</td><td>6</td></tr>
<tr><td>4</td><td>yes</td><td>10</td></tr>
<tr><td>5</td><td>no — loop ends</td><td>10</td></tr>
</tbody>
</table>
<h2>do-while: run at least once</h2>
<p>A <code>do-while</code> loop checks its condition <em>after</em> each round, so the body always runs at least once. It suits "read until a stop value" input. This program adds item prices until it reads a 0:</p>
<pre><code class="language-java">import java.util.Scanner;

public class ShopTotal {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int total = 0;
        int price;
        do {
            price = in.nextInt();
            total += price;
        } while (price != 0);
        System.out.println("Bill total: " + total);
    }
}</code></pre>
<p>With the input <code>120 45 300 0</code> it prints <code>Bill total: 465</code>.</p>
<h2>Which loop when?</h2>
<ul>
<li>You know the count (every student, numbers 1 to n): <code>for</code>.</li>
<li>You repeat until a condition changes (savings goal, digits left in a number): <code>while</code>.</li>
<li>The body must run once before you can test anything (menus, read-until-zero): <code>do-while</code>.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li><strong>Off by one</strong>: <code>i &lt; 10</code> runs 9 times when starting from 1; <code>i &lt;= 10</code> runs 10 times. Check the first and last rounds every time.</li>
<li>Forgetting the update, so the condition never changes and the loop runs forever. Stop a runaway program with <kbd>Ctrl</kbd> + <kbd>C</kbd>.</li>
<li>A semicolon straight after the header: <code>for (int i = 0; i &lt; n; i++);</code> loops over nothing.</li>
<li>Changing the loop counter inside the body as well as in the update.</li>
</ul>
<h2>Check yourself</h2>
<p>How many times does <code>for (int i = 3; i &lt;= 15; i += 4)</code> run, and with which values of <code>i</code>?</p>
<details><summary>Answer</summary><p>Four times, with i = 3, 7, 11 and 15. The next value, 19, fails the condition.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Loop patterns: totals, counts, the largest value and nested loops',
          minutes: 18,
          html: `<p>Most loops you will ever write follow a handful of patterns. Once you recognise them, a new problem often turns into "this is a counting loop with a running maximum". This lesson collects the patterns that appear again and again in practice problems and coding rounds.</p>
<h2>Accumulator, counter and running maximum</h2>
<p>This program reads how many students there are, then their marks. It prints how many passed (40 or more), the average and the highest mark:</p>
<pre><code class="language-java">import java.util.Scanner;

public class MarksSummary {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        int total = 0;
        int passed = 0;
        int highest = Integer.MIN_VALUE;
        for (int i = 0; i &lt; n; i++) {
            int mark = in.nextInt();
            total += mark;              // accumulator
            if (mark &gt;= 40) {
                passed++;               // counter
            }
            if (mark &gt; highest) {
                highest = mark;         // running maximum
            }
        }
        System.out.println("Passed: " + passed + " of " + n);
        System.out.printf("Average: %.2f%n", (double) total / n);
        System.out.println("Highest: " + highest);
    }
}</code></pre>
<p>For the input below (5 students), it prints:</p>
<pre><code class="language-text">5
78 35 91 40 66</code></pre>
<pre><code class="language-text">Passed: 4 of 5
Average: 62.00
Highest: 91</code></pre>
<ul>
<li>An <strong>accumulator</strong> starts at 0 and adds each value.</li>
<li>A <strong>counter</strong> starts at 0 and adds one whenever a condition holds.</li>
<li>A <strong>running maximum</strong> starts at the smallest possible value (or the first item) and is replaced whenever a bigger value turns up. Starting it at 0 is a bug when all the values can be negative, such as daily temperature changes.</li>
</ul>
<h2>Walking through the digits of a number</h2>
<p>Combine <code>% 10</code> and <code>/ 10</code> in a loop to visit each digit from the right:</p>
<pre><code class="language-java">public class DigitTricks {
    public static void main(String[] args) {
        int n = 50873;
        int digits = 0;
        int reversed = 0;
        while (n &gt; 0) {
            int last = n % 10;
            reversed = reversed * 10 + last;
            digits++;
            n = n / 10;
        }
        System.out.println("Digits: " + digits);
        System.out.println("Reversed: " + reversed);
    }
}</code></pre>
<pre><code class="language-text">Digits: 5
Reversed: 37805</code></pre>
<p>Test the edge case: for <code>n = 0</code> the loop never runs and the program claims 0 digits, although 0 has one digit. Handling it needs one extra check — always ask what happens with the smallest input.</p>
<h2>The flag pattern</h2>
<p>A <code>boolean</code> "flag" remembers whether something happened during the loop. Here is a prime check that stops at the square root, because any factor larger than the square root pairs with one smaller than it:</p>
<pre><code class="language-java">int n = 91;
boolean prime = n &gt; 1;
for (int d = 2; d * d &lt;= n; d++) {
    if (n % d == 0) {
        prime = false;   // found a divisor: 91 = 7 x 13
        break;
    }
}
System.out.println(n + " is prime? " + prime);</code></pre>
<h2>Nested loops</h2>
<p>A loop inside a loop runs the inner loop completely for every round of the outer one. Rows and columns are the natural fit:</p>
<pre><code class="language-java">public class StarSteps {
    public static void main(String[] args) {
        int rows = 4;
        for (int r = 1; r &lt;= rows; r++) {
            for (int c = 1; c &lt;= r; c++) {
                System.out.print("*");
            }
            System.out.println();
        }
    }
}</code></pre>
<pre><code class="language-text">*
**
***
****</code></pre>
<p>Notice the cost: with n rows the inner statement runs 1 + 2 + … + n times, which is about n²/2. Nested loops over the same data grow quickly, and you will measure that properly in the last module.</p>
<h2>Common mistakes</h2>
<ul>
<li>Resetting an accumulator inside the loop instead of before it.</li>
<li>Printing inside the loop when the question wants one answer after it.</li>
<li>Reusing the same counter name (<code>i</code>) for both inner and outer loops.</li>
</ul>
<h2>Check yourself</h2>
<p>Change <code>StarSteps</code> so that it prints the steps upside down, starting with four stars.</p>
<details><summary>Answer</summary><p>Change the inner loop's condition to <code>c &lt;= rows - r + 1</code>, or run the outer loop downwards: <code>for (int r = rows; r &gt;= 1; r--)</code>.</p></details>`,
        },
        { kind: 'practice', question: 'java-multiplication-table' },
      ],
    },
    {
      title: 'Functions and problem solving',
      summary:
        'Split programs into methods that take parameters and return results, solve problems in clear stages, find bugs by reading errors and tracing, and use recursion safely.',
      lessons: [
        {
          kind: 'article',
          title: 'Methods: giving a name to a piece of work',
          minutes: 18,
          html: `<p>As programs grow, writing everything inside <code>main</code> turns into a long, tangled list. A <strong>method</strong> (other languages call it a function) packages a piece of work under a name, so you can reuse it, test it on its own, and read your program like a set of clear steps.</p>
<h2>Defining and calling a method</h2>
<pre><code class="language-java">public class BillHelpers {
    static double withGst(double amount, double ratePercent) {
        return amount + amount * ratePercent / 100;
    }

    static boolean isLeapYear(int year) {
        return (year % 4 == 0 &amp;&amp; year % 100 != 0) || year % 400 == 0;
    }

    static void printLine(String label, double value) {
        System.out.printf("%-12s %10.2f%n", label, value);
    }

    public static void main(String[] args) {
        double meal = 640.0;
        printLine("Meal", meal);
        printLine("With 5% GST", withGst(meal, 5));
        printLine("With 18% GST", withGst(meal, 18));
        System.out.println(isLeapYear(2024) + " " + isLeapYear(1900) + " " + isLeapYear(2000));
    }
}</code></pre>
<pre><code class="language-text">Meal             640.00
With 5% GST      672.00
With 18% GST     755.20
true false true</code></pre>
<p>Read a method header from left to right:</p>
<ul>
<li><code>static</code>: the method belongs to the class, so <code>main</code> can call it directly. Core Java explains the alternative.</li>
<li>The <strong>return type</strong>: <code>double</code>, <code>boolean</code>, or <code>void</code> when the method returns nothing.</li>
<li>The <strong>name</strong>: a verb or question, in camelCase — <code>withGst</code>, <code>isLeapYear</code>, <code>printLine</code>.</li>
<li>The <strong>parameters</strong> in brackets: the inputs, each with a type and a name.</li>
</ul>
<p>When you call <code>withGst(meal, 5)</code>, the values 640.0 and 5 are copied into <code>amount</code> and <code>ratePercent</code>, the body runs, and <code>return</code> sends the result back to the caller, where it is used like any other value.</p>
<h2>Return a value or print it?</h2>
<p>A method that <strong>returns</strong> its answer is far more useful than one that prints it. The caller can print the value, compare it, store it or pass it to another method. Keep printing in one place (often <code>main</code>) and let the other methods calculate. This also makes them easy to test, as you will see in the next lesson.</p>
<h2>Parameters are copies</h2>
<p>Java passes arguments <strong>by value</strong>: the method receives a copy. Changing a parameter inside the method does not change the caller's variable:</p>
<pre><code class="language-java">public class PassByValue {
    static void addBonus(int marks) {
        marks = marks + 5;
        System.out.println("Inside: " + marks);
    }

    public static void main(String[] args) {
        int marks = 70;
        addBonus(marks);
        System.out.println("Outside: " + marks);
    }
}</code></pre>
<pre><code class="language-text">Inside: 75
Outside: 70</code></pre>
<p>The fix is to <em>return</em> the new value and assign it: <code>marks = withBonus(marks);</code>. Variables declared inside a method are <strong>local</strong>: they exist only while that method runs, and other methods cannot see them.</p>
<h2>Same name, different parameters</h2>
<p>Two methods may share a name if their parameter lists differ. This is called <strong>overloading</strong>: <code>Math.max(3, 7)</code> and <code>Math.max(2.5, 1.5)</code> are different methods, and Java picks the one that matches the arguments.</p>
<h2>Common mistakes</h2>
<ul>
<li>"missing return statement": some path through the method ends without a <code>return</code>, for example an <code>if</code> with no <code>else</code>.</li>
<li>Calling a method and ignoring its result: <code>withGst(meal, 5);</code> on its own line calculates a value and throws it away.</li>
<li>Declaring a method inside <code>main</code>. Methods sit side by side inside the class, never inside each other.</li>
<li>Methods that do three jobs. If you need "and" to describe a method, consider splitting it.</li>
</ul>
<h2>Check yourself</h2>
<p>Write a method <code>average</code> that takes three <code>int</code> marks and returns their average as a <code>double</code>.</p>
<details><summary>Answer</summary>
<pre><code class="language-java">static double average(int a, int b, int c) {
    return (a + b + c) / 3.0;
}</code></pre>
<p>Dividing by <code>3.0</code> instead of <code>3</code> avoids whole-number division.</p>
</details>`,
          resources: [
            {
              title: 'The Java Tutorials: Defining Methods (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/java/javaOO/methods.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Solving a problem in stages: understand, plan, code, test',
          minutes: 20,
          html: `<p>Good programmers rarely write a solution from top to bottom in one go. They work in stages, and each stage catches a different kind of mistake. Interviewers watch for exactly this habit, so practise it on every problem — even the easy ones.</p>
<h2>The problem</h2>
<p>An electricity board charges, for a month's usage, ₹3 per unit for the first 100 units, ₹5 per unit for the next 100 units, and ₹7 per unit for every unit above 200. Write a method that returns the bill for a given number of units.</p>
<h2>Stage 1: understand</h2>
<p>Say the problem back in your own words and find the unknowns. Is the input a whole number? Can it be 0? Does someone using 150 units pay ₹5 for <em>all</em> 150, or only for the 50 above 100? Here the slabs work like income-tax slabs: each rate applies only to the units inside its slab. When a question is unclear in an interview, ask. When it is unclear in a test, state your assumption in a comment.</p>
<h2>Stage 2: work examples by hand</h2>
<table>
<thead><tr><th scope="col">Units</th><th scope="col">Working</th><th scope="col">Bill (₹)</th></tr></thead>
<tbody>
<tr><td>0</td><td>nothing used</td><td>0</td></tr>
<tr><td>100</td><td>100 × 3</td><td>300</td></tr>
<tr><td>101</td><td>300 + 1 × 5</td><td>305</td></tr>
<tr><td>200</td><td>300 + 100 × 5</td><td>800</td></tr>
<tr><td>350</td><td>300 + 500 + 150 × 7</td><td>1850</td></tr>
</tbody>
</table>
<p>Choosing 100, 101 and 200 was deliberate: the boundaries between slabs are where bugs hide. These examples become your tests later.</p>
<h2>Stage 3: plan</h2>
<pre><code class="language-text">IF units &lt;= 100: bill = units * 3
ELSE IF units &lt;= 200: bill = 300 + (units - 100) * 5
ELSE: bill = 300 + 500 + (units - 200) * 7</code></pre>
<h2>Stage 4: code, with tests built in</h2>
<pre><code class="language-java">public class ElectricityBill {
    static int billFor(int units) {
        if (units &lt;= 100) {
            return units * 3;
        }
        if (units &lt;= 200) {
            return 100 * 3 + (units - 100) * 5;
        }
        return 100 * 3 + 100 * 5 + (units - 200) * 7;
    }

    static void check(int units, int expected) {
        int actual = billFor(units);
        String result = actual == expected ? "PASS" : "FAIL";
        System.out.println(result + ": " + units + " units -&gt; " + actual + " (expected " + expected + ")");
    }

    public static void main(String[] args) {
        check(0, 0);
        check(100, 300);
        check(101, 305);
        check(200, 800);
        check(350, 1850);
    }
}</code></pre>
<pre><code class="language-text">PASS: 0 units -&gt; 0 (expected 0)
PASS: 100 units -&gt; 300 (expected 300)
PASS: 101 units -&gt; 305 (expected 305)
PASS: 200 units -&gt; 800 (expected 800)
PASS: 350 units -&gt; 1850 (expected 1850)</code></pre>
<p>Two small ideas in this code are worth copying. <code>billFor</code> returns a number instead of printing, so it can be checked automatically. And <code>check</code> compares the actual answer with the answer you worked out by hand, so a mistake shows up as a loud <code>FAIL</code>. The expression <code>actual == expected ? "PASS" : "FAIL"</code> is the <strong>conditional operator</strong>: a compact if-else that produces a value. Professional teams do the same thing with testing tools such as JUnit.</p>
<h2>Stage 5: test, then improve</h2>
<p>Run the tests after every change. If the board adds a fixed meter charge next year, you change <code>billFor</code>, rerun, and know within a second whether everything still works. Only once the answer is right should you think about making the code shorter or faster.</p>
<h2>Breaking bigger problems down</h2>
<p>For a larger task, such as printing a report card, list the steps first and give each step its own method: read the marks, compute the total, work out the grade, print the report. Each method is small enough to write and test on its own, and <code>main</code> reads like the plan.</p>
<h2>Common mistakes</h2>
<ul>
<li>Coding before you have worked a single example by hand.</li>
<li>Testing only one comfortable value, such as 350, and never a boundary.</li>
<li>Silently assuming something the question did not say.</li>
</ul>
<h2>Check yourself</h2>
<p>The board adds a fixed charge of ₹50 to every bill above 0 units. Which tests change, and to what?</p>
<details><summary>Answer</summary><p>Every test except 0 units goes up by 50: 350, 355, 850 and 1900. The 0-unit test stays at 0 — and adding that rule correctly needs an extra condition, which is exactly why the test exists.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Debugging: reading errors and tracing your code',
          minutes: 18,
          html: `<p>Every programmer writes bugs. What separates a beginner from a professional is how quickly the bug is found. This lesson gives you a calm, repeatable method instead of random changes and hope.</p>
<h2>Three kinds of error</h2>
<ul>
<li><strong>Compile-time errors</strong>: <code>javac</code> refuses the program — a missing semicolon, a wrong type, a misspelt name. The message gives the file and line.</li>
<li><strong>Run-time errors (exceptions)</strong>: the program compiles but crashes while running — division by zero, reading past the end of an array, letters where a number was expected.</li>
<li><strong>Logic errors</strong>: the program runs and prints an answer, but the answer is wrong. These are the hardest, because nothing tells you about them except a failing test.</li>
</ul>
<h2>Reading a stack trace</h2>
<pre><code class="language-java">public class AverageCrash {
    static int average(int total, int count) {
        return total / count;
    }

    public static void main(String[] args) {
        System.out.println(average(240, 3));
        System.out.println(average(0, 0));
    }
}</code></pre>
<pre><code class="language-text">80
Exception in thread "main" java.lang.ArithmeticException: / by zero
\tat AverageCrash.average(AverageCrash.java:3)
\tat AverageCrash.main(AverageCrash.java:8)</code></pre>
<p>Read it from the top:</p>
<ol>
<li>The exception type, <code>ArithmeticException</code>, and its message, <code>/ by zero</code>, say <em>what</em> went wrong.</li>
<li>The first <code>at</code> line says <em>where</em>: line 3, inside <code>average</code>.</li>
<li>The lines below show <em>how the program got there</em>: <code>main</code> called <code>average</code> from line 8.</li>
</ol>
<p>The 80 printed first proves the program ran fine until the second call. Exceptions you will meet often: <code>ArithmeticException</code>, <code>ArrayIndexOutOfBoundsException</code>, <code>StringIndexOutOfBoundsException</code>, <code>NullPointerException</code>, <code>InputMismatchException</code> and <code>NumberFormatException</code>.</p>
<h2>Hunting a logic error</h2>
<p>This method should add the numbers from 1 to n, but <code>sumUpTo(5)</code> prints 10 instead of 15:</p>
<pre><code class="language-java">public class SumBug {
    static int sumUpTo(int n) {
        int sum = 0;
        for (int i = 1; i &lt; n; i++) {
            sum += i;
        }
        return sum;
    }

    public static void main(String[] args) {
        System.out.println(sumUpTo(5));
    }
}</code></pre>
<pre><code class="language-text">10</code></pre>
<p>Trace it with the smallest input that fails:</p>
<table>
<thead><tr><th scope="col">i</th><th scope="col">i &lt; 5?</th><th scope="col">sum</th></tr></thead>
<tbody>
<tr><td>1</td><td>yes</td><td>1</td></tr>
<tr><td>2</td><td>yes</td><td>3</td></tr>
<tr><td>3</td><td>yes</td><td>6</td></tr>
<tr><td>4</td><td>yes</td><td>10</td></tr>
<tr><td>5</td><td>no</td><td>10</td></tr>
</tbody>
</table>
<p>The table shows that <code>i</code> never reaches 5: the condition should be <code>i &lt;= n</code>. Tracing turns "it's wrong somewhere" into "this line is wrong".</p>
<h2>A debugging routine that works</h2>
<ol>
<li><strong>Reproduce</strong> the problem with the smallest input that shows it.</li>
<li><strong>Read</strong> the whole error message before touching the code.</li>
<li><strong>Look</strong> inside: trace on paper, add a temporary <code>System.out.println("i=" + i + " sum=" + sum);</code>, or set a breakpoint in your IDE and step through line by line while watching the variables.</li>
<li><strong>Change one thing</strong>, rerun, and check that the fix did not break your other tests.</li>
<li><strong>Remove</strong> the temporary prints when you are done.</li>
</ol>
<p>Explaining your code line by line to a friend — or to a rubber duck on your desk — works surprisingly often: you hear the wrong assumption as you say it.</p>
<h2>Common mistakes</h2>
<ul>
<li>Changing several things at once, so you never learn which change mattered.</li>
<li>Reading only the last line of a long error message.</li>
<li>"Fixing" a symptom, such as catching the exception and ignoring it, instead of the cause.</li>
</ul>
<h2>Check yourself</h2>
<p>A program prints <code>Exception in thread "main" java.lang.ArrayIndexOutOfBoundsException: Index 5 out of bounds for length 5</code>. What is the most likely mistake?</p>
<details><summary>Answer</summary><p>A loop runs with <code>i &lt;= arr.length</code> instead of <code>i &lt; arr.length</code>. An array of length 5 has indexes 0 to 4.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Recursion: a method that calls itself',
          minutes: 20,
          html: `<p>Some problems contain smaller copies of themselves. The factorial of 5 is 5 times the factorial of 4; the folders on your laptop contain folders. <strong>Recursion</strong> solves such problems with a method that calls itself on a smaller input. It is a favourite interview topic, and it is the doorway to trees, graphs and many classic algorithms.</p>
<h2>Two parts every recursive method needs</h2>
<ul>
<li>A <strong>base case</strong>: an input small enough to answer directly, with no further call.</li>
<li>A <strong>recursive case</strong>: answer the problem using the answer to a <em>smaller</em> version of itself, so every call moves closer to the base case.</li>
</ul>
<pre><code class="language-java">public class RecursionBasics {
    static long factorial(int n) {
        if (n &lt;= 1) {
            return 1;                  // base case
        }
        return n * factorial(n - 1);   // recursive case
    }

    static long power(long base, int exponent) {
        if (exponent == 0) {
            return 1;
        }
        return base * power(base, exponent - 1);
    }

    static int countDigits(int n) {
        if (n &lt; 10) {
            return 1;
        }
        return 1 + countDigits(n / 10);
    }

    public static void main(String[] args) {
        System.out.println(factorial(5));
        System.out.println(factorial(20));
        System.out.println(power(2, 10));
        System.out.println(countDigits(50873));
    }
}</code></pre>
<pre><code class="language-text">120
2432902008176640000
1024
5</code></pre>
<p>Notice that <code>countDigits</code> handles 0 correctly — it returns 1 — unlike the loop version from the previous module. <code>factorial(20)</code> is the largest factorial that fits in a <code>long</code>; <code>factorial(21)</code> overflows.</p>
<h2>What really happens: the call stack</h2>
<p>Each call gets its own copy of <code>n</code>, kept on the <strong>call stack</strong> until it returns. Tracing <code>factorial(4)</code>:</p>
<pre><code class="language-text">factorial(4) waits for factorial(3)
  factorial(3) waits for factorial(2)
    factorial(2) waits for factorial(1)
      factorial(1) returns 1          (base case)
    factorial(2) returns 2 * 1 = 2
  factorial(3) returns 3 * 2 = 6
factorial(4) returns 4 * 6 = 24</code></pre>
<p>The calls pile up going down and are answered in reverse order coming back. If the base case is missing, or a call does not move towards it, the pile grows until Java runs out of stack space and throws a <code>StackOverflowError</code>.</p>
<h2>Recursion or a loop?</h2>
<p>Anything written recursively can be written with a loop, and the other way round. Choose recursion when the problem is naturally self-similar (trees, folders, "try every choice" searches) and the depth stays modest. Choose a loop for simple counting, where it is faster and cannot overflow the stack.</p>
<p>Beware of recursion that repeats work. This Fibonacci method looks elegant:</p>
<pre><code class="language-java">static long fib(int n) {
    if (n &lt; 2) {
        return n;
    }
    return fib(n - 1) + fib(n - 2);
}</code></pre>
<p>But <code>fib(40)</code> makes hundreds of millions of calls, because <code>fib(38)</code>, <code>fib(37)</code> and the rest are recomputed again and again. Remembering each answer the first time (<strong>memoisation</strong>), or building up from the bottom with a loop, makes it instant. That idea, called dynamic programming, comes up often in coding rounds.</p>
<h2>Common mistakes</h2>
<ul>
<li>No base case, or a base case that some inputs never reach, such as checking <code>n == 0</code> when <code>n</code> can be negative.</li>
<li>Calling with the same input (<code>factorial(n)</code> instead of <code>factorial(n - 1)</code>).</li>
<li>Forgetting to <code>return</code> the result of the recursive call.</li>
</ul>
<h2>Check yourself</h2>
<p>Write a recursive method that returns the sum 1 + 2 + … + n for n ≥ 0.</p>
<details><summary>Answer</summary>
<pre><code class="language-java">static int addUpTo(int n) {
    if (n == 0) {
        return 0;
    }
    return n + addUpTo(n - 1);
}</code></pre>
</details>
<p><strong>Interview tip:</strong> when you write a recursive solution, say the base case out loud first, then the recursive step, then the depth of the recursion. It shows the interviewer you know why it stops.</p>`,
        },
        { kind: 'practice', question: 'dsa-recursion-base-case' },
        { kind: 'practice', question: 'dsa-climbing-stairs' },
      ],
    },
    {
      title: 'Collections',
      summary:
        'Hold many values at once with arrays, strings, ArrayList, stacks, queues, maps and sets, and pick the right one for classic beginner problems.',
      lessons: [
        {
          kind: 'article',
          title: 'Arrays: many values under one name',
          minutes: 20,
          html: `<p>Sixty students' marks, the runs in each over of a match, the seat numbers in a coach: whenever you have many values of the same kind, declaring sixty separate variables is hopeless. An <strong>array</strong> stores them side by side under one name, and a loop can visit them all.</p>
<h2>Creating and using an array</h2>
<pre><code class="language-java">import java.util.Arrays;

public class OverRuns {
    public static void main(String[] args) {
        int[] runs = {4, 9, 0, 12, 6, 7};
        System.out.println("Overs bowled: " + runs.length);
        System.out.println("First over: " + runs[0]);
        System.out.println("Last over: " + runs[runs.length - 1]);

        int total = 0;
        for (int r : runs) {
            total += r;
        }
        System.out.println("Total runs: " + total);

        int best = 0;
        for (int i = 1; i &lt; runs.length; i++) {
            if (runs[i] &gt; runs[best]) {
                best = i;
            }
        }
        System.out.println("Most expensive over: " + (best + 1) + " (" + runs[best] + " runs)");

        int[] sorted = Arrays.copyOf(runs, runs.length);
        Arrays.sort(sorted);
        System.out.println(Arrays.toString(runs));
        System.out.println(Arrays.toString(sorted));
    }
}</code></pre>
<pre><code class="language-text">Overs bowled: 6
First over: 4
Last over: 7
Total runs: 38
Most expensive over: 4 (12 runs)
[4, 9, 0, 12, 6, 7]
[0, 4, 6, 7, 9, 12]</code></pre>
<ul>
<li>Positions, called <strong>indexes</strong>, start at 0. An array of length 6 has indexes 0 to 5, so the last element is <code>runs[runs.length - 1]</code>.</li>
<li><code>length</code> is a field, written without brackets — unlike a string's <code>length()</code> method.</li>
<li>The <strong>for-each</strong> loop <code>for (int r : runs)</code> visits every value when you do not need the index. Use the classic <code>for</code> when you do, as in the search for the best over.</li>
<li><code>Arrays.toString</code> turns an array into readable text, and <code>Arrays.sort</code> sorts it in place.</li>
</ul>
<h2>Arrays from input</h2>
<p>When the size comes from the input, create the array with <code>new</code>. Every element starts at a default value: 0 for numbers, <code>false</code> for <code>boolean</code>, and <code>null</code> for objects such as strings.</p>
<pre><code class="language-java">Scanner in = new Scanner(System.in);
int n = in.nextInt();
int[] marks = new int[n];
for (int i = 0; i &lt; n; i++) {
    marks[i] = in.nextInt();
}</code></pre>
<p>Once created, an array cannot grow or shrink. If you need that, use an <code>ArrayList</code>, coming up in this module.</p>
<h2>Two variables, one array</h2>
<p>An array variable holds a <strong>reference</strong> to the array, not the values themselves. Assigning it to another variable copies the reference, so both names point at the same array:</p>
<pre><code class="language-java">int[] a = {1, 2, 3};
int[] b = a;              // b refers to the same array as a
b[0] = 99;
System.out.println(a[0]); // 99
int[] c = Arrays.copyOf(a, a.length);  // a real, separate copy</code></pre>
<p>That is also why <code>OverRuns</code> sorted a copy: sorting <code>runs</code> itself would have lost the order of the overs.</p>
<h2>Grids: arrays of arrays</h2>
<p>A two-dimensional array suits tables such as a seating chart: <code>char[][] seats = new char[3][4];</code> has 3 rows of 4 seats, and <code>seats[1][2]</code> is row 1, seat 2 (both counted from 0). Visit it with one loop for rows and a nested loop for columns.</p>
<h2>Common mistakes</h2>
<ul>
<li>Looping with <code>i &lt;= arr.length</code>, which throws <code>ArrayIndexOutOfBoundsException</code> on the last round.</li>
<li>Printing an array directly: <code>System.out.println(runs)</code> prints something like <code>[I@1b6d3586</code>. Use <code>Arrays.toString</code>.</li>
<li>Comparing arrays with <code>==</code>, which compares references. Use <code>Arrays.equals(a, b)</code> to compare contents.</li>
</ul>
<h2>Check yourself</h2>
<p>After <code>int[] x = new int[4]; x[1] = 5; x[3] = x[1] * 2;</code>, what does <code>Arrays.toString(x)</code> give?</p>
<details><summary>Answer</summary><p><code>[0, 5, 0, 10]</code>. Elements you did not set keep the default value 0.</p></details>`,
          resources: [
            {
              title: 'The Java Tutorials: Arrays (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/java/nutsandbolts/arrays.html',
            },
            {
              title: 'Arrays (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Arrays.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Strings: working with text',
          minutes: 20,
          html: `<p>Names, PNR numbers, email addresses, chat messages: a huge share of real data is text. In Java, text is a <code>String</code>, a sequence of characters with a rich set of methods. String problems — reversing, counting, checking palindromes — are also the most common warm-ups in coding rounds.</p>
<h2>The methods you will use daily</h2>
<pre><code class="language-java">public class TextBasics {
    public static void main(String[] args) {
        String pnr = "  PNR-4521837690  ";
        String clean = pnr.strip();
        System.out.println("[" + clean + "]");
        System.out.println("Length: " + clean.length());
        System.out.println("Digits: " + clean.substring(4));
        System.out.println("First char: " + clean.charAt(0));
        System.out.println("Has 4521? " + clean.contains("4521"));

        String city = "chennai";
        String title = Character.toUpperCase(city.charAt(0)) + city.substring(1);
        System.out.println(title);

        String sentence = "practice makes placement easier";
        String[] words = sentence.split(" ");
        StringBuilder initials = new StringBuilder();
        for (String w : words) {
            initials.append(Character.toUpperCase(w.charAt(0)));
        }
        System.out.println(words.length + " words, initials " + initials);

        int digits = 0;
        for (int i = 0; i &lt; clean.length(); i++) {
            if (Character.isDigit(clean.charAt(i))) {
                digits++;
            }
        }
        System.out.println("Digit count: " + digits);
    }
}</code></pre>
<pre><code class="language-text">[PNR-4521837690]
Length: 14
Digits: 4521837690
First char: P
Has 4521? true
Chennai
4 words, initials PMPE
Digit count: 10</code></pre>
<ul>
<li><code>strip()</code> removes spaces at both ends; <code>length()</code> counts characters.</li>
<li><code>charAt(i)</code> returns the <code>char</code> at index <code>i</code>, counting from 0.</li>
<li><code>substring(begin)</code> returns the rest from <code>begin</code>; <code>substring(begin, end)</code> stops just <em>before</em> <code>end</code>.</li>
<li><code>contains</code>, <code>startsWith</code>, <code>endsWith</code> and <code>indexOf</code> search; <code>toUpperCase</code>, <code>toLowerCase</code> and <code>replace</code> transform.</li>
<li><code>split(" ")</code> cuts the string into an array of pieces.</li>
<li>The <code>Character</code> class answers questions about one character: <code>isDigit</code>, <code>isLetter</code>, <code>toLowerCase</code> and more.</li>
</ul>
<h2>Strings never change</h2>
<p>A <code>String</code> is <strong>immutable</strong>: no method changes it. Methods such as <code>toUpperCase()</code> return a <em>new</em> string, so you must keep the result:</p>
<pre><code class="language-java">String name = "meera";
name.toUpperCase();          // result thrown away
System.out.println(name);    // meera
name = name.toUpperCase();
System.out.println(name);    // MEERA</code></pre>
<p>Because of this, building a long string with <code>+</code> inside a loop creates a new string every round. A <code>StringBuilder</code> is a changeable buffer made for the job: <code>append</code> adds to it, and <code>toString()</code> gives the final text. It even has a <code>reverse()</code> method.</p>
<h2>Comparing strings</h2>
<p>Always compare text with <code>equals</code> (or <code>equalsIgnoreCase</code>), never with <code>==</code>:</p>
<pre><code class="language-java">String a = "java";
String b = new String("java");
System.out.println(a == b);        // false: two different objects
System.out.println(a.equals(b));   // true: the same characters</code></pre>
<p><code>==</code> asks "are these the same object?", while <code>equals</code> asks "do they hold the same characters?". Sometimes <code>==</code> happens to work, which makes the bug worse: it passes your test and fails in production.</p>
<h2>Characters are numbers too</h2>
<p>A <code>char</code> is stored as a number, so <code>'c' - 'a'</code> is 2 and <code>(char) ('a' + 1)</code> is <code>'b'</code>. This trick turns a letter into an index from 0 to 25 — handy for counting letters with an <code>int[26]</code> array.</p>
<h2>Common mistakes</h2>
<ul>
<li>Forgetting that <code>substring(2, 5)</code> returns three characters, at indexes 2, 3 and 4.</li>
<li><code>charAt(s.length())</code>: the last index is <code>length() - 1</code>.</li>
<li>Splitting on a single space when words may be separated by several: <code>"a  b".split(" ")</code> contains an empty string. Use <code>s.strip().split("\\\\s+")</code>, which splits on any run of spaces.</li>
<li>Comparing upper- and lower-case letters as different when the problem says case does not matter.</li>
</ul>
<h2>Check yourself</h2>
<p>What does <code>"placement".substring(2, 5).toUpperCase()</code> return?</p>
<details><summary>Answer</summary><p><code>"ACE"</code>: the characters at indexes 2, 3 and 4 are a, c and e.</p></details>`,
          resources: [
            {
              title: 'The Java Tutorials: Strings (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/java/data/strings.html',
            },
            {
              title: 'String (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/String.html',
            },
          ],
        },
        { kind: 'practice', question: 'count-the-vowels' },
        {
          kind: 'article',
          title: 'ArrayList: a list that grows',
          minutes: 18,
          html: `<p>Arrays have a fixed size, but real lists change: students join a waitlist, orders are cancelled, items are added to a cart. An <code>ArrayList</code> grows and shrinks as you add and remove elements, and it is the collection you will use most in Java.</p>
<h2>Creating and using a list</h2>
<pre><code class="language-java">import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Waitlist {
    public static void main(String[] args) {
        List&lt;String&gt; waitlist = new ArrayList&lt;&gt;();
        waitlist.add("Anil");
        waitlist.add("Fatima");
        waitlist.add("Joseph");
        waitlist.add(1, "Meera");            // insert at index 1
        System.out.println(waitlist + " size " + waitlist.size());

        waitlist.remove("Anil");             // remove by value
        System.out.println("Next in line: " + waitlist.get(0));
        System.out.println("Is Joseph waiting? " + waitlist.contains("Joseph"));

        Collections.sort(waitlist);
        System.out.println("Sorted: " + waitlist);

        List&lt;Integer&gt; seats = new ArrayList&lt;&gt;(List.of(10, 20, 30, 40));
        seats.remove(1);                     // index 1, so 20 goes
        seats.remove(Integer.valueOf(40));   // the value 40
        System.out.println(seats);
    }
}</code></pre>
<pre><code class="language-text">[Anil, Meera, Fatima, Joseph] size 4
Next in line: Meera
Is Joseph waiting? true
Sorted: [Fatima, Joseph, Meera]
[10, 30]</code></pre>
<h2>Reading the declaration</h2>
<p><code>List&lt;String&gt; waitlist = new ArrayList&lt;&gt;();</code> says three things:</p>
<ul>
<li>The angle brackets give the <strong>element type</strong>. This list holds only strings, and the compiler rejects anything else. This feature is called generics.</li>
<li>The variable's type is the interface <code>List</code>, while the object is an <code>ArrayList</code>. Code written against <code>List</code> keeps working if you later switch to another kind of list.</li>
<li>The empty <code>&lt;&gt;</code> on the right (the "diamond") lets Java repeat the element type for you.</li>
</ul>
<p>Collections hold objects, not primitive values, so a list of whole numbers is <code>List&lt;Integer&gt;</code>, not <code>List&lt;int&gt;</code>. Java converts between <code>int</code> and <code>Integer</code> automatically (<strong>autoboxing</strong>), which is why <code>seats.add(50)</code> just works.</p>
<h2>The everyday methods</h2>
<table>
<thead><tr><th scope="col">Method</th><th scope="col">What it does</th></tr></thead>
<tbody>
<tr><td><code>add(x)</code>, <code>add(i, x)</code></td><td>append, or insert at index <code>i</code></td></tr>
<tr><td><code>get(i)</code>, <code>set(i, x)</code></td><td>read, or replace, the element at <code>i</code></td></tr>
<tr><td><code>remove(i)</code>, <code>remove(x)</code></td><td>remove by index, or the first element equal to <code>x</code></td></tr>
<tr><td><code>size()</code>, <code>isEmpty()</code></td><td>how many elements; whether there are none</td></tr>
<tr><td><code>contains(x)</code>, <code>indexOf(x)</code></td><td>search: true/false, or the position (−1 if absent)</td></tr>
</tbody>
</table>
<h2>How fast is it?</h2>
<p>An <code>ArrayList</code> keeps its elements in an array inside, so <code>get(i)</code> jumps straight to the element, however long the list. Adding at the end is fast too. Inserting or removing near the <em>front</em> is slower, because every later element has to shift along. Java also has a <code>LinkedList</code>, which inserts cheaply at the ends but must walk from one end to reach position <code>i</code>. For most programs, and for nearly all coding-round problems, <code>ArrayList</code> is the right choice.</p>
<h2>Common mistakes</h2>
<ul>
<li><code>remove(1)</code> on a <code>List&lt;Integer&gt;</code> removes index 1, not the value 1. Write <code>remove(Integer.valueOf(1))</code> for the value.</li>
<li>Removing elements inside a for-each loop over the same list, which throws <code>ConcurrentModificationException</code>. Use <code>list.removeIf(...)</code> (you will meet that arrow syntax in Core Java) or an index loop that runs backwards.</li>
<li>Trying to add to <code>List.of(...)</code>: it creates a list that cannot be changed. Wrap it in <code>new ArrayList&lt;&gt;(...)</code> if you need to modify it.</li>
</ul>
<h2>Check yourself</h2>
<p>Starting from an empty <code>List&lt;String&gt; l</code>, what is in it after <code>l.add("a"); l.add("b"); l.add(0, "c"); l.set(2, "d");</code>?</p>
<details><summary>Answer</summary><p><code>[c, a, d]</code>. Inserting "c" at index 0 shifts "a" and "b" along, and <code>set(2, ...)</code> replaces "b".</p></details>`,
          resources: [
            {
              title: 'ArrayList (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayList.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Stacks and queues: when order matters',
          minutes: 15,
          html: `<p>Sometimes you care less about <em>where</em> an item is and more about <em>which item comes out next</em>. Two simple rules cover a surprising number of problems: last in, first out (a <strong>stack</strong>) and first in, first out (a <strong>queue</strong>).</p>
<h2>Stack: last in, first out</h2>
<p>Think of a stack of plates in a canteen: you take the plate that was put on last. Your editor's undo history works the same way — the most recent change is undone first — and so does the back button in a browser. The operations are <strong>push</strong> (put on top), <strong>pop</strong> (take from the top) and <strong>peek</strong> (look at the top without removing it).</p>
<h2>Queue: first in, first out</h2>
<p>A queue is the line at a railway ticket counter: whoever arrived first is served first. Printer jobs, customer-support tickets and messages between programs are handled this way. The operations are <strong>offer</strong> (join at the back), <strong>poll</strong> (leave from the front) and <strong>peek</strong> (look at the front).</p>
<h2>Both in Java with ArrayDeque</h2>
<p><code>ArrayDeque</code> (a "double-ended queue") can act as either, quickly:</p>
<pre><code class="language-java">import java.util.ArrayDeque;
import java.util.Deque;

public class UndoAndCounter {
    public static void main(String[] args) {
        Deque&lt;String&gt; undo = new ArrayDeque&lt;&gt;();
        undo.push("typed 'Hello'");
        undo.push("made it bold");
        undo.push("typed ' world'");
        System.out.println("Undo: " + undo.pop());
        System.out.println("Undo: " + undo.pop());
        System.out.println("Still to undo: " + undo.peek());

        Deque&lt;String&gt; counter = new ArrayDeque&lt;&gt;();
        counter.offer("Ravi");
        counter.offer("Sana");
        counter.offer("Tenzin");
        while (!counter.isEmpty()) {
            System.out.println("Serving " + counter.poll());
        }
        System.out.println("Queue empty, poll gives " + counter.poll());
    }
}</code></pre>
<pre><code class="language-text">Undo: typed ' world'
Undo: made it bold
Still to undo: typed 'Hello'
Serving Ravi
Serving Sana
Serving Tenzin
Queue empty, poll gives null</code></pre>
<p>Notice the difference on an empty collection: <code>poll()</code> and <code>peek()</code> return <code>null</code>, while <code>pop()</code> throws a <code>NoSuchElementException</code>. Check <code>isEmpty()</code> before you pop.</p>
<p>You may see the older <code>Stack</code> class in old code and textbooks. Prefer <code>ArrayDeque</code>: <code>Stack</code> is a legacy class with extra overhead, and the Java documentation itself recommends <code>Deque</code> instead.</p>
<h2>Where they show up in problems</h2>
<ul>
<li><strong>Matching pairs</strong> — brackets in an expression, HTML tags — use a stack: push each opener, and when a closer arrives it must match the opener on top. If it does not, or openers are left over at the end, the input is unbalanced.</li>
<li><strong>Undo, back navigation, and reversing</strong> a sequence use a stack.</li>
<li><strong>Processing in arrival order</strong>, and searching level by level (breadth-first search through a map of cities or a family tree), use a queue.</li>
<li>Recursion itself runs on a stack — the call stack from the previous module.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Mixing the two styles on one deque, such as <code>push</code> with <code>poll</code>; you then get stack order where you expected queue order, or the other way round. Pick one set of methods per use.</li>
<li>Popping without checking for an empty stack.</li>
<li>Adding <code>null</code>: <code>ArrayDeque</code> does not allow it and throws a <code>NullPointerException</code>.</li>
</ul>
<h2>Check yourself</h2>
<p>You push 1, 2 and 3 onto a stack, pop once, then push 4. What do two more pops return?</p>
<details><summary>Answer</summary><p>4, then 2. The first pop removed 3, leaving 1 and 2; then 4 went on top.</p></details>`,
          resources: [
            {
              title: 'ArrayDeque (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Maps and sets: looking things up by key',
          minutes: 18,
          html: `<p>Looking up a phone extension by name, counting votes per candidate, remembering which roll numbers you have already seen: these tasks need fast lookups by <strong>key</strong>, not by position. Java's <code>Map</code> stores key–value pairs, and its sibling <code>Set</code> stores unique values. Together they turn many slow solutions into fast ones.</p>
<h2>Counting with a map</h2>
<pre><code class="language-java">import java.util.Map;
import java.util.TreeMap;

public class ClassVote {
    public static void main(String[] args) {
        String[] votes = {"Asha", "Bilal", "Asha", "Chitra", "Bilal", "Asha"};
        Map&lt;String, Integer&gt; count = new TreeMap&lt;&gt;();
        for (String name : votes) {
            count.put(name, count.getOrDefault(name, 0) + 1);
        }
        System.out.println(count);

        String winner = null;
        for (Map.Entry&lt;String, Integer&gt; e : count.entrySet()) {
            if (winner == null || e.getValue() &gt; count.get(winner)) {
                winner = e.getKey();
            }
        }
        System.out.println("Class representative: " + winner);
        System.out.println("Votes for Divya: " + count.getOrDefault("Divya", 0));
        System.out.println("get on a missing key: " + count.get("Divya"));
    }
}</code></pre>
<pre><code class="language-text">{Asha=3, Bilal=2, Chitra=1}
Class representative: Asha
Votes for Divya: 0
get on a missing key: null</code></pre>
<ul>
<li><code>put(key, value)</code> adds a pair, or replaces the value if the key is already there. Keys are unique.</li>
<li><code>get(key)</code> returns the value, or <code>null</code> when the key is missing. <code>getOrDefault(key, 0)</code> returns your default instead, which is perfect for counting.</li>
<li><code>containsKey</code>, <code>remove</code> and <code>size</code> do what their names say.</li>
<li><code>entrySet()</code> lets you loop over every pair; <code>keySet()</code> and <code>values()</code> give just one side.</li>
</ul>
<h2>Which map?</h2>
<table>
<thead><tr><th scope="col">Class</th><th scope="col">Order when you loop</th><th scope="col">Typical use</th></tr></thead>
<tbody>
<tr><td><code>HashMap</code></td><td>no promised order</td><td>the default; fastest lookups</td></tr>
<tr><td><code>LinkedHashMap</code></td><td>the order keys were first added</td><td>"print in the order they appeared"</td></tr>
<tr><td><code>TreeMap</code></td><td>sorted by key</td><td>alphabetical or numeric reports</td></tr>
</tbody>
</table>
<p>A <code>HashMap</code> finds a key in about the same time whether it holds ten entries or ten lakh — on average a constant amount of work, because it computes where the key must be instead of searching. That speed is why "use a hash map" is the answer to so many interview questions.</p>
<h2>Sets: unique values</h2>
<p>A <code>Set</code> is like a map with keys only. Adding a value that is already there changes nothing, and <code>add</code> tells you so by returning <code>false</code>:</p>
<pre><code class="language-java">Set&lt;String&gt; seen = new LinkedHashSet&lt;&gt;();
for (String city : List.of("Pune", "Kochi", "Pune", "Agra", "Kochi")) {
    boolean isNew = seen.add(city);
    System.out.println(city + (isNew ? " (new)" : " (repeat)"));
}
System.out.println(seen);   // [Pune, Kochi, Agra]</code></pre>
<p><code>HashSet</code>, <code>LinkedHashSet</code> and <code>TreeSet</code> follow the same ordering rules as the three maps.</p>
<h2>Common mistakes</h2>
<ul>
<li>Calling <code>count.get(name) + 1</code> for a key that is not there yet. <code>get</code> returns <code>null</code>, and adding to <code>null</code> throws a <code>NullPointerException</code>.</li>
<li>Expecting a <code>HashMap</code> or <code>HashSet</code> to print in insertion or sorted order. If order matters, choose the linked or tree version.</li>
<li>Using a list and <code>contains</code> to check for repeats in a big input: each check scans the whole list. A set answers instantly.</li>
</ul>
<h2>Check yourself</h2>
<p>Which collection would you use to print each distinct word of a sentence once, in the order the words first appear?</p>
<details><summary>Answer</summary><p>A <code>LinkedHashSet&lt;String&gt;</code>: a set keeps each word once, and the linked version remembers first-appearance order.</p></details>`,
          resources: [
            {
              title: 'HashMap (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html',
            },
            {
              title: 'The Java Tutorials: Collections (Oracle)',
              url: 'https://docs.oracle.com/javase/tutorial/collections/index.html',
            },
          ],
        },
        { kind: 'practice', question: 'remove-the-duplicates' },
      ],
    },
    {
      title: 'Searching, sorting and efficiency',
      summary:
        'Search and sort data, compare solutions with Big-O, and use the classic patterns — binary search, two pointers, sliding windows, hash lookups — that coding rounds reward.',
      lessons: [
        {
          kind: 'article',
          title: 'Searching: linear search and binary search',
          minutes: 20,
          html: `<p>Finding things is one of the most common jobs a program does: a roll number in a class list, a train in a timetable, a word in a dictionary. How you search makes an enormous difference once the data grows. This lesson compares the simplest search with one of the cleverest.</p>
<h2>Linear search: check everything</h2>
<p>Look at each element in turn until you find the target or run out. It works on any data, sorted or not, but in the worst case it checks every element: a million items can mean a million comparisons.</p>
<h2>Binary search: halve the problem each time</h2>
<p>If the data is <strong>sorted</strong>, you can do far better. Look at the middle element. If it is the target, you are done. If the target is bigger, it can only be in the right half, so throw the left half away; if smaller, throw the right half away. Repeat on what is left. You do the same thing when you look up a word in a printed dictionary.</p>
<pre><code class="language-java">public class FindRollNumber {
    static int linearSearch(int[] a, int target) {
        for (int i = 0; i &lt; a.length; i++) {
            if (a[i] == target) {
                return i;
            }
        }
        return -1;
    }

    static int binarySearch(int[] sorted, int target) {
        int low = 0;
        int high = sorted.length - 1;
        while (low &lt;= high) {
            int mid = low + (high - low) / 2;
            if (sorted[mid] == target) {
                return mid;
            } else if (sorted[mid] &lt; target) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return -1;
    }

    public static void main(String[] args) {
        int[] rolls = {1102, 1107, 1115, 1121, 1134, 1140, 1152, 1169};
        System.out.println(linearSearch(rolls, 1134));
        System.out.println(binarySearch(rolls, 1134));
        System.out.println(binarySearch(rolls, 1130));
    }
}</code></pre>
<pre><code class="language-text">4
4
-1</code></pre>
<h2>Tracing the halving</h2>
<p>Searching for 1134 in the eight roll numbers above:</p>
<table>
<thead><tr><th scope="col">low</th><th scope="col">high</th><th scope="col">mid</th><th scope="col">sorted[mid]</th><th scope="col">decision</th></tr></thead>
<tbody>
<tr><td>0</td><td>7</td><td>3</td><td>1121</td><td>too small: low = 4</td></tr>
<tr><td>4</td><td>7</td><td>5</td><td>1140</td><td>too big: high = 4</td></tr>
<tr><td>4</td><td>4</td><td>4</td><td>1134</td><td>found at index 4</td></tr>
</tbody>
</table>
<p>For 1130 the range keeps shrinking until <code>low</code> passes <code>high</code>, which means the value is not there, so the method returns −1.</p>
<h2>Why it is so fast</h2>
<p>Each step halves the range. Starting from a million items, after one step about 500,000 remain, then 250,000, and so on: about 20 steps reach a single item, because 2 multiplied by itself 20 times is just over a million. Doubling the data adds only <em>one</em> more step. That growth is written O(log n), and you will meet the notation properly in the lesson on efficiency.</p>
<h2>Details that matter</h2>
<ul>
<li><code>mid = low + (high - low) / 2</code> gives the same middle as <code>(low + high) / 2</code>, but never overflows an <code>int</code> when the indexes are huge. Interviewers like to see it.</li>
<li>The loop runs while <code>low &lt;= high</code>. Using <code>&lt;</code> skips the last remaining element.</li>
<li>Sorting just to search once is not worth it, because sorting costs more than one linear search. Sort when you will search many times.</li>
<li>The library already has it: <code>Arrays.binarySearch(rolls, 1134)</code>. It returns a negative number when the value is missing.</li>
<li>When the target appears several times, plain binary search returns <em>one</em> of the positions, not necessarily the first. Finding the first needs a small change: when you find a match, remember it and keep searching to the left.</li>
</ul>
<h2>Check yourself</h2>
<p>About how many steps does binary search need for a sorted list of 1,000 items? And for 2,000?</p>
<details><summary>Answer</summary><p>About 10 for 1,000 items (2 to the power 10 is 1,024) and about 11 for 2,000. Doubling the data adds one step.</p></details>`,
          resources: [
            {
              title: 'Arrays (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Arrays.html',
            },
          ],
        },
        { kind: 'practice', question: 'dsa-binary-search-first' },
        {
          kind: 'article',
          title: 'Sorting: how it works and when to use the library',
          minutes: 20,
          html: `<p>Sorted data is easier to search, to report and to reason about: rank lists, merit lists, leaderboards. In real projects you call a library method to sort, but interviewers expect you to understand at least one sorting algorithm and to talk about cost and stability. This lesson gives you both.</p>
<h2>Insertion sort: the way you sort playing cards</h2>
<p>Pick up cards one at a time. Each new card slides left past the bigger cards in your hand until it reaches its place. In an array, the "hand" is the sorted part at the front, and it grows by one element per pass:</p>
<pre><code class="language-java">import java.util.Arrays;

public class InsertionSortDemo {
    static void insertionSort(int[] a) {
        for (int i = 1; i &lt; a.length; i++) {
            int current = a[i];
            int j = i - 1;
            while (j &gt;= 0 &amp;&amp; a[j] &gt; current) {
                a[j + 1] = a[j];   // shift the bigger value one place right
                j--;
            }
            a[j + 1] = current;    // drop the card into the gap
            System.out.println("After pass " + i + ": " + Arrays.toString(a));
        }
    }

    public static void main(String[] args) {
        int[] marks = {67, 45, 89, 45, 72};
        insertionSort(marks);
    }
}</code></pre>
<pre><code class="language-text">After pass 1: [45, 67, 89, 45, 72]
After pass 2: [45, 67, 89, 45, 72]
After pass 3: [45, 45, 67, 89, 72]
After pass 4: [45, 45, 67, 72, 89]</code></pre>
<p>Pass 2 changed nothing: 89 was already bigger than everything before it. That is insertion sort's strength — on data that is almost sorted it does very little work. On data in reverse order, every element must slide all the way left, and the work grows with the <em>square</em> of the size. Selection sort and bubble sort, which you may meet in textbooks, have the same square growth.</p>
<h2>What the library uses</h2>
<p><code>Arrays.sort</code> and <code>Collections.sort</code> use far smarter algorithms whose work grows like n log n — fast enough for millions of items. In practice, always use them:</p>
<pre><code class="language-java">int[] fares = {455, 120, 980, 310};
Arrays.sort(fares);                                  // [120, 310, 455, 980]

Integer[] scores = {67, 45, 89};
Arrays.sort(scores, Collections.reverseOrder());     // [89, 67, 45]

List&lt;String&gt; names = new ArrayList&lt;&gt;(List.of("Ravi", "Anu", "Kabir"));
Collections.sort(names);                             // [Anu, Kabir, Ravi]</code></pre>
<p>Sorting in reverse order needs <code>Integer[]</code> rather than <code>int[]</code>, because the reverse comparator works on objects. With a plain <code>int[]</code>, sort it normally and read it from the end.</p>
<h2>Stability: what happens to ties</h2>
<p>A sort is <strong>stable</strong> if elements that compare equal keep their original relative order. Suppose a class list is already in alphabetical order and you sort it by section. With a stable sort, the students inside each section stay alphabetical; with an unstable one, they may get shuffled. Insertion sort as written above is stable, because it shifts only values strictly greater than the current one. Java's sorting of objects (lists, <code>Integer[]</code>, <code>String[]</code>) is guaranteed stable.</p>
<h2>Common mistakes</h2>
<ul>
<li>Writing your own sort in a project when <code>Arrays.sort</code> or <code>Collections.sort</code> would do.</li>
<li>Sorting the original array when you still need the original order. Sort a copy instead.</li>
<li>Forgetting that sorting changes the array in place; it does not return a new one.</li>
<li>Changing <code>a[j] &gt; current</code> to <code>&gt;=</code> in insertion sort. It still sorts, but equal values swap places, so it is no longer stable.</li>
</ul>
<h2>Check yourself</h2>
<p>Show the array after each pass when insertion sort runs on <code>[3, 1, 2]</code>.</p>
<details><summary>Answer</summary><p>After pass 1: <code>[1, 3, 2]</code>. After pass 2: <code>[1, 2, 3]</code>.</p></details>`,
          resources: [
            {
              title: 'Collections (Java SE 21 API)',
              url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Collections.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'How fast is your code? Big-O for beginners',
          minutes: 20,
          html: `<p>Two programs can both print the right answer, yet one finishes in a blink and the other is still running when the online test times out. <strong>Big-O notation</strong> is how programmers describe the difference: not in seconds, which depend on the machine, but in how the amount of work grows as the input grows.</p>
<h2>Counting steps, not seconds</h2>
<p>Imagine the input has n items. Ask: roughly how many basic steps — comparisons, additions, lookups — does the program take, as a function of n? Then keep only the part that dominates when n is large, and drop constant factors. A loop that does 3 steps per item for n items is O(n), not O(3n).</p>
<table>
<thead><tr><th scope="col">Big-O</th><th scope="col">Name</th><th scope="col">Typical example</th><th scope="col">Work for n = 1,000,000</th></tr></thead>
<tbody>
<tr><td>O(1)</td><td>constant</td><td>reading <code>a[i]</code>; a hash map lookup on average</td><td>1</td></tr>
<tr><td>O(log n)</td><td>logarithmic</td><td>binary search</td><td>about 20</td></tr>
<tr><td>O(n)</td><td>linear</td><td>one loop over the data</td><td>a million</td></tr>
<tr><td>O(n log n)</td><td>n log n</td><td><code>Arrays.sort</code></td><td>about 20 million</td></tr>
<tr><td>O(n²)</td><td>quadratic</td><td>a loop inside a loop over the data</td><td>a million million</td></tr>
</tbody>
</table>
<p>A rough rule of thumb: a typical judge machine manages somewhere around 10<sup>8</sup> simple steps per second. For n = 10<sup>6</sup>, an O(n log n) solution passes easily, and an O(n²) one has no chance.</p>
<h2>Same problem, two costs</h2>
<p>Does a list of ticket numbers contain a repeat? The obvious solution compares every pair; the better one remembers what it has already seen:</p>
<pre><code class="language-java">import java.util.HashSet;
import java.util.Set;

public class DuplicateCheck {
    static boolean hasDuplicateSlow(int[] a) {          // O(n^2)
        for (int i = 0; i &lt; a.length; i++) {
            for (int j = i + 1; j &lt; a.length; j++) {
                if (a[i] == a[j]) {
                    return true;
                }
            }
        }
        return false;
    }

    static boolean hasDuplicateFast(int[] a) {          // O(n)
        Set&lt;Integer&gt; seen = new HashSet&lt;&gt;();
        for (int x : a) {
            if (!seen.add(x)) {      // add returns false if x was already there
                return true;
            }
        }
        return false;
    }

    public static void main(String[] args) {
        int[] tickets = {5012, 7781, 3390, 7781, 1204};
        System.out.println(hasDuplicateSlow(tickets) + " " + hasDuplicateFast(tickets));
    }
}</code></pre>
<pre><code class="language-text">true true</code></pre>
<p>The slow version's inner loop runs n − 1 times, then n − 2, and so on: about n²/2 comparisons in total. With 100,000 tickets that is around five billion comparisons. The fast version does one set operation per ticket, about 100,000. A third approach — sort, then compare neighbours — costs O(n log n) and uses no extra memory.</p>
<h2>Quick rules for reading code</h2>
<ul>
<li>Statements one after another: add their costs, keep the biggest.</li>
<li>A loop inside a loop, both over the data: multiply, giving O(n²).</li>
<li>A loop that halves (or doubles) its variable each round: O(log n).</li>
<li>A library call is not free: <code>list.contains(x)</code> on an <code>ArrayList</code> is O(n), so calling it inside a loop makes the loop O(n²).</li>
</ul>
<h2>Space matters too</h2>
<p>Big-O also describes extra memory. <code>hasDuplicateFast</code> buys its speed with an O(n) set; <code>hasDuplicateSlow</code> uses O(1) extra space. Trading memory for speed is the most common optimisation you will make, and saying so explicitly impresses interviewers.</p>
<h2>Common mistakes</h2>
<ul>
<li>Calling something O(n) because "there is only one loop", when the loop body calls an O(n) method.</li>
<li>Optimising before the solution is correct.</li>
<li>Forgetting that Big-O describes large n: for ten items, any approach is fine.</li>
</ul>
<h2>Check yourself</h2>
<p>What is the cost of a loop over n items whose body runs a binary search on a separate sorted array of n items?</p>
<details><summary>Answer</summary><p>O(n log n): n rounds, each doing O(log n) work.</p></details>`,
        },
        { kind: 'practice', question: 'dsa-nested-loop-cost' },
        {
          kind: 'article',
          title: 'Patterns that crack coding rounds',
          minutes: 22,
          html: `<p>Coding rounds look endless, but most of their problems reuse a small set of ideas. Once you can spot the pattern, the code is short. This lesson covers four patterns that turn slow O(n²) attempts into O(n) solutions.</p>
<h2>Four patterns in one program</h2>
<pre><code class="language-java">public class PatternToolkit {
    // Two pointers: does a sorted array have a pair adding up to target?
    static boolean hasPairWithSum(int[] sorted, int target) {
        int left = 0;
        int right = sorted.length - 1;
        while (left &lt; right) {
            int sum = sorted[left] + sorted[right];
            if (sum == target) {
                return true;
            } else if (sum &lt; target) {
                left++;
            } else {
                right--;
            }
        }
        return false;
    }

    // Sliding window: best total over k consecutive days
    static int bestWindow(int[] sales, int k) {
        int window = 0;
        for (int i = 0; i &lt; k; i++) {
            window += sales[i];
        }
        int best = window;
        for (int i = k; i &lt; sales.length; i++) {
            window += sales[i] - sales[i - k];
            best = Math.max(best, window);
        }
        return best;
    }

    // Frequency array: letters a to z counted in one pass
    static int[] letterCounts(String word) {
        int[] counts = new int[26];
        for (char c : word.toCharArray()) {
            counts[c - 'a']++;
        }
        return counts;
    }

    // Prefix sums: total of any range in O(1) after one pass
    static int[] prefixSums(int[] a) {
        int[] prefix = new int[a.length + 1];
        for (int i = 0; i &lt; a.length; i++) {
            prefix[i + 1] = prefix[i] + a[i];
        }
        return prefix;
    }

    public static void main(String[] args) {
        int[] prices = {120, 250, 310, 400, 575};
        System.out.println(hasPairWithSum(prices, 650));
        System.out.println(hasPairWithSum(prices, 100));

        int[] sales = {3, 8, 2, 9, 7, 1, 4};
        System.out.println(bestWindow(sales, 3));

        int[] counts = letterCounts("banana");
        System.out.println("a=" + counts[0] + " b=" + counts[1] + " n=" + counts['n' - 'a']);

        int[] prefix = prefixSums(sales);
        System.out.println("Days 2 to 4 sold " + (prefix[5] - prefix[2]));
    }
}</code></pre>
<pre><code class="language-text">true
false
19
a=3 b=1 n=2
Days 2 to 4 sold 18</code></pre>
<h2>When to reach for each one</h2>
<ul>
<li><strong>Two pointers</strong>: the data is sorted (or can be), and you look for a pair or need to compare the two ends, as in a palindrome check. Each step moves one pointer inward, so the whole scan is O(n) instead of trying every pair.</li>
<li><strong>Sliding window</strong>: "best", "longest" or "shortest" over a run of <em>consecutive</em> elements. When the window slides one place, add the element entering and subtract the one leaving instead of re-adding the whole window.</li>
<li><strong>Frequency counting</strong>: anagrams, the most common item, first non-repeating character. Use an <code>int[26]</code> for lower-case letters and a <code>HashMap</code> for anything else.</li>
<li><strong>Prefix sums</strong>: many questions about totals over ranges. After one pass, the total from index <code>i</code> to <code>j</code> is <code>prefix[j + 1] - prefix[i]</code>. Above, days 2 to 4 (counting from 0) are 2 + 9 + 7 = 18.</li>
</ul>
<p>A fifth pattern you already know: when you need "have I seen this before?" or "where did I see it?", keep a <code>HashSet</code> or <code>HashMap</code> as you go. It answers in O(1) on average and is the key to the classic pair-sum problem on <em>unsorted</em> data.</p>
<h2>How to talk through a problem in an interview</h2>
<ol>
<li>Restate the problem and confirm the input limits.</li>
<li>Work one or two examples by hand, including an edge case.</li>
<li>Describe the brute-force solution and its Big-O, even if you will not code it.</li>
<li>Name the pattern that removes the wasted work, and the new Big-O.</li>
<li>Code it, then dry-run your code on your example before saying "done".</li>
</ol>
<h2>Common mistakes</h2>
<ul>
<li>Using two pointers on unsorted data, where moving a pointer no longer means "bigger" or "smaller".</li>
<li>Off-by-one errors at the window's edges: test with k equal to 1 and to the array's length.</li>
<li>Indexing a letter count with <code>c - 'a'</code> when the input may contain capitals or spaces.</li>
</ul>
<h2>Check yourself</h2>
<p>Which pattern fits "find the length of the longest run of days on which sales never dropped"?</p>
<details><summary>Answer</summary><p>A sliding window (or a single pass with a running count): extend the run while each day is at least the previous one, and start a new run when sales drop.</p></details>`,
        },
        { kind: 'practice', question: 'dsa-two-sum' },
      ],
    },
  ],
  assignments: ['Programming Foundations: Problem Solving'],
  tests: [
    {
      title: 'Programming Foundations — on-demand practice test',
      kind: 'practice',
      description:
        'A short self-check you can take any time: how Java runs your code, comparing and changing strings, and the cost of loops, searches and recursion. Retake it until you score full marks, then move on to the module practice problems.',
      durationMinutes: 20,
      sections: [
        {
          title: 'Java basics',
          questions: ['java-jdk-jre-jvm', 'java-string-equals', 'java-string-immutable'],
        },
        {
          title: 'Problem solving',
          questions: [
            'dsa-nested-loop-cost',
            'dsa-binary-search-cost',
            'dsa-recursion-base-case',
            'dsa-hashmap-cost',
          ],
        },
      ],
    },
    {
      title: 'Programming Foundations — final test',
      kind: 'final',
      description:
        'The end-of-course test, covering every module: running Java, strings and collections, recursion, stacks and queues, hashing, searching, sorting and Big-O. Read each question fully before you answer.',
      durationMinutes: 40,
      sections: [
        {
          title: 'Java and data',
          questions: [
            'java-jdk-jre-jvm',
            'java-string-equals',
            'java-string-immutable',
            'java-arraylist-vs-linkedlist',
            'java-hashmap-order',
          ],
        },
        {
          title: 'Algorithms and efficiency',
          questions: [
            'dsa-nested-loop-cost',
            'dsa-binary-search-cost',
            'dsa-recursion-base-case',
            'dsa-hashmap-cost',
            'dsa-stack-queue',
            'dsa-sorting-stable',
          ],
        },
      ],
    },
  ],
};
