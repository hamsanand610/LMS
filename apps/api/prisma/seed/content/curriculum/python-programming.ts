import type { CurriculumCourse } from './types.js';

const TUTORIAL = 'https://docs.python.org/3/tutorial';
const LIBRARY = 'https://docs.python.org/3/library';

export const COURSE: CurriculumCourse = {
  slug: 'python-programming',
  title: 'Python Programming',
  subject: 'python',
  level: 'beginner',
  description:
    'Go from your first print() to a small working project in Python 3.12. You will learn values and types, decisions and loops, lists, tuples, dictionaries and sets, functions and modules, files and exceptions, and classes and objects, with examples built around marks, bills and attendance and the mistakes interviewers like to ask about.',
  tags: ['python', 'python-3', 'programming-basics', 'beginner', 'oop', 'placement'],
  modules: [
    // ───────────────────────── Module 1 ─────────────────────────
    {
      title: 'Python basics and types',
      summary:
        'Run Python programs, store values in variables, and work with numbers, strings and booleans, including the conversions every piece of user input needs.',
      lessons: [
        {
          kind: 'article',
          title: 'Your first Python program and how Python runs it',
          minutes: 10,
          topic: 'Getting started',
          html: `<p>Python is often the first language people learn, and it is also what companies use for automation scripts, data analysis, web back ends and AI work. Its big appeal is short, readable code. In this lesson you will get a program running and understand what happens when you run it.</p>

<h2>Check your installation</h2>
<p>Install Python 3.12 or newer from python.org. Then open a terminal (Command Prompt or PowerShell on Windows) and ask for the version:</p>
<pre><code class="language-text">python --version
Python 3.12.7</code></pre>
<p>Your exact version number may differ. On Windows the <code>py</code> launcher also works (<code>py --version</code>); on macOS and Linux the command is often <code>python3</code>.</p>

<h2>Two ways to run Python</h2>
<ul>
<li><strong>The interactive shell.</strong> Type <code>python</code> and press Enter. You get a <code>&gt;&gt;&gt;</code> prompt where every line runs immediately and its value is shown. Perfect for quick experiments; leave with <code>exit()</code>.</li>
<li><strong>A script file.</strong> Save your code in a file ending in <code>.py</code> and run it with <code>python hello.py</code>. Real programs live in files.</li>
</ul>
<pre><code class="language-python"># hello.py: your first program
name = "Divya"
print("Hello,", name)
print("Welcome to SI Academy!")
print(7 * 24, "hours in a week")

print("2026", "10", "09", sep="-")   # sep replaces the space between items
print("Loading", end="...")          # end replaces the newline at the end
print("done")</code></pre>
<p>Output:</p>
<pre><code class="language-text">Hello, Divya
Welcome to SI Academy!
168 hours in a week
2026-10-09
Loading...done</code></pre>
<p>Anything after <code>#</code> on a line is a comment: Python ignores it, but the next person reading your code will thank you.</p>

<h2>Indentation is part of the language</h2>
<p>Java and C use braces to group statements. Python uses indentation — by convention, four spaces. The indented lines below belong to the <code>if</code>; the last line does not.</p>
<pre><code class="language-python">marks = 82
if marks &gt;= 40:
    print("Passed")
    print("Well done")
print("Result printed")</code></pre>

<h2>What happens when you run a script</h2>
<p>The standard Python (called CPython) first reads your whole file and compiles it to <em>bytecode</em>, a compact set of instructions. If there is a syntax error anywhere, you see it now and nothing runs. Then the Python virtual machine executes the bytecode one statement at a time. Most other errors, such as dividing by zero, appear only when the faulty line actually runs.</p>
<p>Python is also <strong>dynamically typed</strong>: you never declare that a variable holds a number or a string; Python works out the type of each value as the program runs.</p>

<h2>Common mistakes</h2>
<ul>
<li><code>Print("hi")</code> fails with <code>NameError</code>: Python is case-sensitive.</li>
<li>Mixing tabs and spaces for indentation causes <code>TabError</code> or <code>IndentationError</code>. Let your editor insert four spaces.</li>
<li>Writing <code>print "hi"</code> from old Python 2 tutorials gives a <code>SyntaxError</code>. In Python 3, <code>print</code> is a function and needs brackets.</li>
<li>Naming your own file <code>random.py</code> or <code>math.py</code>. Your file then hides the standard module with the same name.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>What does <code>print("a", "b", "c", sep="")</code> print?</summary><p><code>abc</code>: the separator between the items is now an empty string.</p></details>
<details><summary>A file has a missing bracket on its last line. Does the first line still run?</summary><p>No. Python compiles the whole file before running anything, so the syntax error stops the program before line 1 runs.</p></details>`,
          resources: [
            { title: 'The Python Tutorial', url: `${TUTORIAL}/index.html` },
            { title: 'Using the Python interpreter', url: `${TUTORIAL}/interpreter.html` },
          ],
        },
        {
          kind: 'article',
          title: 'Variables, numbers and arithmetic',
          minutes: 14,
          topic: 'Values and types',
          html: `<p>Programs are mostly about values — marks, prices, counts — and the calculations you do with them. This lesson covers how Python stores values in variables and the arithmetic rules that most often surprise beginners in tests and interviews.</p>

<h2>Variables are names for values</h2>
<p>A variable is created the moment you assign to it with <code>=</code>. There is no declaration and no type to write; you can even point the same name at a different kind of value later. <code>type()</code> tells you what a value is.</p>
<pre><code class="language-python">seats = 60
fee = 30000.0
course = "Python"
print(type(seats), type(fee), type(course))
seats = seats - 5          # the name now refers to a new value, 55
print(seats)</code></pre>
<p>Use lower-case names with underscores (<code>total_marks</code>, not <code>TotalMarks</code>). Names cannot start with a digit, and you should avoid reusing built-in names such as <code>list</code>, <code>sum</code> or <code>max</code> — you would hide the built-in function.</p>

<h2>Whole numbers and decimals</h2>
<p>Python's <code>int</code> has no size limit: <code>2 ** 100</code> is computed exactly. A <code>float</code> is a decimal number stored in binary, with about 15–16 significant digits of precision.</p>
<table>
<thead><tr><th>Operator</th><th>Meaning</th><th>Example</th><th>Result</th></tr></thead>
<tbody>
<tr><td><code>/</code></td><td>division, always a float</td><td><code>1250 / 4</code></td><td><code>312.5</code></td></tr>
<tr><td><code>//</code></td><td>floor division</td><td><code>1250 // 4</code></td><td><code>312</code></td></tr>
<tr><td><code>%</code></td><td>remainder</td><td><code>1250 % 4</code></td><td><code>2</code></td></tr>
<tr><td><code>**</code></td><td>power</td><td><code>2 ** 10</code></td><td><code>1024</code></td></tr>
</tbody>
</table>
<pre><code class="language-python">bill = 1250
friends = 4
print(bill / friends)     # 312.5   each person's exact share
print(bill // friends)    # 312     whole rupees each
print(bill % friends)     # 2       rupees left over
print(2 ** 100)           # 1267650600228229401496703205376

print(-7 // 2, -7 % 2)    # -4 1
print(-2 ** 2)            # -4: ** is applied before the minus sign</code></pre>
<p>Notice <code>-7 // 2</code>: Python rounds <em>down</em> towards negative infinity, giving −4. Java and C round towards zero and give −3. This difference is a favourite trick question.</p>

<h2>Floats are not exact</h2>
<pre><code class="language-python">import math

print(0.1 + 0.2)                      # 0.30000000000000004
print(0.1 + 0.2 == 0.3)               # False
print(round(0.1 + 0.2, 2))            # 0.3
print(math.isclose(0.1 + 0.2, 0.3))   # True</code></pre>
<p>Numbers like 0.1 cannot be stored exactly in binary, so tiny errors appear. Never compare floats with <code>==</code>; use <code>math.isclose</code>, and round only when displaying. For money, many programs count in whole paise (integers) or use the <code>decimal</code> module.</p>

<h2>Shortcuts you will use constantly</h2>
<ul>
<li><code>total += 5</code> means <code>total = total + 5</code>. Python has no <code>++</code> operator.</li>
<li><code>a, b = 5, 9</code> assigns two variables at once, and <code>a, b = b, a</code> swaps them without a temporary variable.</li>
</ul>

<h2>Common mistakes</h2>
<ul>
<li>Expecting <code>/</code> to give a whole number. <code>10 / 2</code> is <code>5.0</code>, a float.</li>
<li>Writing <code>count++</code>, which is a syntax error.</li>
<li>Naming a variable <code>sum</code> and then wondering why <code>sum([1, 2])</code> fails later.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>What are <code>17 // 5</code>, <code>17 % 5</code> and <code>2 ** 3 ** 2</code>?</summary><p>3, 2 and 512. Powers group from the right, so <code>2 ** 3 ** 2</code> is <code>2 ** 9</code>.</p></details>`,
          resources: [
            { title: 'An informal introduction to Python', url: `${TUTORIAL}/introduction.html` },
            {
              title: 'Floating-point arithmetic: issues and limitations',
              url: `${TUTORIAL}/floatingpoint.html`,
            },
          ],
        },
        {
          kind: 'article',
          title: 'Strings: indexing, slicing, methods and f-strings',
          minutes: 15,
          topic: 'Strings',
          html: `<p>Names, email addresses, roll numbers, whole lines of input — most real data arrives as text. Python's strings come with powerful indexing, slicing and a large set of methods, and f-strings make formatted output easy.</p>

<h2>Indexing and slicing</h2>
<p>A string is a sequence of characters, numbered from 0. Negative indices count from the end: <code>-1</code> is the last character. A <strong>slice</strong> <code>s[start:stop:step]</code> takes characters from <code>start</code> up to, but <em>not including</em>, <code>stop</code>.</p>
<pre><code class="language-python">word = "algorithm"
print(len(word))      # 9
print(word[0])        # a
print(word[-1])       # m
print(word[0:4])      # algo   positions 0, 1, 2, 3
print(word[-3:])      # thm    from the third-last to the end
print(word[::2])      # agrtm  every second character
print(word[::-1])     # mhtirogla  a step of -1 walks backwards</code></pre>
<p>Leaving out <code>start</code> means "from the beginning", leaving out <code>stop</code> means "to the end". A slice never raises an error for positions past the end — <code>word[5:100]</code> simply returns <code>"ithm"</code> — but a single index does: <code>word[100]</code> raises <code>IndexError</code>.</p>

<h2>Strings cannot be changed</h2>
<p>Strings are <strong>immutable</strong>. <code>word[0] = "A"</code> raises <code>TypeError</code>. Every method that seems to change a string returns a new one, so store the result: <code>word = word.upper()</code>.</p>

<h2>Methods worth knowing</h2>
<pre><code class="language-python">email = "  Priya.Sharma@Example.com "
clean = email.strip().lower()
print(clean)                           # priya.sharma@example.com
print(clean.split("@"))                # ['priya.sharma', 'example.com']
print("-".join(["2026", "10", "09"]))  # 2026-10-09
print(clean.replace(".", "_", 1))      # priya_sharma@example.com  (first dot only)
print("sharma" in clean)               # True
print(clean.startswith("priya"))       # True
print("2026".isdigit())                # True</code></pre>
<p><code>split()</code> with no argument splits on any run of spaces, tabs or newlines and ignores spaces at the ends — exactly what you want for reading words from a line of input.</p>

<h2>f-strings for formatted output</h2>
<p>Put an <code>f</code> before the quotes, and any expression inside <code>{}</code> is evaluated and inserted. After a colon you can add a format: decimal places, width and alignment, or a thousands separator.</p>
<pre><code class="language-python">name = "Arun"
marks = 456
total = 500
print(f"{name} scored {marks}/{total} ({marks / total * 100:.1f}%)")
print(f"{'Item':&lt;10}{'Price':&gt;8}")
print(f"{'Tea':&lt;10}{15:&gt;8}")
print(f"{'Samosa':&lt;10}{20:&gt;8}")
print(f"{1234567:,}")</code></pre>
<p>Output:</p>
<pre><code class="language-text">Arun scored 456/500 (91.2%)
Item         Price
Tea             15
Samosa          20
1,234,567</code></pre>
<p><code>&lt;10</code> means "left-align in 10 characters", <code>&gt;8</code> "right-align in 8", <code>.1f</code> "one decimal place" and <code>,</code> "group the thousands".</p>

<h2>Common mistakes</h2>
<ul>
<li><code>"Total: " + 5</code> raises <code>TypeError</code>: you cannot add a string and a number. Use an f-string or <code>str(5)</code>.</li>
<li>Calling <code>name.strip()</code> without storing the result, then wondering why the spaces are still there.</li>
<li>Forgetting that the stop index is excluded: <code>"python"[0:2]</code> is <code>"py"</code>, two characters.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>What is <code>"interview"[2:5]</code>?</summary><p><code>"ter"</code>: positions 2, 3 and 4.</p></details>
<details><summary>What is <code>"interview"[::-1][:4]</code>?</summary><p><code>"weiv"</code>: the reversed string is <code>"weivretni"</code>, and its first four characters are taken.</p></details>`,
          resources: [
            { title: 'Text sequence type: str', url: `${LIBRARY}/stdtypes.html` },
            { title: 'Input and output (formatted strings)', url: `${TUTORIAL}/inputoutput.html` },
          ],
        },
        {
          kind: 'article',
          title: 'Booleans, comparisons and reading user input',
          minutes: 14,
          topic: 'Values and types',
          html: `<p>Every decision a program makes comes down to a <code>True</code> or <code>False</code>. And almost every program needs input from somewhere. This lesson connects the two: comparing values, combining conditions, and turning typed text into numbers you can use.</p>

<h2>Comparisons and logic</h2>
<p>The comparison operators are <code>==</code>, <code>!=</code>, <code>&lt;</code>, <code>&gt;</code>, <code>&lt;=</code> and <code>&gt;=</code>, and each produces a <code>bool</code>. Combine them with <code>and</code>, <code>or</code> and <code>not</code>. Python also lets you chain comparisons the way you would write them in maths.</p>
<pre><code class="language-python">marks = 68
attendance = 82
print(marks &gt;= 40)                          # True
print(marks &gt;= 40 and attendance &gt;= 75)    # True: eligible for the certificate
print(60 &lt;= marks &lt; 75)                    # True: same as 60 &lt;= marks and marks &lt; 75
print(not marks &gt; 90)                       # True</code></pre>
<p><code>and</code> and <code>or</code> <strong>short-circuit</strong>: in <code>a and b</code>, if <code>a</code> is false, <code>b</code> is never evaluated. That lets you write safe checks such as <code>count &gt; 0 and total / count &gt; 50</code> without risking a division by zero.</p>

<h2>Truthy and falsy values</h2>
<p>Any value can be used where a condition is expected. These count as false: <code>False</code>, <code>None</code>, <code>0</code>, <code>0.0</code>, the empty string <code>""</code>, and empty collections such as <code>[]</code>, <code>{}</code> and <code>set()</code>. Everything else counts as true. So <code>if name:</code> means "if name is not empty".</p>
<p><code>None</code> is Python's "no value here". Test for it with <code>is None</code>, not <code>== None</code>: there is exactly one <code>None</code> object, and <code>is</code> checks for that very object.</p>

<h2>input() always gives you a string</h2>
<pre><code class="language-python">first = int(input("Marks in maths: "))
second = int(input("Marks in physics: "))
total = first + second
average = total / 2
print(f"Total: {total}, average: {average:.1f}")
print("Distinction" if average &gt;= 75 else "Keep going")</code></pre>
<p>If you type 78 and 85, the program prints <code>Total: 163, average: 81.5</code> and then <code>Distinction</code>. Without <code>int()</code>, <code>"78" + "85"</code> would join the text and give <code>"7885"</code>.</p>

<h3>Conversions at a glance</h3>
<table>
<thead><tr><th>Expression</th><th>Result</th></tr></thead>
<tbody>
<tr><td><code>int("42")</code></td><td><code>42</code></td></tr>
<tr><td><code>int(" 42 ")</code></td><td><code>42</code> — surrounding spaces are fine</td></tr>
<tr><td><code>int("4.5")</code></td><td><code>ValueError</code></td></tr>
<tr><td><code>int(4.9)</code></td><td><code>4</code> — drops the fraction</td></tr>
<tr><td><code>float("4.5")</code></td><td><code>4.5</code></td></tr>
<tr><td><code>str(42)</code></td><td><code>"42"</code></td></tr>
<tr><td><code>bool("False")</code></td><td><code>True</code> — any non-empty string is true</td></tr>
</tbody>
</table>

<h2>Reading input in coding rounds</h2>
<p>Online judges send all input at once, and the numbers may be on one line or several. Reading every token in one go handles both:</p>
<pre><code class="language-python">import sys

data = sys.stdin.read().split()   # every whitespace-separated piece, as strings
a, b = int(data[0]), int(data[1])
print(a + b)</code></pre>
<p>For a line like <code>12 30</code>, the classic one-liner is <code>a, b = map(int, input().split())</code>: <code>split</code> breaks the line into pieces and <code>map</code> applies <code>int</code> to each.</p>

<h2>Common mistakes</h2>
<ul>
<li>Comparing input with a number: <code>if input() == 5</code> is never true, because <code>"5"</code> is not <code>5</code>.</li>
<li>Writing <code>if x == "a" or "b":</code>. It means <code>(x == "a") or "b"</code>, and the non-empty string <code>"b"</code> is always true. Write <code>x == "a" or x == "b"</code>, or <code>x in ("a", "b")</code>.</li>
<li>Expecting <code>bool("False")</code> to be <code>False</code>.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>What does <code>print(0 or "default")</code> print?</summary><p><code>default</code>. <code>or</code> returns the first truthy value, and 0 is falsy.</p></details>`,
          resources: [
            {
              title: 'Built-in functions (input, int, float, str)',
              url: `${LIBRARY}/functions.html`,
            },
          ],
        },
        {
          kind: 'practice',
          question: 'add-two-numbers',
          title: 'Practice: read two numbers and print their sum',
          topic: 'Practice',
        },
        {
          kind: 'practice',
          question: 'reverse-a-string',
          title: 'Practice: print a line backwards',
          topic: 'Practice',
        },
      ],
    },

    // ───────────────────────── Module 2 ─────────────────────────
    {
      title: 'Control flow: decisions and loops',
      summary:
        'Make decisions with if, elif, else and match, repeat work with while and for loops, and steer loops with range, break, continue and the loop else clause.',
      lessons: [
        {
          kind: 'article',
          title: 'Making decisions with if, elif and else',
          minutes: 12,
          topic: 'Decisions',
          html: `<p>A program that always does the same thing is not very useful. <code>if</code> statements let it choose: pass or fail, discount or no discount, valid input or an error message. Python keeps the syntax small, but the order of your conditions matters a lot.</p>

<h2>if, elif, else</h2>
<pre><code class="language-python">marks = 68

if marks &gt;= 90:
    grade = "A+"
elif marks &gt;= 75:
    grade = "A"
elif marks &gt;= 60:
    grade = "B"
elif marks &gt;= 40:
    grade = "C"
else:
    grade = "F"

print(f"Marks {marks} -&gt; grade {grade}")   # Marks 68 -&gt; grade B</code></pre>
<p>Python checks the conditions from top to bottom and runs only the <strong>first</strong> block whose condition is true. The rest are skipped. <code>elif</code> ("else if") and <code>else</code> are optional.</p>

<h3>Why the order matters</h3>
<p>Suppose you wrote <code>if marks &gt;= 40</code> first. A student with 95 matches it, gets a C, and the A+ check is never reached. With <code>&gt;=</code> comparisons, test the <em>highest</em> threshold first.</p>

<h2>Combining conditions</h2>
<pre><code class="language-python">attendance = 72
marks = 81
if attendance &gt;= 75 and marks &gt;= 40:
    print("Certificate issued")
elif attendance &lt; 75:
    print("Attendance shortage")       # this one prints
else:
    print("Please take the re-test")</code></pre>
<p>Prefer one flat chain like this over <code>if</code> blocks nested three levels deep; it is easier to read and to test.</p>

<h2>One-line choices</h2>
<p>For a simple either-or value, the <strong>conditional expression</strong> reads almost like English:</p>
<pre><code class="language-python">marks = 38
status = "Pass" if marks &gt;= 40 else "Fail"
print(status)    # Fail</code></pre>

<h2>match for menus and fixed options</h2>
<p>Python 3.10 added <code>match</code>, which compares one value against several patterns. For simple menus it is tidier than a long <code>elif</code> chain. <code>case _</code> catches everything else.</p>
<pre><code class="language-python">choice = "2"
match choice:
    case "1":
        print("View marks")
    case "2":
        print("Download hall ticket")
    case "3" | "4":
        print("Contact the office")
    case _:
        print("Unknown option")</code></pre>
<p>This prints <code>Download hall ticket</code>. Unlike <code>switch</code> in Java or C, there is no fall-through and no <code>break</code> to forget.</p>

<h2>Common mistakes</h2>
<ul>
<li>Using <code>=</code> instead of <code>==</code> in a condition: <code>if marks = 40:</code> is a syntax error.</li>
<li>Writing <code>if marks &gt; 40 or &lt; 90:</code>. Each side needs a complete comparison; better still, write <code>40 &lt; marks &lt; 90</code>.</li>
<li>Forgetting the colon at the end of <code>if</code>, <code>elif</code> and <code>else</code> lines, or the indentation of the block.</li>
<li>Checking <code>if is_member == True:</code> — just write <code>if is_member:</code>.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>With the grading chain above, which grade does a mark of exactly 75 get?</summary><p>A. <code>75 &gt;= 90</code> is false, then <code>75 &gt;= 75</code> is true, so that block runs and the rest are skipped.</p></details>`,
          resources: [{ title: 'More control flow tools', url: `${TUTORIAL}/controlflow.html` }],
        },
        {
          kind: 'article',
          title: 'while loops: repeat until something changes',
          minutes: 12,
          topic: 'Loops',
          html: `<p>A <code>while</code> loop repeats a block for as long as its condition stays true. Use it when you do not know in advance how many repetitions you need: until a number runs out of digits, until savings reach a target, until the user types something valid.</p>

<h2>How it runs</h2>
<p>Python checks the condition. If it is true, it runs the body, then checks again. The moment the condition is false, the loop ends. Something inside the body must eventually make the condition false — otherwise the loop never stops.</p>

<h2>Example: digits of a number</h2>
<p><code>n % 10</code> gives the last digit and <code>n // 10</code> removes it. Repeat until nothing is left:</p>
<pre><code class="language-python">n = 90210
digits = 0
reversed_n = 0
while n &gt; 0:
    last = n % 10
    reversed_n = reversed_n * 10 + last
    digits += 1
    n //= 10
print(digits, reversed_n)    # 5 1209</code></pre>

<h3>Dry run</h3>
<table>
<thead><tr><th>n at start</th><th>last</th><th>reversed_n</th><th>digits</th></tr></thead>
<tbody>
<tr><td>90210</td><td>0</td><td>0</td><td>1</td></tr>
<tr><td>9021</td><td>1</td><td>1</td><td>2</td></tr>
<tr><td>902</td><td>2</td><td>12</td><td>3</td></tr>
<tr><td>90</td><td>0</td><td>120</td><td>4</td></tr>
<tr><td>9</td><td>9</td><td>1209</td><td>5</td></tr>
</tbody>
</table>
<p>The reversed number is 1209, not 01209 — a whole number has no leading zeros. If the leading zero mattered, you would work with the number as a string instead.</p>

<h2>Example: months to reach a savings goal</h2>
<pre><code class="language-python">target = 50000
saved = 0
months = 0
while saved &lt; target:
    saved += 6500
    months += 1
print(months, saved)    # 8 52000</code></pre>

<h2>Loop until the input is valid</h2>
<p>A common pattern is an "endless" loop that you leave with <code>break</code> once you have what you need:</p>
<pre><code class="language-python">while True:
    text = input("Enter marks (0-100): ")
    if text.isdigit() and 0 &lt;= int(text) &lt;= 100:
        marks = int(text)
        break                      # leave the loop
    print("Please enter a whole number from 0 to 100.")
print("Saved", marks)</code></pre>
<p>Because <code>and</code> short-circuits, <code>int(text)</code> only runs after <code>isdigit()</code> has confirmed the text is all digits, so it cannot crash.</p>

<h2>Common mistakes</h2>
<ul>
<li><strong>Infinite loops:</strong> forgetting <code>n //= 10</code> or <code>months += 1</code>. If your program seems frozen, press <kbd>Ctrl</kbd>+<kbd>C</kbd> to stop it and look for the missing update.</li>
<li>Using <code>/</code> instead of <code>//</code> to drop a digit. <code>n / 10</code> gives a float, and the loop runs far more times than you expect.</li>
<li>Using <code>while</code> where <code>for</code> is clearer — if you are counting through a known range, use <code>for</code> (next lesson).</li>
</ul>

<h2>Check yourself</h2>
<details><summary>How many times does the body of <code>while n &gt; 1: n //= 2</code> run when n starts at 20?</summary><p>Four times: 20 → 10 → 5 → 2 → 1.</p></details>`,
        },
        {
          kind: 'article',
          title: 'for loops with range, break, continue and else',
          minutes: 14,
          topic: 'Loops',
          html: `<p>Python's <code>for</code> loop walks through the items of a collection one at a time: the characters of a string, the items of a list, or a sequence of numbers from <code>range</code>. Most loops you write will be <code>for</code> loops.</p>

<h2>range: counting without a counter variable</h2>
<table>
<thead><tr><th>Call</th><th>Produces</th></tr></thead>
<tbody>
<tr><td><code>range(5)</code></td><td>0, 1, 2, 3, 4</td></tr>
<tr><td><code>range(1, 6)</code></td><td>1, 2, 3, 4, 5</td></tr>
<tr><td><code>range(0, 20, 5)</code></td><td>0, 5, 10, 15</td></tr>
<tr><td><code>range(10, 0, -3)</code></td><td>10, 7, 4, 1</td></tr>
</tbody>
</table>
<p>Like slicing, <code>range</code> includes the start and stops <em>before</em> the stop value.</p>
<pre><code class="language-python">n = 7
for i in range(1, 11):
    print(f"{n} x {i:&gt;2} = {n * i:&gt;3}")

even_total = 0
for k in range(2, 101, 2):
    even_total += k
print(even_total)          # 2550</code></pre>
<p>The first loop prints a neatly aligned table, from <code>7 x  1 =   7</code> down to <code>7 x 10 =  70</code>.</p>

<h2>Looping over strings and lists</h2>
<p>You can loop over any sequence directly — no index needed. When you <em>do</em> need the position as well, <code>enumerate</code> gives you both:</p>
<pre><code class="language-python">for ch in "SI":
    print(ch)

toppers = ["Asha", "Vikram", "Neha"]      # a list: the next module covers lists
for rank, name in enumerate(toppers, start=1):
    print(rank, name)</code></pre>

<h2>break and continue</h2>
<ul>
<li><code>break</code> leaves the loop immediately.</li>
<li><code>continue</code> skips the rest of this round and moves on to the next item.</li>
</ul>
<pre><code class="language-python">entries = ["78", "AB", "91", "64", "AB", "88"]   # AB = absent
present_total = 0
for entry in entries:
    if entry == "AB":
        continue                  # skip absentees
    present_total += int(entry)
print(present_total)              # 321</code></pre>

<h2>The loop else clause</h2>
<p>A <code>for</code> (or <code>while</code>) loop can have an <code>else</code> block. It runs only if the loop finished <em>without</em> hitting <code>break</code> — handy for "search, and report if nothing was found".</p>
<pre><code class="language-python">marks = [67, 82, 35, 90]
for m in marks:
    if m &lt; 40:
        print("Someone needs support:", m)
        break
else:
    print("Everyone passed")</code></pre>
<p>This prints <code>Someone needs support: 35</code>. Change 35 to 45 and it prints <code>Everyone passed</code>.</p>

<h2>Common mistakes</h2>
<ul>
<li>Expecting <code>range(1, 10)</code> to include 10. Use <code>range(1, n + 1)</code> to go up to n.</li>
<li>Writing <code>for i in range(len(names)): print(names[i])</code> when <code>for name in names: print(name)</code> says the same thing more clearly.</li>
<li>Adding or removing items of a list while looping over that same list. Loop over a copy, or build a new list.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>What does <code>for i in range(3): print(i, end=" ")</code> print?</summary><p><code>0 1 2</code> on one line, because <code>end=" "</code> replaces the newline with a space.</p></details>`,
          resources: [
            {
              title: 'More control flow tools: for, range, break',
              url: `${TUTORIAL}/controlflow.html`,
            },
          ],
        },
        {
          kind: 'article',
          title: 'Nested loops and printing patterns',
          minutes: 12,
          topic: 'Loops',
          html: `<p>A loop inside another loop is a <strong>nested loop</strong>. For every single round of the outer loop, the inner loop runs completely. Pattern-printing questions in campus tests are really exercises in this one idea — and so are tables, grids and "compare every pair" problems.</p>

<h2>Rows and columns</h2>
<p>Think of the outer loop as choosing the row and the inner loop as filling that row's columns.</p>
<pre><code class="language-python">rows = 4
for i in range(1, rows + 1):          # row number 1 .. 4
    for j in range(1, i + 1):         # row i has i numbers
        print(j, end=" ")
    print()                           # end the row</code></pre>
<p>Output:</p>
<pre><code class="language-text">1
1 2
1 2 3
1 2 3 4</code></pre>
<p>The empty <code>print()</code> after the inner loop matters: <code>end=" "</code> kept everything on one line, so we need one plain <code>print</code> to move to the next row.</p>

<h2>Using string repetition</h2>
<p>In Python, <code>"*" * 3</code> is <code>"***"</code>. That often replaces the inner loop entirely:</p>
<pre><code class="language-python">rows = 4
for i in range(1, rows + 1):
    print(" " * (rows - i) + "*" * (2 * i - 1))</code></pre>
<p>Output:</p>
<pre><code class="language-text">   *
  ***
 *****
*******</code></pre>
<p>Work out each row as "how many spaces, then how many stars?". Row i has <code>rows - i</code> spaces and <code>2i − 1</code> stars. Writing that formula down before coding is the whole trick.</p>

<h2>Every pair, once</h2>
<p>Starting the inner loop just after the outer position visits each pair exactly once:</p>
<pre><code class="language-python">team = ["Anu", "Bharath", "Chitra"]
for i in range(len(team)):
    for j in range(i + 1, len(team)):
        print(team[i], "&amp;", team[j])</code></pre>
<p>Output: <code>Anu &amp; Bharath</code>, <code>Anu &amp; Chitra</code>, <code>Bharath &amp; Chitra</code>.</p>

<h2>How much work is that?</h2>
<p>If the outer loop runs n times and the inner loop up to n times, the body runs up to n × n times. For 10 team members that is trivial; for 10 lakh records it is far too slow. Whenever you write a nested loop over the same data, pause and ask whether a dictionary or set could do the job in one pass — you will learn those in the next module.</p>

<h2>Leaving nested loops</h2>
<p><code>break</code> only leaves the <em>innermost</em> loop. To stop both, put the loops in a function and <code>return</code> (functions come in a later module), or set a flag and check it in the outer loop.</p>

<h2>Common mistakes</h2>
<ul>
<li>Forgetting the <code>print()</code> that ends each row, so everything appears on one line.</li>
<li>Reusing the same variable name for the inner and outer loop.</li>
<li>Getting a pattern off by one — always check row 1 and the last row against your formula.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>How would you print a right-angled triangle of stars, 5 rows, with the longest row first?</summary><p><code>for i in range(5, 0, -1): print("*" * i)</code></p></details>`,
        },
        {
          kind: 'practice',
          question: 'fizzbuzz-up-to-n',
          title: 'Practice: FizzBuzz up to n',
          topic: 'Practice',
        },
        {
          kind: 'practice',
          question: 'python-temperature-table',
          title: 'Practice: a Celsius to Fahrenheit table',
          topic: 'Practice',
        },
      ],
    },

    // ───────────────────────── Module 3 ─────────────────────────
    {
      title: 'Lists, tuples, dictionaries and sets',
      summary:
        'Store collections in lists and tuples, look things up by key with dictionaries, keep unique items in sets, and build new collections with comprehensions.',
      lessons: [
        {
          kind: 'article',
          title: 'Lists: ordered collections you can change',
          minutes: 14,
          topic: 'Lists',
          html: `<p>A list holds many values in order under one name: the marks of a class, the items in a cart, the lines of a file. Lists can grow, shrink and change, and they are the collection you will use most in Python.</p>

<h2>Creating and changing a list</h2>
<pre><code class="language-python">marks = [72, 85, 64, 90]
marks.append(78)            # add at the end:      [72, 85, 64, 90, 78]
marks.insert(0, 55)         # add at position 0:   [55, 72, 85, 64, 90, 78]
marks.remove(64)            # remove the first 64: [55, 72, 85, 90, 78]
last = marks.pop()          # remove and return the last item
print(marks, last)          # [55, 72, 85, 90] 78

print(len(marks), sum(marks), min(marks), max(marks))   # 4 302 55 90
print(sorted(marks, reverse=True))   # [90, 85, 72, 55]  a new list
marks.sort()                         # sorts this list in place
print(marks)                         # [55, 72, 85, 90]
print(85 in marks, marks.index(85))  # True 2
marks[0] = 60                        # lists can be changed by position
print(marks[1:3])                    # [72, 85]  slicing works as for strings</code></pre>
<p>Note the difference: <code>sorted(marks)</code> returns a <em>new</em> sorted list and leaves the original alone, while <code>marks.sort()</code> rearranges the list itself and returns <code>None</code>.</p>

<h2>Two names, one list</h2>
<p>Assignment never copies a list. It gives the same list a second name:</p>
<pre><code class="language-python">a = [1, 2, 3]
b = a              # b is another name for the same list
b.append(4)
print(a)           # [1, 2, 3, 4]  a changed too

c = a.copy()       # a real copy (a[:] or list(a) also work)
c.append(5)
print(a, c)        # [1, 2, 3, 4] [1, 2, 3, 4, 5]</code></pre>
<p>The same applies when you pass a list to a function: the function receives the same list and can change it.</p>

<h2>The grid trap</h2>
<pre><code class="language-python">grid = [[0] * 3] * 3       # three references to ONE inner list
grid[0][0] = 1
print(grid)                # [[1, 0, 0], [1, 0, 0], [1, 0, 0]]

grid = [[0] * 3 for _ in range(3)]   # three separate inner lists
grid[0][0] = 1
print(grid)                # [[1, 0, 0], [0, 0, 0], [0, 0, 0]]</code></pre>
<p>The second form is a list comprehension; you will meet comprehensions properly at the end of this module.</p>

<h2>What list operations cost</h2>
<table>
<thead><tr><th>Operation</th><th>Cost</th></tr></thead>
<tbody>
<tr><td><code>lst[i]</code>, <code>lst[i] = x</code>, <code>len(lst)</code></td><td>constant</td></tr>
<tr><td><code>append(x)</code>, <code>pop()</code> at the end</td><td>constant on average</td></tr>
<tr><td><code>insert(0, x)</code>, <code>pop(0)</code></td><td>grows with the list — everything shifts</td></tr>
<tr><td><code>x in lst</code>, <code>index(x)</code>, <code>remove(x)</code></td><td>grows with the list — a scan</td></tr>
</tbody>
</table>

<h2>Common mistakes</h2>
<ul>
<li><code>marks = marks.sort()</code> sets <code>marks</code> to <code>None</code>.</li>
<li>Removing items from a list while looping over it — items get skipped. Build a new list instead.</li>
<li>Calling <code>remove(x)</code> when x might be missing; it raises <code>ValueError</code>. Check with <code>in</code> first.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>After <code>x = [3, 1, 2]; y = x; y.sort()</code>, what is <code>x</code>?</summary><p><code>[1, 2, 3]</code>. <code>x</code> and <code>y</code> are the same list, and <code>sort</code> changed it in place.</p></details>`,
          resources: [
            { title: 'Data structures: more on lists', url: `${TUTORIAL}/datastructures.html` },
          ],
        },
        {
          kind: 'article',
          title: 'Tuples and unpacking',
          minutes: 10,
          topic: 'Tuples',
          html: `<p>A <strong>tuple</strong> is an ordered collection, like a list, that cannot be changed after it is created. That sounds like a restriction, but it is exactly what you want for values that belong together and should stay fixed: a date, a pair of coordinates, a name with its marks.</p>

<h2>Creating and unpacking tuples</h2>
<pre><code class="language-python">point = (12.97, 77.59)            # latitude, longitude
lat, lon = point                  # unpacking: one name per item
print(lat)                        # 12.97

student = ("Neha", "ECE", 88)
name, branch, marks = student
print(f"{name} ({branch}): {marks}")   # Neha (ECE): 88

a, b = 5, 9                       # the brackets are optional
a, b = b, a                       # swap: pack the right side, unpack into the left
print(a, b)                       # 9 5

first, *middle, last = [3, 8, 1, 9, 4]
print(first, middle, last)        # 3 [8, 1, 9] 4

print(type((5)), type((5,)))      # &lt;class 'int'&gt; &lt;class 'tuple'&gt;</code></pre>
<p>The last line shows a classic gotcha: brackets alone do not make a tuple — the <strong>comma</strong> does. <code>(5)</code> is just the number 5; a one-item tuple is written <code>(5,)</code>.</p>

<h2>Why use a tuple instead of a list?</h2>
<ul>
<li><strong>It signals intent.</strong> A tuple says "this is one record with a fixed shape"; a list says "a collection that may grow".</li>
<li><strong>It can be a dictionary key</strong> (as long as its items are unchangeable too). Lists cannot.</li>
<li><strong>Functions return several values as a tuple</strong>, which the caller unpacks.</li>
</ul>
<pre><code class="language-python">seats = {("A", 1): "Ravi", ("A", 2): "Sana"}   # row and seat number as one key
print(seats[("A", 2)])                         # Sana

def lowest_and_highest(values):
    return min(values), max(values)            # returns a tuple

low, high = lowest_and_highest([72, 85, 64, 90])
print(low, high)                               # 64 90

pairs = [("Asha", 88), ("Ravi", 72)]
for name, score in pairs:                      # unpacking in a for loop
    print(name, score)</code></pre>

<h2>Immutable, but only one level deep</h2>
<p><code>t = (1, [2, 3])</code> cannot have its items replaced, but the list inside it can still change: <code>t[1].append(4)</code> works. A tuple guarantees that its items are always the same <em>objects</em>, not that those objects never change.</p>

<h2>Common mistakes</h2>
<ul>
<li><code>t[0] = 10</code> raises <code>TypeError</code>: tuples do not support item assignment.</li>
<li>Unpacking into the wrong number of names: <code>a, b = (1, 2, 3)</code> raises <code>ValueError: too many values to unpack</code>.</li>
<li>Forgetting the trailing comma for a single-item tuple.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>What does <code>x, y, z = "abc"</code> do?</summary><p>It works: a string is a sequence, so x is <code>"a"</code>, y is <code>"b"</code> and z is <code>"c"</code>.</p></details>`,
          resources: [{ title: 'Tuples and sequences', url: `${TUTORIAL}/datastructures.html` }],
        },
        {
          kind: 'article',
          title: 'Dictionaries: looking things up by key',
          minutes: 15,
          topic: 'Dictionaries',
          html: `<p>A list answers "what is at position 3?". A <strong>dictionary</strong> answers "what is the fee for Python?" or "what are Ravi's marks?" — it maps <em>keys</em> to <em>values</em>. Looking up a key takes about the same time whether the dictionary has ten entries or ten lakh, because dictionaries are built on hash tables.</p>

<h2>The basics</h2>
<pre><code class="language-python">fees = {"Java Full Stack": 45000, "Python": 30000, "Testing": 25000}
print(fees["Python"])               # 30000
fees["Data Analytics"] = 40000      # add a new key
fees["Python"] = 32000              # change an existing value
del fees["Testing"]                 # remove a key
print(len(fees))                    # 3
print("Testing" in fees)            # False: "in" checks the keys
print(fees.get("Testing"))          # None instead of an error
print(fees.get("Testing", 0))       # 0: your own default

for course, fee in fees.items():
    print(f"{course:&lt;16}₹{fee:,}")</code></pre>
<p>Output of the loop:</p>
<pre><code class="language-text">Java Full Stack ₹45,000
Python          ₹32,000
Data Analytics  ₹40,000</code></pre>
<p>Since Python 3.7, dictionaries remember the order in which keys were first added; changing a value does not move its key.</p>

<h2>Pattern 1: counting</h2>
<pre><code class="language-python">attendance = ["P", "P", "A", "L", "P", "A", "P"]   # present, absent, late
summary = {}
for status in attendance:
    summary[status] = summary.get(status, 0) + 1
print(summary)          # {'P': 4, 'A': 2, 'L': 1}</code></pre>
<p><code>get(status, 0)</code> returns 0 the first time a status is seen, so you never hit a <code>KeyError</code>. The standard library's <code>collections.Counter</code> does the same job in one line: <code>Counter(attendance)</code>.</p>

<h2>Pattern 2: grouping</h2>
<pre><code class="language-python">students = [("Asha", "CSE"), ("Ravi", "ECE"), ("Meera", "CSE")]
by_branch = {}
for name, branch in students:
    by_branch.setdefault(branch, []).append(name)
print(by_branch)        # {'CSE': ['Asha', 'Meera'], 'ECE': ['Ravi']}</code></pre>
<p><code>setdefault(key, [])</code> returns the existing list for the key, or puts an empty one there first. Either way you can append straight away.</p>

<h2>Useful views and methods</h2>
<ul>
<li><code>d.keys()</code>, <code>d.values()</code>, <code>d.items()</code> — loop over keys, values, or key–value pairs. Looping over <code>d</code> itself gives the keys.</li>
<li><code>d.pop(key, default)</code> removes a key and returns its value.</li>
<li><code>d.update(other)</code> copies in all entries from another dictionary.</li>
<li><code>max(d, key=d.get)</code> finds the key with the largest value.</li>
</ul>

<h2>What can be a key?</h2>
<p>Keys must be <strong>hashable</strong>, which in practice means unchangeable: strings, numbers and tuples of those. A list cannot be a key — Python raises <code>TypeError: unhashable type: 'list'</code>. Values can be anything, including lists and other dictionaries.</p>

<h2>Common mistakes</h2>
<ul>
<li><code>d["missing"]</code> raises <code>KeyError</code>. Use <code>get</code> or check with <code>in</code> when a key may be absent.</li>
<li>Adding or deleting keys while looping over the same dictionary raises <code>RuntimeError</code>. Loop over <code>list(d)</code> instead.</li>
<li>Expecting <code>"Python" in fees.values()</code> to check the keys — it searches the values, and slowly.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>How do you find the course with the highest fee in <code>fees</code>?</summary><p><code>max(fees, key=fees.get)</code> — it compares the keys by their values. Here it returns <code>"Java Full Stack"</code>.</p></details>`,
          resources: [
            { title: 'Data structures: dictionaries', url: `${TUTORIAL}/datastructures.html` },
            { title: 'collections: Counter and friends', url: `${LIBRARY}/collections.html` },
          ],
        },
        {
          kind: 'article',
          title: 'Sets: unique items and fast membership',
          minutes: 10,
          topic: 'Sets',
          html: `<p>A <strong>set</strong> is an unordered collection with no duplicates. Use one whenever the question is "is this item in the group?" or "which items are in both groups?". Membership checks in a set are fast however large it grows, while the same check in a list scans item by item.</p>

<h2>Creating and using sets</h2>
<pre><code class="language-python">registered = {"Asha", "Ravi", "Meera", "Asha"}   # the repeat is dropped
print(len(registered))            # 3
registered.add("John")
registered.discard("Zara")        # no error if it is absent (remove would raise KeyError)
print("Ravi" in registered)       # True

empty = set()                     # {} would be an empty dict, not a set
cities = set(["Pune", "Chennai", "Pune"])
print(sorted(cities))             # ['Chennai', 'Pune']</code></pre>
<p>Sets have no order, so printing one can show its items in any order. Wrap it in <code>sorted()</code> when you need predictable output.</p>

<h2>Set operations</h2>
<pre><code class="language-python">workshop_a = {"Asha", "Ravi", "Meera", "John"}
workshop_b = {"Ravi", "John", "Fatima"}

print(sorted(workshop_a &amp; workshop_b))   # both:        ['John', 'Ravi']
print(sorted(workshop_a | workshop_b))   # either:      ['Asha', 'Fatima', 'John', 'Meera', 'Ravi']
print(sorted(workshop_a - workshop_b))   # only A:      ['Asha', 'Meera']
print(sorted(workshop_a ^ workshop_b))   # exactly one: ['Asha', 'Fatima', 'Meera']</code></pre>
<p>The operators have method versions too: <code>intersection</code>, <code>union</code>, <code>difference</code> and <code>symmetric_difference</code>, which also accept lists.</p>

<h2>Removing duplicates</h2>
<p><code>set(items)</code> removes duplicates but forgets the original order. When order matters, a dictionary does the trick, because its keys are unique and keep insertion order:</p>
<pre><code class="language-python">enquiries = ["Pune", "Chennai", "Pune", "Kochi", "Chennai"]
print(list(dict.fromkeys(enquiries)))    # ['Pune', 'Chennai', 'Kochi']</code></pre>

<h2>Why membership is fast</h2>
<p>Like dictionary keys, set items are stored in a hash table, so <code>x in my_set</code> takes roughly constant time. With 10 lakh roll numbers, checking membership in a list may compare against every item; in a set it jumps almost straight to the answer. If you test membership inside a loop, convert the list to a set once, before the loop.</p>

<h2>Common mistakes</h2>
<ul>
<li>Writing <code>{}</code> for an empty set. It creates an empty dictionary.</li>
<li>Indexing a set: <code>s[0]</code> raises <code>TypeError</code>. Sets have no positions.</li>
<li>Putting lists inside a set. Items must be hashable; use tuples instead.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>Two lists hold the roll numbers of students who submitted assignment 1 and assignment 2. How do you find who submitted only assignment 1?</summary><p><code>set(first) - set(second)</code>.</p></details>`,
          resources: [{ title: 'Data structures: sets', url: `${TUTORIAL}/datastructures.html` }],
        },
        {
          kind: 'article',
          title: 'Comprehensions: building collections in one line',
          minutes: 12,
          topic: 'Comprehensions',
          html: `<p>A very common loop looks like this: start with an empty list, go through some items, maybe skip a few, and append a transformed version of the rest. Python has a compact way to write exactly that loop: the <strong>comprehension</strong>. Interviewers like asking you to read one aloud.</p>

<h2>From loop to comprehension</h2>
<pre><code class="language-python">marks = [35, 72, 58, 91, 40, 66]

passed = []
for m in marks:
    if m &gt;= 40:
        passed.append(m)

passed_again = [m for m in marks if m &gt;= 40]
print(passed == passed_again, passed_again)   # True [72, 58, 91, 40, 66]</code></pre>
<p>Read <code>[m for m in marks if m &gt;= 40]</code> left to right as: "a list of m, for each m in marks, keeping only those where m is at least 40". The parts appear in the same order as in the loop, except that the value being collected moves to the front.</p>

<h2>Transforming and choosing</h2>
<pre><code class="language-python">marks = [35, 72, 58, 91, 40, 66]
boosted = [min(m + 5, 100) for m in marks]
labels = ["pass" if m &gt;= 40 else "fail" for m in marks]
print(boosted)   # [40, 77, 63, 96, 45, 71]
print(labels)    # ['fail', 'pass', 'pass', 'pass', 'pass', 'pass']</code></pre>
<p>Notice the two different <code>if</code>s. An <code>if</code> at the <em>end</em> filters items out. An <code>if … else</code> at the <em>front</em> is a conditional expression that chooses a value for every item.</p>

<h2>Dictionary and set comprehensions</h2>
<pre><code class="language-python">names = ["Asha", "Ravi", "Meenakshi"]
lengths = {name: len(name) for name in names}
print(lengths)                    # {'Asha': 4, 'Ravi': 4, 'Meenakshi': 9}

words = ["Python", "java", "PYTHON", "Java", "sql"]
distinct = {w.lower() for w in words}
print(sorted(distinct))           # ['java', 'python', 'sql']

scores = {"Asha": 88, "Ravi": 39, "Neha": 64}
needs_help = {name: s for name, s in scores.items() if s &lt; 40}
print(needs_help)                 # {'Ravi': 39}</code></pre>

<h2>Two loops in one</h2>
<p>With more than one <code>for</code>, write them in the same order as nested loops:</p>
<pre><code class="language-python">timetable = [["Maths", "Physics"], ["Python"], ["SQL", "Aptitude"]]
subjects = [s for day in timetable for s in day]
print(subjects)    # ['Maths', 'Physics', 'Python', 'SQL', 'Aptitude']</code></pre>
<p>This flattens exactly one level of nesting. Lists nested to <em>any</em> depth need recursion, which you will meet in the next module.</p>

<h2>When not to use one</h2>
<ul>
<li>When the loop exists for a side effect such as printing. Use a normal <code>for</code> loop.</li>
<li>When it no longer fits comfortably on one or two lines. Readability beats cleverness.</li>
<li>When you only need a total: <code>sum(m * m for m in marks)</code> (a generator expression, no square brackets) avoids building a list at all.</li>
</ul>

<h2>Common mistakes</h2>
<ul>
<li>Putting a filter <code>if</code> with an <code>else</code> at the end: <code>[m for m in marks if m &gt; 40 else 0]</code> is a syntax error.</li>
<li>Expecting a comprehension variable to leak out after it finishes — in Python 3 it does not.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>What is <code>[n * n for n in range(1, 6) if n % 2 == 0]</code>?</summary><p><code>[4, 16]</code>: the even numbers from 1 to 5 are 2 and 4, squared.</p></details>`,
          resources: [{ title: 'List comprehensions', url: `${TUTORIAL}/datastructures.html` }],
        },
        {
          kind: 'practice',
          question: 'python-squares',
          title: 'Practice: squares up to n with a comprehension',
          topic: 'Practice',
        },
        {
          kind: 'practice',
          question: 'python-count-each-word',
          title: 'Practice: count each word, in order',
          topic: 'Practice',
        },
      ],
    },
    // ───────────────────────── Module 4 ─────────────────────────
    {
      title: 'Functions and modules',
      summary:
        'Package logic into reusable functions with parameters and return values, avoid the scope and default-argument traps, write recursive functions, and organise code into modules.',
      lessons: [
        {
          kind: 'article',
          title: 'Defining functions: parameters and return values',
          minutes: 14,
          topic: 'Functions',
          html: `<p>Once a piece of logic appears twice in your program, it belongs in a <strong>function</strong>: write it once, give it a clear name, and call it wherever you need it. Functions also make code testable, because you can check each one on its own.</p>

<h2>Defining and calling</h2>
<pre><code class="language-python">def percentage(scored, total):
    """Return scored as a percentage of total, rounded to one decimal place."""
    return round(scored / total * 100, 1)

print(percentage(456, 500))               # 91.2
print(percentage(scored=38, total=50))    # 76.0  keyword arguments: order no longer matters</code></pre>
<ul>
<li><code>def</code> starts the definition; <code>scored</code> and <code>total</code> are <strong>parameters</strong>.</li>
<li>The values you pass when calling, <code>456</code> and <code>500</code>, are <strong>arguments</strong>.</li>
<li>The string on the first line is a <strong>docstring</strong>; <code>help(percentage)</code> shows it.</li>
<li><code>return</code> sends a value back to the caller and ends the function.</li>
</ul>

<h2>return is not print</h2>
<pre><code class="language-python">def show_total(a, b):
    print(a + b)          # displays the value, gives nothing back

result = show_total(2, 3)    # prints 5
print(result)                # None</code></pre>
<p>A function without a <code>return</code> statement returns <code>None</code>. If the caller needs the value — to store it, compare it or pass it on — the function must <code>return</code> it. Printing inside helper functions is one of the most common beginner habits to unlearn.</p>

<h2>Returning several values</h2>
<pre><code class="language-python">def summary(values):
    return min(values), max(values), sum(values) / len(values)

low, high, mean = summary([72, 85, 64, 90])
print(low, high, mean)       # 64 90 77.75</code></pre>
<p>Python packs the three values into a tuple and the caller unpacks it.</p>

<h2>Default values and type hints</h2>
<pre><code class="language-python">def greet(name: str, greeting: str = "Hello") -&gt; str:
    return f"{greeting}, {name}!"

print(greet("Asha"))                 # Hello, Asha!
print(greet("Ravi", "Vanakkam"))     # Vanakkam, Ravi!</code></pre>
<p>Parameters with defaults must come after those without. The <strong>type hints</strong> (<code>: str</code>, <code>-&gt; str</code>) document what the function expects and returns, and editors use them to warn you about mistakes; Python itself does not enforce them at run time.</p>

<h2>Functions are values too</h2>
<p>You can pass a function to another function. The built-ins <code>sorted</code>, <code>min</code> and <code>max</code> accept a <code>key</code> function that says what to compare:</p>
<pre><code class="language-python">names = ["Meenakshi", "Ravi", "Asha", "Gopal"]
print(sorted(names, key=len))        # ['Ravi', 'Asha', 'Gopal', 'Meenakshi']
print(max(names, key=len))           # Meenakshi</code></pre>
<p>Sorting is stable, so Ravi stays ahead of Asha: both have four letters, and Ravi came first.</p>

<h2>Common mistakes</h2>
<ul>
<li>Forgetting <code>return</code>, then getting <code>None</code> and a confusing error later, such as <code>TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'</code>.</li>
<li>Writing <code>percentage</code> without brackets: that refers to the function itself instead of calling it.</li>
<li>Calling a function in a script before the line that defines it has run — you get <code>NameError</code>.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>What does <code>len(print("hi"))</code> do?</summary><p>It prints <code>hi</code>, then raises <code>TypeError</code>: <code>print</code> returns <code>None</code>, and <code>None</code> has no length.</p></details>`,
          resources: [{ title: 'Defining functions', url: `${TUTORIAL}/controlflow.html` }],
        },
        {
          kind: 'article',
          title: 'Scope, default-argument traps, *args and **kwargs',
          minutes: 14,
          topic: 'Functions',
          html: `<p>Functions behave in a few ways that catch out even experienced programmers coming from other languages. This lesson covers the two classic traps — variable scope and mutable default values — and the flexible <code>*args</code> and <code>**kwargs</code> parameters.</p>

<h2>Local and global names</h2>
<p>A name assigned inside a function is <strong>local</strong> to that function: it exists only while the function runs and cannot clash with names outside. A function can <em>read</em> names from the surrounding module, but the moment it assigns to a name, Python treats that name as local for the whole function.</p>
<pre><code class="language-python">count = 0

def broken_increment():
    count += 1          # UnboundLocalError when called: count is local here, but not yet set

def increment(value):
    return value + 1    # better: take the value in, give the new value back

count = increment(count)
print(count)            # 1</code></pre>
<p>Python looks names up in this order: Local, Enclosing function, Global (module), Built-in — "LEGB". There is a <code>global</code> keyword to assign to a module variable from inside a function, but code that passes values in and returns results is much easier to test and reason about.</p>

<h2>The mutable default trap</h2>
<p>Default values are evaluated <strong>once</strong>, when the <code>def</code> line runs — not each time the function is called. With an unchangeable default like <code>0</code> or <code>"Hello"</code> that never matters. With a list, every call that uses the default shares the same list:</p>
<pre><code class="language-python">def add_mark(mark, marks=[]):        # one list, created when def runs
    marks.append(mark)
    return marks

print(add_mark(70))     # [70]
print(add_mark(85))     # [70, 85]  the list from the first call is still there!

def add_mark_fixed(mark, marks=None):
    if marks is None:
        marks = []                   # a fresh list on every call
    marks.append(mark)
    return marks

print(add_mark_fixed(70))   # [70]
print(add_mark_fixed(85))   # [85]</code></pre>
<p>The rule: use <code>None</code> as the default for anything mutable (lists, dictionaries, sets) and create the real object inside the function.</p>

<h2>Any number of arguments: *args and **kwargs</h2>
<pre><code class="language-python">def total(*amounts):                 # extra positional arguments arrive as a tuple
    return sum(amounts)

print(total(120, 80, 45))            # 245
print(total())                       # 0

def profile(name, **details):        # extra keyword arguments arrive as a dict
    parts = [f"{key}={value}" for key, value in details.items()]
    return name + ": " + ", ".join(parts)

print(profile("Asha", branch="CSE", year=3))   # Asha: branch=CSE, year=3

bills = [120, 80, 45]
print(total(*bills))                 # 245: * spreads a list into separate arguments</code></pre>
<p>The names <code>args</code> and <code>kwargs</code> are only a convention; the <code>*</code> and <code>**</code> do the work.</p>

<h2>Common mistakes</h2>
<ul>
<li>Using a list or dictionary as a default value. Tools such as linters flag it, and interviewers ask about it.</li>
<li>Reaching for <code>global</code> to share data between functions instead of passing arguments and returning results.</li>
<li>Giving a local variable the same name as a built-in, such as <code>list</code> or <code>input</code>, inside a function that later needs the built-in.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>Why does <code>def f(x, items=()):</code> not suffer from the default trap?</summary><p>A tuple cannot be changed, so sharing one empty tuple between calls is harmless. The trap only bites when the default object is modified.</p></details>`,
          resources: [{ title: 'More on defining functions', url: `${TUTORIAL}/controlflow.html` }],
        },
        {
          kind: 'article',
          title: 'Recursion in Python',
          minutes: 14,
          topic: 'Recursion',
          html: `<p>A <strong>recursive</strong> function calls itself on a smaller piece of the problem. It is the natural tool for anything that contains smaller copies of itself: folders inside folders, comments with replies, lists inside lists. Every recursive function needs two parts: a <strong>base case</strong> that it answers directly, and a <strong>recursive case</strong> that moves towards the base case.</p>

<h2>Two examples</h2>
<pre><code class="language-python">def factorial(n):
    if n &lt;= 1:                      # base case
        return 1
    return n * factorial(n - 1)     # a smaller problem

def depth(item):
    """How deeply lists are nested: 0 for a number, 1 for a flat list."""
    if not isinstance(item, list):  # base case: not a list at all
        return 0
    if not item:                    # base case: an empty list
        return 1
    return 1 + max(depth(x) for x in item)

print(factorial(5))                 # 120
print(factorial(25))                # 15511210043330985984000000
print(depth(7))                     # 0
print(depth([1, 2, 3]))             # 1
print(depth([1, [2, [3, 4]], 5]))   # 3</code></pre>
<p>Python integers never overflow, so <code>factorial(25)</code> is exact — in Java a <code>long</code> would have overflowed long before.</p>

<h2>Tracing a call</h2>
<pre><code class="language-text">factorial(3)
  = 3 * factorial(2)
  = 3 * (2 * factorial(1))
  = 3 * (2 * 1)        &lt;- factorial(1) hits the base case
  = 6</code></pre>
<p>Each call waits for the one below it to return. Python keeps every waiting call on the <strong>call stack</strong>.</p>
<p><code>depth</code> shows the more interesting shape: the function calls itself once for <em>each</em> item, and combines the answers with <code>max</code>. The practice question in this module, flattening a nested list, has the same shape — for each item, either it is a number (collect it) or it is a list (recurse into it).</p>

<h2>The recursion limit</h2>
<p>CPython stops runaway recursion at a depth of about 1 000 calls by default (<code>sys.getrecursionlimit()</code> tells you the exact number) and raises <code>RecursionError</code>. That is plenty for nested data, but not for "count down from 1 lakh" — use a loop for simple repetition.</p>

<h2>Remembering answers with functools.cache</h2>
<p>Some recursive functions solve the same subproblem many times. A decorator from the standard library stores each answer the first time and reuses it:</p>
<pre><code class="language-python">from functools import cache

@cache
def ways(n):
    """Ways to tile a path n metres long with 1 m and 2 m slabs."""
    if n &lt;= 1:
        return 1
    return ways(n - 1) + ways(n - 2)   # the last slab was 1 m or 2 m long

print(ways(4))      # 5
print(ways(50))     # 20365011074</code></pre>
<p>Without <code>@cache</code>, <code>ways(50)</code> would make billions of calls; with it, each value from 0 to 50 is computed once.</p>

<h2>Common mistakes</h2>
<ul>
<li>A missing or unreachable base case — for example testing <code>n == 0</code> when n can jump past zero — leads to <code>RecursionError</code>.</li>
<li>Forgetting to <code>return</code> the recursive call's result, so the function quietly returns <code>None</code>.</li>
<li>Using recursion where a simple loop is clearer and has no depth limit.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>What does <code>depth([[], [[]]])</code> return?</summary><p>3. The outer list adds 1; its second item <code>[[]]</code> has depth 2 (a list containing an empty list, which counts as 1).</p></details>`,
          resources: [
            { title: 'functools: cache and lru_cache', url: `${LIBRARY}/functools.html` },
          ],
        },
        {
          kind: 'article',
          title: 'Modules, imports and the standard library',
          minutes: 14,
          topic: 'Modules',
          html: `<p>As programs grow, one file becomes hard to manage. Python lets you split code into <strong>modules</strong> — any <code>.py</code> file is one — and <code>import</code> what you need. Python also ships with a large <strong>standard library</strong>, so many everyday tasks need no installation at all.</p>

<h2>Importing</h2>
<pre><code class="language-python">import math
import random
from datetime import date
from collections import Counter

print(math.sqrt(144), math.ceil(4.2), math.floor(4.8))   # 12.0 5 4
print(random.randint(1, 6))                               # a dice roll: different each run
print(date(2026, 10, 9).strftime("%d %b %Y"))             # 09 Oct 2026
print(Counter("mississippi").most_common(2))              # [('i', 4), ('s', 4)]</code></pre>
<ul>
<li><code>import math</code> brings in the module; you write <code>math.sqrt</code>. The prefix makes it obvious where a name came from.</li>
<li><code>from datetime import date</code> brings in one name directly.</li>
<li><code>import numpy as np</code> gives a module a shorter name; you will see this style often with third-party libraries.</li>
</ul>

<h2>Writing your own module</h2>
<p>Put related functions in a file, and import them from another file in the same folder:</p>
<pre><code class="language-python"># marks_utils.py
def average(values):
    return sum(values) / len(values) if values else 0.0

def grade(mark):
    if mark &gt;= 75:
        return "A"
    if mark &gt;= 60:
        return "B"
    return "C" if mark &gt;= 40 else "F"

if __name__ == "__main__":
    # Runs only when this file is executed directly, not when it is imported.
    print(average([70, 80, 90]), grade(65))</code></pre>
<pre><code class="language-python"># report.py
from marks_utils import average, grade

marks = [82, 67, 45]
print(f"Average {average(marks):.1f}, grades {[grade(m) for m in marks]}")
# Average 64.7, grades ['A', 'B', 'C']</code></pre>

<h3>What is <code>__name__ == "__main__"</code> for?</h3>
<p>When Python runs a file directly, it sets that file's <code>__name__</code> to <code>"__main__"</code>. When the file is imported, <code>__name__</code> is the module's name instead. The check lets one file be both a reusable module and a runnable script — quick demos or tests at the bottom run only when you ask for them.</p>

<h2>Packages and third-party libraries</h2>
<p>A folder of modules is a <strong>package</strong>; you import from it with dots, such as <code>from reports.export import to_csv</code>. Libraries that are not in the standard library — <code>requests</code>, <code>pandas</code>, <code>pytest</code> — are installed with <code>pip</code>. Install them inside a <strong>virtual environment</strong>, a per-project folder of packages, so that two projects needing different versions of a library never interfere:</p>
<pre><code class="language-text">python -m venv .venv
.venv\\Scripts\\activate            (Windows)
source .venv/bin/activate         (macOS and Linux)
python -m pip install requests</code></pre>

<h2>Common mistakes</h2>
<ul>
<li>Naming your file after a module you import, such as <code>random.py</code>. Python imports your file instead, and <code>random.randint</code> "does not exist".</li>
<li><code>from module import *</code>, which dumps every name into your file and hides where each one came from.</li>
<li>Installing packages globally for every project, then fighting version conflicts later.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>You run <code>python report.py</code>. Does the <code>print</code> at the bottom of <code>marks_utils.py</code> run?</summary><p>No. When <code>report.py</code> imports it, <code>marks_utils.__name__</code> is <code>"marks_utils"</code>, so the <code>if __name__ == "__main__"</code> block is skipped.</p></details>`,
          resources: [
            { title: 'Modules', url: `${TUTORIAL}/modules.html` },
            { title: 'Virtual environments and packages', url: `${TUTORIAL}/venv.html` },
            { title: 'The Python Standard Library', url: `${LIBRARY}/index.html` },
          ],
        },
        {
          kind: 'practice',
          question: 'python-flatten-list',
          title: 'Practice: flatten a nested list with recursion',
          topic: 'Practice',
        },
        {
          kind: 'practice',
          question: 'second-largest-number',
          title: 'Practice: the second largest number',
          topic: 'Practice',
        },
      ],
    },

    // ───────────────────────── Module 5 ─────────────────────────
    {
      title: 'Files and exceptions',
      summary:
        'Read and write text and CSV files safely with the with statement, handle errors with try and except, and raise clear exceptions of your own.',
      lessons: [
        {
          kind: 'article',
          title: 'Reading and writing text files',
          minutes: 14,
          topic: 'Files',
          html: `<p>Variables disappear when a program ends. Files are how programs remember things between runs and exchange data with other programs: logs, reports, exported marks, configuration. Python makes the basics short — and the <code>with</code> statement makes them safe.</p>

<h2>Write, append, read</h2>
<pre><code class="language-python">from pathlib import Path

notes = ["Arrays start at index 0", "Strings are immutable", "Dicts keep insertion order"]

with open("notes.txt", "w", encoding="utf-8") as f:     # "w" creates or empties the file
    for line in notes:
        f.write(line + "\\n")                            # write adds no newline for you

with open("notes.txt", "a", encoding="utf-8") as f:     # "a" adds to the end
    f.write("Sets have no duplicates\\n")

with open("notes.txt", encoding="utf-8") as f:          # reading is the default mode
    for number, line in enumerate(f, start=1):
        print(number, line.rstrip("\\n"))

text = Path("notes.txt").read_text(encoding="utf-8")
print(text.count("\\n"), "lines")</code></pre>
<p>Output:</p>
<pre><code class="language-text">1 Arrays start at index 0
2 Strings are immutable
3 Dicts keep insertion order
4 Sets have no duplicates
4 lines</code></pre>

<h2>Why always use with</h2>
<p>An open file holds a resource from the operating system, and data you write may sit in a buffer until the file is closed. <code>with open(...) as f:</code> closes the file automatically when the block ends — even if an error happens inside it. Without <code>with</code>, you must remember to call <code>f.close()</code> on every path through your code.</p>

<h2>Modes</h2>
<table>
<thead><tr><th>Mode</th><th>Meaning</th></tr></thead>
<tbody>
<tr><td><code>"r"</code></td><td>read (the default); error if the file does not exist</td></tr>
<tr><td><code>"w"</code></td><td>write; creates the file, or <strong>erases</strong> it if it exists</td></tr>
<tr><td><code>"a"</code></td><td>append to the end; creates the file if needed</td></tr>
<tr><td><code>"x"</code></td><td>create; error if the file already exists</td></tr>
<tr><td>add <code>"b"</code></td><td>binary, for images and other non-text files: <code>"rb"</code>, <code>"wb"</code></td></tr>
</tbody>
</table>

<h2>Ways to read</h2>
<ul>
<li><code>for line in f:</code> reads one line at a time — the best choice for big files, because the whole file never has to fit in memory.</li>
<li><code>f.read()</code> returns everything as one string; <code>f.readlines()</code> returns a list of lines.</li>
<li>Every line you read ends with <code>"\\n"</code> (except possibly the last). Strip it with <code>rstrip("\\n")</code> or <code>strip()</code>.</li>
</ul>

<h2>Always say encoding="utf-8"</h2>
<p>Without it, Python uses the operating system's default encoding, which on some Windows machines is not UTF-8. A file containing names in Tamil, Hindi or with the ₹ sign may then fail to read, or read as garbage, on another computer.</p>

<h2>Where is the file?</h2>
<p>A plain file name like <code>"notes.txt"</code> is relative to the <strong>current working directory</strong> — the folder your terminal is in when you run the program, not necessarily the folder of the script. <code>pathlib.Path</code> helps build paths that work on every operating system: <code>Path("data") / "notes.txt"</code>.</p>

<h2>Common mistakes</h2>
<ul>
<li>Opening an existing file with <code>"w"</code> by accident, which wipes its contents instantly.</li>
<li>Forgetting the <code>"\\n"</code> when writing, so every line runs together.</li>
<li>Comparing a line read from a file with a value and forgetting that it still ends with a newline.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>You run the program above twice. How many lines does <code>notes.txt</code> have afterwards?</summary><p>Four. The second run's <code>"w"</code> erases the file before writing the three notes again, and then one line is appended.</p></details>`,
          resources: [
            { title: 'Reading and writing files', url: `${TUTORIAL}/inputoutput.html` },
            { title: 'pathlib', url: `${LIBRARY}/pathlib.html` },
          ],
        },
        {
          kind: 'article',
          title: 'Handling errors with try, except, else and finally',
          minutes: 15,
          topic: 'Exceptions',
          html: `<p>Users type letters where numbers belong, files go missing, networks drop. When something goes wrong at run time, Python raises an <strong>exception</strong>. If nothing handles it, the program stops and prints a traceback. With <code>try</code> and <code>except</code> you decide what happens instead.</p>

<h2>Reading a traceback</h2>
<pre><code class="language-text">Traceback (most recent call last):
  File "report.py", line 7, in &lt;module&gt;
    average = total / count
              ~~~~~~^~~~~~~
ZeroDivisionError: division by zero</code></pre>
<p>Read it from the bottom up: the last line names the exception and gives a message; the lines above show the file and line where it happened, and how the program got there.</p>

<h2>Exceptions you will meet most</h2>
<table>
<thead><tr><th>Exception</th><th>Typical cause</th></tr></thead>
<tbody>
<tr><td><code>ValueError</code></td><td><code>int("abc")</code>: right type, wrong value</td></tr>
<tr><td><code>TypeError</code></td><td><code>"5" + 3</code>: an operation on the wrong type</td></tr>
<tr><td><code>KeyError</code></td><td>a missing dictionary key</td></tr>
<tr><td><code>IndexError</code></td><td>a list position past the end</td></tr>
<tr><td><code>ZeroDivisionError</code></td><td>dividing by zero</td></tr>
<tr><td><code>FileNotFoundError</code></td><td>opening a file that does not exist</td></tr>
<tr><td><code>AttributeError</code></td><td>calling a method an object does not have</td></tr>
</tbody>
</table>

<h2>All four blocks together</h2>
<pre><code class="language-python">def average_from_text(text):
    try:
        values = [int(part) for part in text.split()]
        result = sum(values) / len(values)
    except ValueError:
        print(f"Not whole numbers: {text!r}")
        return None
    except ZeroDivisionError:
        print("No numbers given")
        return None
    else:
        return round(result, 2)       # runs only if the try block raised nothing
    finally:
        print("checked", repr(text))  # runs every time, even after a return

print(average_from_text("70 85 90"))
print(average_from_text("70 eighty"))
print(average_from_text(""))</code></pre>
<p>Output:</p>
<pre><code class="language-text">checked '70 85 90'
81.67
Not whole numbers: '70 eighty'
checked '70 eighty'
None
No numbers given
checked ''
None</code></pre>
<p>Notice that <code>finally</code> runs <em>before</em> the returned value reaches the caller's <code>print</code>. That is why it is the place for clean-up that must always happen, such as closing a connection.</p>

<h2>Handle only what you expect</h2>
<p>Name the specific exceptions you can deal with. A bare <code>except:</code> or <code>except Exception: pass</code> also swallows your own bugs — a misspelt variable name becomes a silent wrong answer instead of a clear error. To catch several types in one place, use a tuple, and <code>as</code> to get the exception object:</p>
<pre><code class="language-python">try:
    marks = int("ninety")
except (ValueError, TypeError) as err:
    print("Could not read marks:", err)   # Could not read marks: invalid literal for int() with base 10: 'ninety'</code></pre>

<h2>Ask forgiveness or look before you leap?</h2>
<p>You can check first (<code>if key in fees:</code>) or just try and handle the failure (<code>try: fees[key] except KeyError:</code>). Python code often prefers the second style, nicknamed EAFP — "easier to ask forgiveness than permission" — especially when the check and the action could get out of step, as with files that may be deleted between the check and the open.</p>

<h2>Common mistakes</h2>
<ul>
<li>Putting a whole program inside one giant <code>try</code>. Keep the <code>try</code> block small so you know exactly which line failed.</li>
<li>Catching a general exception before a specific one: <code>except Exception</code> listed first means a later <code>except ValueError</code> never runs.</li>
<li>Printing an error and carrying on with a value that was never set.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>When does the <code>else</code> block of a <code>try</code> statement run?</summary><p>Only when the <code>try</code> block finished without raising an exception. It runs before <code>finally</code>.</p></details>`,
          resources: [
            { title: 'Errors and exceptions', url: `${TUTORIAL}/errors.html` },
            { title: 'Built-in exceptions', url: `${LIBRARY}/exceptions.html` },
          ],
        },
        {
          kind: 'article',
          title: 'Raising exceptions and creating your own',
          minutes: 12,
          topic: 'Exceptions',
          html: `<p>Handling errors is half the story. When <em>your</em> function receives something it cannot work with — a mark of 120, a negative fee — the right move is usually to <strong>raise</strong> an exception rather than print a message or return a magic value like <code>-1</code>. The caller then decides what to do, and the problem cannot be silently ignored.</p>

<h2>raise, and a custom exception class</h2>
<pre><code class="language-python">class InvalidMarksError(ValueError):
    """Raised when marks fall outside 0 to 100."""


def record_marks(name, marks):
    if not isinstance(marks, int):
        raise TypeError(f"marks must be a whole number, got {type(marks).__name__}")
    if not 0 &lt;= marks &lt;= 100:
        raise InvalidMarksError(f"{name}: {marks} is outside 0-100")
    return {"name": name, "marks": marks}


for name, marks in [("Asha", 88), ("Ravi", 120), ("Meera", "ninety")]:
    try:
        print(record_marks(name, marks))
    except InvalidMarksError as err:
        print("Rejected:", err)
    except TypeError as err:
        print("Wrong type:", err)</code></pre>
<p>Output:</p>
<pre><code class="language-text">{'name': 'Asha', 'marks': 88}
Rejected: Ravi: 120 is outside 0-100
Wrong type: marks must be a whole number, got str</code></pre>

<h2>Why define your own exception?</h2>
<ul>
<li><strong>Precise handling.</strong> Callers can catch <code>InvalidMarksError</code> without also catching every other <code>ValueError</code>.</li>
<li><strong>Sensible grouping.</strong> Because it inherits from <code>ValueError</code>, code that already catches <code>ValueError</code> still works.</li>
<li><strong>Readable intent.</strong> The class name explains the problem before anyone reads the message.</li>
</ul>
<p>A custom exception often needs nothing more than a docstring. By convention its name ends in <code>Error</code>.</p>

<h2>Re-raising with context</h2>
<p>Sometimes you catch a low-level error only to raise a clearer one. <code>raise … from err</code> keeps the original error attached, so the traceback shows both:</p>
<pre><code class="language-python">def fee_for(fees, course):
    try:
        return fees[course]
    except KeyError as err:
        raise LookupError(f"No fee is set for {course!r}") from err

fees = {"Python": 30000}
try:
    fee_for(fees, "Rust")
except LookupError as err:
    print(err)                  # No fee is set for 'Rust'</code></pre>
<p>Inside an <code>except</code> block, a bare <code>raise</code> re-raises the same exception unchanged — useful when you only want to log something and let the error continue.</p>

<h2>assert is for your own assumptions</h2>
<p><code>assert total &gt;= 0, "total went negative"</code> raises <code>AssertionError</code> if the condition is false. Use it to document things that should be impossible if your code is correct, never to validate user input: assertions are switched off when Python runs with the <code>-O</code> option.</p>

<h2>Common mistakes</h2>
<ul>
<li>Returning <code>-1</code> or <code>None</code> for bad input. The caller can forget to check, and the bad value travels further before anything fails.</li>
<li>Raising a bare <code>Exception("error")</code>. Pick the closest built-in type, or define your own.</li>
<li>Writing messages that say nothing: "Invalid input" is far less useful than "Ravi: 120 is outside 0-100".</li>
</ul>

<h2>Check yourself</h2>
<details><summary>Would <code>except ValueError</code> catch an <code>InvalidMarksError</code>?</summary><p>Yes. <code>InvalidMarksError</code> is a subclass of <code>ValueError</code>, and an <code>except</code> clause catches the named class and all its subclasses.</p></details>`,
          resources: [
            {
              title: 'Errors and exceptions: raising and user-defined',
              url: `${TUTORIAL}/errors.html`,
            },
          ],
        },
        {
          kind: 'article',
          title: 'Working with CSV files',
          minutes: 13,
          topic: 'Files',
          html: `<p>CSV — comma-separated values — is the format spreadsheets, databases and many web apps use to export tables. It looks simple enough to split on commas yourself, but real CSV files contain quoted fields like <code>"Sharma, Priya"</code>, and a plain <code>split(",")</code> breaks them in two. Python's <code>csv</code> module handles all of that for you.</p>

<h2>Writing and reading with dictionaries</h2>
<pre><code class="language-python">import csv

rows = [
    {"name": "Asha", "subject": "Maths", "marks": 88},
    {"name": "Ravi", "subject": "Maths", "marks": 72},
    {"name": "Asha", "subject": "Physics", "marks": 91},
    {"name": "Ravi", "subject": "Physics", "marks": 65},
]

with open("marks.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["name", "subject", "marks"])
    writer.writeheader()
    writer.writerows(rows)

totals = {}
with open("marks.csv", newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):                 # each row is a dict keyed by the header
        name = row["name"]
        totals[name] = totals.get(name, 0) + int(row["marks"])   # values arrive as strings

for name, total in sorted(totals.items(), key=lambda item: item[1], reverse=True):
    print(f"{name:&lt;6}{total:&gt;4}")</code></pre>
<p>The file on disk:</p>
<pre><code class="language-text">name,subject,marks
Asha,Maths,88
Ravi,Maths,72
Asha,Physics,91
Ravi,Physics,65</code></pre>
<p>And the program's output:</p>
<pre><code class="language-text">Asha   179
Ravi   137</code></pre>

<h2>Three details that matter</h2>
<ul>
<li><strong><code>newline=""</code></strong> when opening a CSV file. The <code>csv</code> module manages line endings itself; without this, you can get blank lines between rows on Windows.</li>
<li><strong>Everything you read is a string.</strong> Convert numbers with <code>int()</code> or <code>float()</code> before calculating.</li>
<li><strong>The header row becomes the keys</strong> with <code>DictReader</code>, so your code refers to <code>row["marks"]</code> instead of a fragile <code>row[2]</code>.</li>
</ul>
<p>If a file has no header, use <code>csv.reader</code>, which gives each row as a list of strings, and <code>csv.writer</code> with <code>writerow([...])</code> for writing.</p>

<h2>About that sort key</h2>
<p><code>lambda item: item[1]</code> is a tiny unnamed function: given a <code>(name, total)</code> pair, it returns the total. <code>sorted</code> uses it to decide the order, and <code>reverse=True</code> puts the highest total first. To break ties alphabetically you could sort by the key <code>lambda item: (-item[1], item[0])</code> — highest total first, then name A to Z.</p>

<h2>Common mistakes</h2>
<ul>
<li>Splitting lines with <code>split(",")</code> and getting broken fields whenever a value contains a comma.</li>
<li>Adding marks read from the file without converting them: <code>"88" + "91"</code> is <code>"8891"</code>.</li>
<li>Opening the output file in <code>"a"</code> mode while testing, and getting a second header row in the middle of the file.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>How would you also print each student's average, given that each student has two subjects here?</summary><p>Keep a count per name alongside the total (for example a second dictionary, or a list of marks per name) and divide the total by the count when printing.</p></details>`,
          resources: [{ title: 'csv: CSV file reading and writing', url: `${LIBRARY}/csv.html` }],
        },
        {
          kind: 'practice',
          question: 'count-the-words',
          title: 'Practice: count the words in a line',
          topic: 'Practice',
        },
      ],
    },

    // ───────────────────────── Module 6 ─────────────────────────
    {
      title: 'Classes, objects and a mini project',
      summary:
        'Model real things with classes, objects, methods and inheritance, use dataclasses for simple records, then bring the whole course together in a small marks-report project.',
      lessons: [
        {
          kind: 'article',
          title: 'Classes and objects: bundling data with behaviour',
          minutes: 15,
          topic: 'Classes',
          html: `<p>So far your data has lived in separate variables, lists and dictionaries, with functions somewhere else acting on them. A <strong>class</strong> bundles data and the functions that work on it into one unit. A class is the blueprint; each <strong>object</strong> (or instance) made from it is one concrete thing — one student, one course, one wallet.</p>

<h2>A first class</h2>
<pre><code class="language-python">class Student:
    institute = "SI Academy"              # class attribute: shared by every student

    def __init__(self, name, roll_no):
        self.name = name                  # instance attributes: one set per object
        self.roll_no = roll_no
        self.marks = {}

    def add_mark(self, subject, mark):
        self.marks[subject] = mark

    def average(self):
        if not self.marks:
            return 0.0
        return sum(self.marks.values()) / len(self.marks)

    def __str__(self):
        return f"{self.roll_no} {self.name} ({self.average():.1f})"


asha = Student("Asha", "CS101")
asha.add_mark("Maths", 88)
asha.add_mark("Physics", 91)
ravi = Student("Ravi", "CS102")

print(asha)                               # CS101 Asha (89.5)
print(ravi)                               # CS102 Ravi (0.0)
print(asha.institute, Student.institute)  # SI Academy SI Academy</code></pre>

<h2>What each part does</h2>
<ul>
<li><code>__init__</code> runs automatically when you write <code>Student("Asha", "CS101")</code>. Its job is to set up the new object's attributes.</li>
<li><code>self</code> is the object the method is working on. <code>asha.add_mark("Maths", 88)</code> is really <code>Student.add_mark(asha, "Maths", 88)</code> — Python passes the object in as the first argument for you.</li>
<li><strong>Methods</strong> are functions defined inside the class. They read and change the object through <code>self</code>.</li>
<li><code>__str__</code> decides what <code>print(asha)</code> shows. Without it you would see something like <code>&lt;__main__.Student object at 0x…&gt;</code>.</li>
</ul>

<h2>Class attributes versus instance attributes</h2>
<p><code>institute</code> is defined on the class, so all students share one value. <code>name</code>, <code>roll_no</code> and <code>marks</code> are set on <code>self</code> inside <code>__init__</code>, so each student has their own. Be careful: if you wrote <code>marks = {}</code> at class level, every student would share <em>one</em> dictionary of marks — the same trap as a mutable default argument.</p>

<h2>Protecting an object's data</h2>
<p>Python has no <code>private</code> keyword. By convention, a name starting with an underscore means "internal — do not touch from outside". A <strong>property</strong> lets outsiders read a value like an attribute while the class controls how it changes:</p>
<pre><code class="language-python">class CanteenWallet:
    def __init__(self, balance=0):
        self._balance = balance

    @property
    def balance(self):
        return self._balance

    def pay(self, amount):
        if amount &gt; self._balance:
            raise ValueError("Not enough balance")
        self._balance -= amount


wallet = CanteenWallet(200)
wallet.pay(45)
print(wallet.balance)        # 155
# wallet.balance = 1000     # AttributeError: the property has no setter</code></pre>

<h2>Common mistakes</h2>
<ul>
<li>Forgetting <code>self</code> as the first parameter of a method: calling it then fails with <code>TypeError: … takes 0 positional arguments but 1 was given</code>.</li>
<li>Writing <code>name = name</code> instead of <code>self.name = name</code> in <code>__init__</code>. The value goes into a local variable and is lost.</li>
<li>Calling the class's methods on the class instead of an object, such as <code>Student.average()</code>.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>After <code>ravi.add_mark("Maths", 72)</code>, what does <code>print(ravi)</code> show?</summary><p><code>CS102 Ravi (72.0)</code>. Ravi's own marks dictionary now has one entry; Asha's is unaffected.</p></details>`,
          resources: [{ title: 'Classes', url: `${TUTORIAL}/classes.html` }],
        },
        {
          kind: 'article',
          title: 'Special methods and dataclasses',
          minutes: 13,
          topic: 'Classes',
          html: `<p>Python's built-in operations — <code>print</code>, <code>==</code>, <code>&lt;</code>, <code>len</code>, <code>sorted</code> — work on your own objects if your class defines the matching <strong>special methods</strong>, the ones with double underscores (often called "dunder" methods). And for classes that mainly hold data, <code>@dataclass</code> writes the boring ones for you.</p>

<h2>Writing special methods by hand</h2>
<pre><code class="language-python">class Score:
    def __init__(self, name, points):
        self.name = name
        self.points = points

    def __repr__(self):                    # how the object looks in lists and the shell
        return f"Score({self.name!r}, {self.points})"

    def __eq__(self, other):               # what == means
        return isinstance(other, Score) and (self.name, self.points) == (other.name, other.points)

    def __lt__(self, other):               # what &lt; means: sorted, min and max use it
        return self.points &lt; other.points


scores = [Score("Ravi", 72), Score("Asha", 88), Score("Neha", 65)]
print(sorted(scores))                      # [Score('Neha', 65), Score('Ravi', 72), Score('Asha', 88)]
print(max(scores))                         # Score('Asha', 88)
print(Score("Ravi", 72) == Score("Ravi", 72))   # True</code></pre>
<ul>
<li><code>__repr__</code> should show an unambiguous, developer-friendly version; <code>__str__</code> (previous lesson) a friendly one for users. If only <code>__repr__</code> exists, <code>print</code> uses it.</li>
<li>Without <code>__eq__</code>, <code>==</code> on two objects checks whether they are the very same object.</li>
<li>Defining <code>__eq__</code> makes instances unhashable unless you also define <code>__hash__</code>, so they cannot go in sets or be dictionary keys.</li>
</ul>

<h2>Dataclasses: the same, without the typing</h2>
<pre><code class="language-python">from dataclasses import dataclass, field

@dataclass
class Course:
    title: str
    fee: int
    seats: int = 30
    tags: list[str] = field(default_factory=list)   # a new list for each course


python = Course("Python", 30000)
java = Course("Java Full Stack", 45000, seats=40)
print(python)            # Course(title='Python', fee=30000, seats=30, tags=[])
print(python == Course("Python", 30000))           # True: compares the fields

for c in sorted([java, python, Course("Testing", 25000)], key=lambda c: c.fee):
    print(c.title, c.fee)</code></pre>
<p>The loop prints Testing 25000, Python 30000 and Java Full Stack 45000. From the annotated fields, <code>@dataclass</code> generates <code>__init__</code>, <code>__repr__</code> and <code>__eq__</code>. Useful options:</p>
<ul>
<li><code>@dataclass(frozen=True)</code> makes objects read-only and hashable — good for values used as dictionary keys.</li>
<li><code>@dataclass(order=True)</code> adds <code>&lt;</code>, <code>&gt;</code> and friends, comparing fields in order.</li>
<li><code>field(default_factory=list)</code> is how you give each object its own empty list. Writing <code>tags: list[str] = []</code> is refused with a <code>ValueError</code>, precisely to save you from the shared-default trap.</li>
</ul>

<h2>When to choose what</h2>
<p>Use a dataclass when the class is mostly a record of named fields with a few methods. Write a regular class when construction needs real logic or the object's behaviour matters more than its data. For two or three values that never need methods, a tuple may be enough.</p>

<h2>Common mistakes</h2>
<ul>
<li>Forgetting the type annotation on a dataclass field: a plain <code>seats = 30</code> is a class attribute, not a field.</li>
<li>Comparing objects with <code>==</code> before defining <code>__eq__</code>, and being surprised that two identical-looking objects are "not equal".</li>
</ul>

<h2>Check yourself</h2>
<details><summary>What does <code>Course("SQL", 20000) == Course("SQL", 20000, seats=30)</code> give?</summary><p><code>True</code>. Every field matches, because 30 is the default for <code>seats</code>.</p></details>`,
          resources: [
            { title: 'dataclasses', url: `${LIBRARY}/dataclasses.html` },
            { title: 'Classes', url: `${TUTORIAL}/classes.html` },
          ],
        },
        {
          kind: 'article',
          title: 'Inheritance and polymorphism',
          minutes: 13,
          topic: 'Classes',
          html: `<p>An academy offers several kinds of course. They share most things — a title, a base fee, a description — but calculate the final fee differently. <strong>Inheritance</strong> lets the specialised classes reuse the shared code and change only what differs. <strong>Polymorphism</strong> lets the rest of your program treat them all the same way.</p>

<h2>A small hierarchy</h2>
<pre><code class="language-python">class Course:
    def __init__(self, title, base_fee):
        self.title = title
        self.base_fee = base_fee

    def fee(self):
        return self.base_fee

    def describe(self):
        return f"{self.title}: ₹{self.fee():,}"


class OnlineCourse(Course):
    def __init__(self, title, base_fee, discount_percent):
        super().__init__(title, base_fee)       # let the parent set its attributes
        self.discount_percent = discount_percent

    def fee(self):                              # override the parent's version
        return round(self.base_fee * (100 - self.discount_percent) / 100)


class ClassroomCourse(Course):
    LAB_CHARGE = 2500

    def fee(self):
        return self.base_fee + self.LAB_CHARGE


catalogue = [
    Course("Aptitude Booster", 8000),
    OnlineCourse("Python", 30000, 20),
    ClassroomCourse("Java Full Stack", 45000),
]
for course in catalogue:
    print(course.describe())                     # one call, three behaviours
print(isinstance(catalogue[1], Course))          # True: an OnlineCourse is a Course</code></pre>
<p>Output:</p>
<pre><code class="language-text">Aptitude Booster: ₹8,000
Python: ₹24,000
Java Full Stack: ₹47,500
True</code></pre>

<h2>What is happening</h2>
<ul>
<li><code>class OnlineCourse(Course)</code> means OnlineCourse <strong>inherits</strong> everything from Course: <code>title</code>, <code>base_fee</code> and the <code>describe</code> method.</li>
<li>Each subclass <strong>overrides</strong> <code>fee</code> with its own version.</li>
<li><code>describe</code> is written once, in Course, and calls <code>self.fee()</code>. Python looks up <code>fee</code> on the actual object, so the right version runs for each course. That is polymorphism: the same call, different behaviour depending on the object.</li>
<li><code>super().__init__(…)</code> runs the parent's initialiser so the shared attributes get set. <code>ClassroomCourse</code> defines no <code>__init__</code> at all, so it simply uses the parent's.</li>
</ul>

<h2>Duck typing</h2>
<p>Python does not insist on a shared parent class. Any object with a <code>fee()</code> and <code>describe()</code> method would work in that loop — "if it walks like a duck and quacks like a duck". Inheritance is a convenient way to share code, not the only way to make objects interchangeable.</p>

<h2>Inheritance or composition?</h2>
<p>Use inheritance for a genuine "is a" relationship: an online course <em>is a</em> course. For "has a" relationships — a batch <em>has</em> students, a student <em>has</em> a wallet — store the other object as an attribute instead. Deep inheritance chains quickly become hard to follow; two levels are usually plenty.</p>

<h2>Common mistakes</h2>
<ul>
<li>Writing an <code>__init__</code> in a subclass and forgetting <code>super().__init__(…)</code>, so attributes like <code>title</code> are never set and you get <code>AttributeError</code>.</li>
<li>Overriding a method with different parameters, so code written for the parent breaks when given the child.</li>
<li>Checking types with <code>type(x) == Course</code>, which is false for subclasses. Use <code>isinstance(x, Course)</code>.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>How would you add a weekend batch that costs 10% more than the base fee?</summary><p>Create <code>class WeekendCourse(Course)</code> and override <code>fee</code> to return <code>round(self.base_fee * 1.1)</code>. <code>describe</code> works for it without any change.</p></details>`,
          resources: [{ title: 'Classes: inheritance', url: `${TUTORIAL}/classes.html` }],
        },
        {
          kind: 'article',
          title: 'Mini project, part 1: planning a marks report tool',
          minutes: 12,
          topic: 'Mini project',
          html: `<p>Time to put the whole course together. Over two lessons you will build a small command-line tool that a trainer could actually use: it reads a text file of marks, skips bad lines with a clear warning, and prints a ranked report. This first part is about planning — the step most beginners skip, and the one that makes the coding easy.</p>

<h2>The requirements</h2>
<ol>
<li>Input is a text file in which each line holds <code>name subject marks</code>, separated by spaces, in any upper or lower case.</li>
<li>Blank lines are ignored.</li>
<li>A line is <strong>rejected with a warning</strong> (not a crash) if it does not have exactly three parts, if the mark is not a whole number, if the mark is outside 0–100, or if that student already has a mark for that subject.</li>
<li>The report lists each student's total, average and grade, highest total first; equal totals are ordered by name.</li>
<li>It also names the top scorer in each subject, and finally lists the warnings with their line numbers.</li>
</ol>

<h2>Sample input and the output we want</h2>
<pre><code class="language-text">asha maths 88
ravi maths 72
asha physics 91
ravi physics 65
meera maths 95
meera physics 79
john maths abc
ravi physics 70
neha maths 64
neha physics 120</code></pre>
<pre><code class="language-text">Name     Total  Average  Grade
Asha       179     89.5  A
Meera      174     87.0  A
Ravi       137     68.5  B
Neha        64     64.0  B
Top in Maths: Meera (95)
Top in Physics: Asha (91)
Skipped line 7: invalid literal for int() with base 10: 'abc'
Skipped line 8: Ravi already has a mark for Physics
Skipped line 10: mark 120 is outside 0-100</code></pre>
<p>Writing the expected output <em>before</em> coding gives you a ready-made test: when the program prints exactly this, you are done.</p>

<h2>Breaking it into pieces</h2>
<p>Each piece does one job and can be tested on its own:</p>
<pre><code class="language-python">def parse_line(line: str) -&gt; tuple[str, str, int]:
    """Turn 'asha maths 88' into ('Asha', 'Maths', 88), or raise ValueError."""
    ...

def grade(average: float) -&gt; str:
    """A for 75 and above, B for 60 and above, C for 40 and above, otherwise F."""
    ...

def build_reports(lines):
    """Return (reports by name, list of warnings) for all the lines."""
    ...

def print_report(reports, warnings):
    """Print the ranked table, the subject toppers and the warnings."""
    ...</code></pre>
<p>(<code>...</code> is a valid placeholder body in Python — handy for sketching.)</p>

<h2>Choosing the data structures</h2>
<ul>
<li>A small <strong>dataclass</strong> <code>StudentReport</code> holds one student's name and a dictionary of subject → mark, and computes the total and average. Its <code>add</code> method raises <code>ValueError</code> for a repeated subject — so rule 3's duplicate check lives with the data it protects.</li>
<li>A <strong>dictionary</strong> from name to <code>StudentReport</code> finds a student's record instantly as lines arrive in any order.</li>
<li>A <strong>list</strong> of warning strings, collected as we go, printed at the end.</li>
<li><strong>Sorting</strong> with the key <code>(-total, name)</code>: the minus sign puts the highest total first, and the name breaks ties alphabetically.</li>
</ul>

<h2>Where each course topic shows up</h2>
<table>
<thead><tr><th>Topic</th><th>Used for</th></tr></thead>
<tbody>
<tr><td>Strings</td><td>splitting lines, normalising case with <code>title()</code></td></tr>
<tr><td>Exceptions</td><td>rejecting a bad line without stopping the program</td></tr>
<tr><td>Dictionaries</td><td>records by name, marks by subject, toppers by subject</td></tr>
<tr><td>Classes</td><td>the <code>StudentReport</code> dataclass and its properties</td></tr>
<tr><td>Files and modules</td><td>reading the input file; the <code>__main__</code> check</td></tr>
</tbody>
</table>

<h2>Check yourself</h2>
<details><summary>Why is John missing from the expected report entirely?</summary><p>His only line has <code>abc</code> as the mark, so it is rejected. A student appears only once at least one valid mark has been recorded.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Mini project, part 2: building and testing the report',
          minutes: 20,
          topic: 'Mini project',
          html: `<p>With the plan from part 1, the code almost writes itself. Build it one function at a time, run it after each step, and compare against the expected output.</p>

<h2>The complete program</h2>
<pre><code class="language-python">"""marks_report.py: read 'name subject marks' lines and print a class report."""
import sys
from dataclasses import dataclass, field

PASS_MARK = 40


@dataclass
class StudentReport:
    name: str
    marks: dict[str, int] = field(default_factory=dict)

    def add(self, subject: str, mark: int) -&gt; None:
        if subject in self.marks:
            raise ValueError(f"{self.name} already has a mark for {subject}")
        self.marks[subject] = mark

    @property
    def total(self) -&gt; int:
        return sum(self.marks.values())

    @property
    def average(self) -&gt; float:
        return self.total / len(self.marks) if self.marks else 0.0


def grade(average: float) -&gt; str:
    if average &gt;= 75:
        return "A"
    if average &gt;= 60:
        return "B"
    if average &gt;= PASS_MARK:
        return "C"
    return "F"


def parse_line(line: str) -&gt; tuple[str, str, int]:
    parts = line.split()
    if len(parts) != 3:
        raise ValueError(f"expected 3 fields, found {len(parts)}")
    name, subject, text = parts
    mark = int(text)                          # raises ValueError for 'abc'
    if not 0 &lt;= mark &lt;= 100:
        raise ValueError(f"mark {mark} is outside 0-100")
    return name.title(), subject.title(), mark


def build_reports(lines):
    reports: dict[str, StudentReport] = {}
    warnings = []
    for number, line in enumerate(lines, start=1):
        if not line.strip():
            continue                          # ignore blank lines
        try:
            name, subject, mark = parse_line(line)
            if name not in reports:
                reports[name] = StudentReport(name)
            reports[name].add(subject, mark)
        except ValueError as err:
            warnings.append(f"line {number}: {err}")
    return reports, warnings


def print_report(reports, warnings):
    ranked = sorted(reports.values(), key=lambda r: (-r.total, r.name))
    print(f"{'Name':&lt;8}{'Total':&gt;6}{'Average':&gt;9}  Grade")
    for r in ranked:
        print(f"{r.name:&lt;8}{r.total:&gt;6}{r.average:&gt;9.1f}  {grade(r.average)}")

    toppers = {}                              # subject -&gt; (name, mark)
    for r in reports.values():
        for subject, mark in r.marks.items():
            best = toppers.get(subject)
            if best is None or mark &gt; best[1] or (mark == best[1] and r.name &lt; best[0]):
                toppers[subject] = (r.name, mark)
    for subject in sorted(toppers):
        name, mark = toppers[subject]
        print(f"Top in {subject}: {name} ({mark})")

    for warning in warnings:
        print("Skipped", warning)


def main():
    if len(sys.argv) &gt; 1:
        with open(sys.argv[1], encoding="utf-8") as f:
            lines = f.readlines()
    else:
        lines = sys.stdin.readlines()
    reports, warnings = build_reports(lines)
    print_report(reports, warnings)


if __name__ == "__main__":
    main()</code></pre>

<h2>Running it</h2>
<p>Save the sample input from part 1 as <code>marks.txt</code> next to the program and run <code>python marks_report.py marks.txt</code>. Because <code>main</code> falls back to standard input, <code>python marks_report.py &lt; marks.txt</code> works too — the same way online judges feed input to your solutions. Either way you should see exactly the expected report from part 1.</p>

<h2>Things worth noticing</h2>
<ul>
<li><strong>One <code>try</code> per line.</strong> A bad line adds a warning and the loop moves on; one typo in the file never loses the rest of the report.</li>
<li><strong>Validation raises, the caller decides.</strong> <code>parse_line</code> and <code>StudentReport.add</code> do not print anything; they raise <code>ValueError</code> with a precise message, and <code>build_reports</code> turns that into a warning.</li>
<li><strong>Properties keep data consistent.</strong> <code>total</code> and <code>average</code> are calculated from <code>marks</code> each time, so they can never go out of date.</li>
<li><strong>Ties are handled on purpose</strong>, both in the ranking and in the subject toppers, so the output is the same on every run.</li>
</ul>

<h2>Testing the pieces</h2>
<p>Because each function does one job, small checks are easy to write. Put these in a file next to the program and run it; silence means every check passed.</p>
<pre><code class="language-python"># check_marks_report.py
from marks_report import build_reports, grade, parse_line

assert parse_line("asha MATHS 88") == ("Asha", "Maths", 88)
assert grade(75) == "A" and grade(74.9) == "B" and grade(40) == "C" and grade(39.9) == "F"

try:
    parse_line("neha physics 120")
    raise AssertionError("an out-of-range mark should be rejected")
except ValueError:
    pass

reports, warnings = build_reports(["ravi maths 72", "ravi maths 80", "", "x y"])
assert reports["Ravi"].total == 72
assert len(warnings) == 2          # the duplicate subject and the two-field line</code></pre>
<p>When you later install <code>pytest</code> in a virtual environment, these checks become test functions almost unchanged.</p>

<h2>Ideas to extend it</h2>
<ul>
<li>Write the report to a CSV file with <code>csv.DictWriter</code> as well as printing it.</li>
<li>Add a "needs support" list of students whose average is below <code>PASS_MARK</code>.</li>
<li>Accept the pass mark as a second command-line argument.</li>
</ul>

<h2>Check yourself</h2>
<details><summary>What would change in the report if lines 4 and 8 swapped places, so that <code>ravi physics 70</code> came <em>before</em> <code>ravi physics 65</code>?</summary><p>Ravi's physics mark would be 70 (the first one recorded), giving a total of 142 and an average of 71.0. The warning would still name line 8, which now holds the 65. The rules decide which value wins, so write them down — as part 1 did.</p></details>`,
          resources: [
            { title: 'dataclasses', url: `${LIBRARY}/dataclasses.html` },
            { title: 'sys: command-line arguments (argv)', url: `${LIBRARY}/sys.html` },
          ],
        },
        {
          kind: 'practice',
          question: 'python-total-by-name',
          title: 'Practice: totals by learner, highest first',
          topic: 'Practice',
        },
      ],
    },
  ],
  assignments: ['Python Starter Pack'],
  tests: [
    {
      title: 'Python Programming — on-demand practice test',
      kind: 'practice',
      description:
        'A short self-check you can take any time: slicing, lists and tuples, comprehensions, dictionaries, identity versus equality, default arguments and virtual environments. Predict the output before you look at the options.',
      durationMinutes: 15,
      sections: [
        {
          title: 'Basics and collections',
          questions: [
            'python-slicing',
            'python-list-vs-tuple',
            'python-comprehension-output',
            'python-dict-get',
            'python-is-vs-equals',
          ],
        },
        {
          title: 'Functions and tooling',
          questions: ['python-mutable-default', 'python-venv'],
        },
      ],
    },
    {
      title: 'Python Programming — final test',
      kind: 'final',
      description:
        'The end-of-course test: every Python topic from the course, plus a few language-independent problem-solving questions on searching, sorting, hashing and queues that technical interviews expect Python developers to answer too.',
      durationMinutes: 30,
      sections: [
        {
          title: 'Python',
          questions: [
            'python-slicing',
            'python-list-vs-tuple',
            'python-comprehension-output',
            'python-dict-get',
            'python-is-vs-equals',
            'python-mutable-default',
            'python-venv',
          ],
        },
        {
          title: 'Problem solving',
          questions: [
            'dsa-binary-search-cost',
            'dsa-hashmap-cost',
            'dsa-sorting-stable',
            'dsa-stack-queue',
          ],
        },
      ],
    },
  ],
};
