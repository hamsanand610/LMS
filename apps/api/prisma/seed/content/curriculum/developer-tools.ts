import type { CurriculumCourse } from './types.js';

export const COURSE: CurriculumCourse = {
  slug: 'developer-tools',
  title: 'Developer Tools: Git, Testing and Deployment',
  subject: 'git',
  level: 'intermediate',
  description:
    'The everyday toolkit of a working developer: the command line, Git from first commit to pull request, build tools, unit tests with JUnit 5, continuous integration, deploying with proper configuration, containers and logs, and using AI coding assistants responsibly.',
  tags: ['git', 'command-line', 'junit', 'testing', 'ci-cd', 'deployment', 'docker', 'ai-tools'],
  modules: [
    {
      title: 'The command line',
      summary:
        'Moving around a terminal, working with files, pipes and redirection, and the environment variables, PATH and exit codes that every build and deployment tool relies on.',
      lessons: [
        {
          kind: 'article',
          title: 'Finding your way around a terminal',
          minutes: 15,
          topic: 'Terminal basics',
          html: `<p>Every tool in this course — Git, Maven, npm, Docker — is driven from a terminal. Most of them have buttons in an IDE too, but sooner or later a build fails on a server with no screen, a teammate pastes a command in chat, or an interviewer asks you to clone and run a project. Being calm at the command line is a basic professional skill, and a few hours of practice are enough to get there.</p>
<h2>Terminals, shells and prompts</h2>
<p>The <strong>terminal</strong> is the window; the <strong>shell</strong> is the program inside it that reads your command, runs it and prints the result. On Linux and macOS the shell is usually <code>bash</code> or <code>zsh</code>. On Windows you have PowerShell and the older Command Prompt, and installing Git for Windows also gives you <strong>Git Bash</strong>, which understands the same commands as Linux. This course uses bash syntax, because that is what servers and CI machines run.</p>
<p>The prompt — something like <code>priya@laptop:~/projects$</code> — tells you who you are, which machine you are on and which folder you are in. Every command runs <em>in that folder</em> unless you say otherwise.</p>
<h2>Where am I, and what is here?</h2>
<pre class="language-bash"><code class="language-bash">pwd            # print working directory: where you are
ls             # list the files in this folder
ls -la         # long format, including hidden files such as .gitignore
cd projects    # move into a folder
cd ..          # go up one level
cd ~           # go to your home folder
cd -           # go back to the folder you were just in</code></pre>
<p>Files and folders whose names start with a dot are hidden. Git keeps its whole database in a hidden <code>.git</code> folder, which is why a plain <code>ls</code> does not show it.</p>
<h3>Absolute and relative paths</h3>
<p>An <strong>absolute path</strong> starts from the root: <code>/home/priya/projects/fees-app</code> on Linux, or <code>C:\\Users\\Priya\\projects</code> on Windows. A <strong>relative path</strong> starts from where you are now: if you are in <code>/home/priya</code>, then <code>projects/fees-app</code> names the same folder. A single dot (<code>.</code>) is the current folder and two dots (<code>..</code>) its parent, so <code>../notes</code> means "the notes folder next to this one".</p>
<h2>Typing less, and getting out of trouble</h2>
<ul>
<li><kbd>Tab</kbd> completes file and folder names. Type <code>cd pro</code> and press <kbd>Tab</kbd>; if the name is unique, the shell finishes it for you and you avoid typos.</li>
<li>The <kbd>↑</kbd> key brings back earlier commands; <code>history</code> lists them.</li>
<li><kbd>Ctrl</kbd>+<kbd>C</kbd> stops the running command — a server you started, or something that seems stuck.</li>
<li><code>clear</code> (or <kbd>Ctrl</kbd>+<kbd>L</kbd>) cleans the screen without changing anything else.</li>
</ul>
<p>Names with spaces need quotes: <code>cd "My Projects"</code>. Many developers avoid spaces in project folder names for exactly this reason.</p>
<h2>Getting help</h2>
<p>Almost every tool explains itself: <code>git --help</code>, <code>mvn --help</code>, or <code>man ls</code> for the full manual on Linux (press <kbd>q</kbd> to quit). Reading the first screen of help is often faster than searching the web, and it always matches the version you have installed.</p>
<h2>Common mistakes</h2>
<ul>
<li>Running a command in the wrong folder. Before <code>git init</code> or <code>mvn package</code>, run <code>pwd</code>.</li>
<li>Mixing Windows and Linux habits: <code>dir</code> versus <code>ls</code>, backslashes versus forward slashes. In Git Bash, use forward slashes.</li>
<li>Panicking at a blinking cursor. If nothing seems to happen, the command may be waiting for input; <kbd>Ctrl</kbd>+<kbd>C</kbd> gets you out.</li>
</ul>
<h3>Check yourself</h3>
<p>You are in <code>/home/arjun/projects/library</code>. Where does <code>cd ../../notes</code> take you?</p>
<details><summary>Answer</summary><p>To <code>/home/arjun/notes</code>. The first <code>..</code> goes up to <code>/home/arjun/projects</code>, the second up to <code>/home/arjun</code>, and then you enter <code>notes</code>.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Files, pipes and redirection',
          minutes: 15,
          topic: 'Terminal basics',
          html: `<p>Once you can move around, the next step is changing things: creating folders, copying files, searching inside them and chaining commands together. These are the moves you will use when you set up a project, read a log on a server or write a small build script.</p>
<h2>Creating, copying, moving and deleting</h2>
<pre class="language-bash"><code class="language-bash">mkdir fees-app               # make a folder
mkdir -p src/main/java       # make nested folders in one go
touch README.md              # create an empty file
cp README.md README.bak      # copy a file
cp -r src src-backup         # copy a folder and everything inside it
mv README.bak notes.md       # move or rename
rm notes.md                  # delete a file
rm -r src-backup             # delete a folder and its contents</code></pre>
<p><code>rm</code> does not use a recycle bin: what it deletes is gone. Before <code>rm -r</code>, run <code>ls</code> on the same path to see exactly what you are about to remove, and never run a delete command copied from somewhere without reading it first.</p>
<h2>Looking inside files</h2>
<ul>
<li><code>cat notes.md</code> prints a whole file — fine for short files.</li>
<li><code>less app.log</code> opens a long file one screen at a time; <kbd>/</kbd> searches and <kbd>q</kbd> quits.</li>
<li><code>head -n 20 app.log</code> and <code>tail -n 20 app.log</code> show the first or last 20 lines.</li>
<li><code>tail -f app.log</code> keeps following the file as new lines are written — the standard way to watch a running server's log.</li>
<li><code>grep "ERROR" app.log</code> prints only the lines containing ERROR; <code>grep -i</code> ignores case, and <code>grep -r "TODO" src</code> searches a whole folder.</li>
</ul>
<h2>Redirection and pipes</h2>
<p>Commands print to the screen by default. You can send that output somewhere else:</p>
<pre class="language-bash"><code class="language-bash">git log --oneline &gt; history.txt      # write output to a file (replacing it)
echo "build finished" &gt;&gt; build.log    # append to the end of a file
grep "ERROR" app.log | wc -l           # count the error lines
ls src | sort                          # list, then sort the list</code></pre>
<p>The pipe <code>|</code> feeds the output of one command into the next. Small tools joined by pipes answer surprisingly useful questions: <code>grep "ERROR" app.log | tail -n 5</code> shows the five most recent errors in a log of a million lines.</p>
<h3>Running commands one after another</h3>
<p><code>a &amp;&amp; b</code> runs <code>b</code> only if <code>a</code> succeeded; <code>a ; b</code> runs both whatever happens. The difference matters:</p>
<pre class="language-bash"><code class="language-bash">mvn test &amp;&amp; git push      # push only if the tests pass</code></pre>
<p>With a semicolon instead of <code>&amp;&amp;</code>, a failing test run would still be followed by a push.</p>
<h2>Common mistakes</h2>
<ul>
<li>Using <code>&gt;</code> when you meant <code>&gt;&gt;</code>, and wiping a file you only wanted to add to.</li>
<li>Opening a huge log with <code>cat</code> and scrolling for minutes. Use <code>grep</code>, <code>tail</code> or <code>less</code>.</li>
<li>Forgetting quotes around search text that contains spaces: write <code>grep "connection refused" app.log</code>.</li>
</ul>
<h3>Check yourself</h3>
<p>Write one command that saves every line containing <code>WARN</code> from <code>server.log</code> into a new file called <code>warnings.txt</code>.</p>
<details><summary>Answer</summary><p><code>grep "WARN" server.log &gt; warnings.txt</code>. Use <code>&gt;&gt;</code> instead if you want to add to an existing file rather than replace it.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Environment variables, PATH and exit codes',
          minutes: 15,
          topic: 'Terminal basics',
          html: `<p>When you type <code>java</code> or <code>git</code>, how does the shell know which program to run? And how does a build script know whether a step worked? The answers — the PATH, environment variables and exit codes — come up constantly in setup problems, CI pipelines and deployments, so they are worth understanding properly.</p>
<h2>Environment variables</h2>
<p>An environment variable is a named value that every program started from your shell can read. Some are set for you; you can add your own:</p>
<pre class="language-bash"><code class="language-bash">echo $HOME           # your home folder
echo $USER           # your user name
export APP_ENV=dev   # set a variable for this shell and the programs it starts
echo $APP_ENV        # prints: dev
env                  # list all of them</code></pre>
<p>A variable set with <code>export</code> lasts only until you close that terminal. To make it permanent you add the line to a start-up file such as <code>~/.bashrc</code>, or use the system settings on Windows. In the deployment module you will see why environment variables are also the standard way to hand configuration and secrets to a running application.</p>
<h2>PATH: how commands are found</h2>
<p><code>PATH</code> is a list of folders, separated by <code>:</code> (or <code>;</code> on Windows). When you type a command, the shell looks through those folders, in order, for a program with that name.</p>
<pre class="language-bash"><code class="language-bash">echo $PATH
which java       # which java program will run (Linux, macOS, Git Bash)
java -version    # and which version it is</code></pre>
<p>In the Windows Command Prompt the equivalent of <code>which</code> is <code>where</code>. "command not found" almost always means the program is not installed or its folder is not on the PATH. If <code>java -version</code> shows an older version than the one you just installed, an older Java folder appears earlier in the PATH.</p>
<h3>JAVA_HOME</h3>
<p>Many Java tools, Maven included, read <code>JAVA_HOME</code> to find the JDK. If Maven complains that it cannot find a compiler, check that <code>JAVA_HOME</code> points to a JDK folder — not a JRE, and not the <code>bin</code> folder inside the JDK.</p>
<h2>Exit codes: did it work?</h2>
<p>Every command finishes with a number called its <strong>exit code</strong>. Zero means success; anything else means failure. The shell keeps the last one in <code>$?</code>:</p>
<pre class="language-bash"><code class="language-bash">ls src
echo $?            # 0: it worked
ls no-such-folder
echo $?            # not 0: it failed</code></pre>
<p>This simple convention is what makes automation possible. <code>&amp;&amp;</code> checks it, and so does every CI system: when <code>mvn test</code> finds a failing test it exits with a non-zero code, and the pipeline turns red.</p>
<h3>A tiny script</h3>
<pre class="language-bash"><code class="language-bash">#!/usr/bin/env bash
set -e                       # stop at the first command that fails
echo "Building for $APP_ENV"
mvn -q package
echo "Build complete"</code></pre>
<p>Save it as <code>build.sh</code>, make it executable with <code>chmod +x build.sh</code> and run it with <code>./build.sh</code>. The <code>./</code> is needed because the current folder is usually not on the PATH — a deliberate safety feature.</p>
<h2>Common mistakes</h2>
<ul>
<li>Putting spaces around <code>=</code>: <code>export APP_ENV = dev</code> fails. Write <code>APP_ENV=dev</code>.</li>
<li>Setting a variable in one terminal window and expecting another window to see it.</li>
<li>Typing passwords directly into commands, where they are saved in your shell history.</li>
</ul>
<h3>Check yourself</h3>
<p>A teammate's script runs <code>mvn test; ./deploy.sh</code>. Why is that risky, and what is the fix?</p>
<details><summary>Answer</summary><p>The semicolon runs <code>deploy.sh</code> even when the tests fail. Use <code>mvn test &amp;&amp; ./deploy.sh</code>, or put <code>set -e</code> at the top of the script, so a failed test stops the deployment.</p></details>`,
        },
      ],
    },
    {
      title: 'Everyday Git',
      summary:
        'How Git records your work, staging and committing one logical change at a time, writing commit messages people can use, reading history and undoing mistakes safely.',
      lessons: [
        {
          kind: 'article',
          title: 'How Git sees your project',
          minutes: 15,
          topic: 'Git basics',
          html: `<p>Picture a final-year project where four people email each other <code>Project_final_v3_REAL.zip</code>. Someone's changes always get lost, nobody knows which version the guide reviewed, and undoing a bad change means digging through old attachments. Version control solves all of this, and Git is the version control system you will meet in almost every software team.</p>
<h2>Snapshots with a history</h2>
<p>Git records your project as a series of <strong>commits</strong>. Each commit is a snapshot of every tracked file at one moment, plus who made it, when, a message explaining why, and a pointer to the commit before it. Because each commit points to its parent, the commits form a history you can walk back through. Every commit has an identifying hash such as <code>a3f9c21</code>, which you use to refer to it.</p>
<p>Git is <strong>distributed</strong>: when you clone a repository you get its entire history on your own machine. You can commit, browse history and create branches without a network connection, and share your work later.</p>
<h2>The three areas</h2>
<p>Most confusion about Git disappears once you see the three places a change can live:</p>
<table>
<thead><tr><th>Area</th><th>What it holds</th><th>How changes get there</th></tr></thead>
<tbody>
<tr><td>Working tree</td><td>The files you see and edit</td><td>You edit them</td></tr>
<tr><td>Staging area (the index)</td><td>Exactly what will go into the next commit</td><td><code>git add</code></td></tr>
<tr><td>Repository</td><td>The permanent history of commits, inside <code>.git</code></td><td><code>git commit</code></td></tr>
</tbody>
</table>
<p>The staging area is what lets you commit some of your changes and not others. Suppose you fix a bug in one file and leave a debugging print in another: you stage only the fix, commit it, and deal with the print separately.</p>
<h2>Starting a repository</h2>
<pre class="language-bash"><code class="language-bash"># one-time setup on a new machine
git config --global user.name "Priya Raman"
git config --global user.email "priya@example.com"

# start tracking an existing project
cd fees-app
git init

# or copy an existing repository, with its whole history
git clone https://github.com/example-org/fees-app.git</code></pre>
<p>The name and email you configure are stamped on every commit you make, so use your real name and the address your team expects.</p>
<h2>Common mistakes</h2>
<ul>
<li>Running <code>git init</code> in your home folder by accident, which turns everything inside it into one giant repository. Check <code>pwd</code> first; if it happens, delete that stray <code>.git</code> folder — only that one.</li>
<li>Thinking a commit is a backup on a server. A commit lives only on your machine until you push it.</li>
<li>Skipping <code>git status</code>. It tells you which branch you are on and what is staged, and it prevents most surprises.</li>
</ul>
<h3>Check yourself</h3>
<p>You edited <code>Fees.java</code>, ran <code>git add Fees.java</code>, and then edited the file again. Which version will <code>git commit</code> record?</p>
<details><summary>Answer</summary><p>The version as it was when you ran <code>git add</code>. The later edit exists only in the working tree, and <code>git status</code> shows the file as both staged and modified — that is your clue. Run <code>git add Fees.java</code> again to include the latest edit.</p></details>`,
          resources: [
            { title: 'Pro Git (free book)', url: 'https://git-scm.com/book/en/v2' },
            {
              title: 'Pro Git: first-time Git setup',
              url: 'https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Staging and committing with intent',
          minutes: 15,
          topic: 'Git basics',
          html: `<p>A good commit is one logical change: a fix, a small feature, a rename. It is easy to review, easy to understand later and easy to undo if needed. The commands in this lesson are how you shape your work into commits like that, instead of one huge "end of the day" commit.</p>
<h2>The everyday loop</h2>
<pre class="language-bash"><code class="language-bash">git status                 # what changed, and what is staged
git diff                   # changes not yet staged
git add src/Fees.java      # stage one file
git diff --staged          # exactly what the next commit will contain
git commit -m "Round the monthly fee to two decimal places"
git log --oneline -5       # the last five commits</code></pre>
<p>Make <code>git status</code> a habit: run it before and after the other commands until reading its output is automatic. It shows the branch you are on, the files that are staged ("Changes to be committed"), the files that are modified but not staged, and the untracked ones.</p>
<h2>Staging only part of your work</h2>
<p><code>git add .</code> stages everything in the current folder. It is convenient, and it is also how passwords, log files and half-finished experiments end up in repositories. Prefer naming files, and use <code>git add -p</code> to review your changes piece by piece: Git shows each changed block (a "hunk") and asks whether to stage it. Answer <kbd>y</kbd> or <kbd>n</kbd>, or <kbd>s</kbd> to split a hunk into smaller ones.</p>
<p>If you stage something by mistake, unstage it without losing the edit:</p>
<pre class="language-bash"><code class="language-bash">git restore --staged config.properties</code></pre>
<h2>Files that never belong in Git</h2>
<p>A <code>.gitignore</code> file in the project root lists patterns Git should not track:</p>
<pre class="language-text"><code class="language-text"># build output
target/
node_modules/
*.class

# local settings and secrets
.env
*.log
.idea/</code></pre>
<p>Build output can always be regenerated from the source, so committing it only bloats the repository and causes pointless conflicts. Secrets must never be committed at all. Note that <code>.gitignore</code> affects only untracked files: if a file is already committed, adding it to <code>.gitignore</code> does not remove it from the history.</p>
<h2>Common mistakes</h2>
<ul>
<li>Committing with <code>git commit -am</code> out of habit. It stages every modified tracked file, including the ones you did not mean to include.</li>
<li>Committing code that does not compile. Each commit should leave the project working, so that anyone can check out any commit.</li>
<li>Waiting days between commits. Small, frequent commits are easier to review and to undo.</li>
</ul>
<h3>Check yourself</h3>
<p>You changed <code>Fees.java</code> (a real fix) and <code>Report.java</code> (a stray debugging print). Which commands commit only the fix?</p>
<details><summary>Answer</summary><pre class="language-bash"><code class="language-bash">git add src/Fees.java
git diff --staged       # confirm that only the fix is staged
git commit -m "Fix rounding of the monthly fee"</code></pre><p>Afterwards, <code>git restore src/Report.java</code> throws away the debugging print — permanently, so only do it if you no longer need that edit.</p></details>`,
          resources: [
            {
              title: 'Pro Git: recording changes to the repository',
              url: 'https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository',
            },
            { title: 'git add reference', url: 'https://git-scm.com/docs/git-add' },
          ],
        },
        { kind: 'practice', question: 'git-staging-area', topic: 'Git basics' },
        {
          kind: 'article',
          title: 'Commit messages your team can use',
          minutes: 10,
          topic: 'Git basics',
          html: `<p>Months from now, someone will run <code>git log</code> or <code>git blame</code> on a confusing line of code and read your commit message to find out why it is there. That someone may well be you. A good message turns history into documentation; a bad one ("fixed stuff", "changes", "final") turns it into noise.</p>
<h2>The shape of a good message</h2>
<pre class="language-text"><code class="language-text">Calculate GST on the discounted fee

The fee screen worked out 18% GST on the full fee and then subtracted
the 10% sibling discount, so families paid GST on the part of the fee
the discount had removed. Apply the discount first, as the fee policy
says, and add tests for fees with and without a discount.

Fixes #142</code></pre>
<ul>
<li><strong>A short subject line</strong>, around 50 characters, saying what the commit does. Many tools show only this line.</li>
<li><strong>The imperative mood</strong> — "Add", "Fix", "Remove" — as if completing the sentence "If applied, this commit will…". It reads naturally in a list of commits.</li>
<li><strong>A blank line</strong>, then a body explaining <em>why</em>: the problem, and anything a reviewer would otherwise have to guess. The diff already shows <em>what</em> changed, line by line.</li>
<li><strong>A reference</strong> to the issue or task, if your team tracks them.</li>
</ul>
<p>To write a message with a body, run <code>git commit</code> without <code>-m</code> and Git opens your editor.</p>
<h2>Conventional Commits</h2>
<p>Many teams add a type prefix so that tools can build change logs and people can scan history quickly:</p>
<pre class="language-text"><code class="language-text">feat(fees): show the GST breakdown on the receipt
fix(auth): lock the account after five failed sign-ins
docs: explain how to run the tests locally
test(fees): cover the full-scholarship case
refactor(report): extract the PDF builder</code></pre>
<p>When a project uses a convention like this, follow it exactly; some repositories reject commits that do not.</p>
<h2>One commit, one idea</h2>
<p>A message is easy to write when the commit does one thing. If you find yourself writing "Fix login bug and rename variables and update README", that is three commits. Split them with <code>git add -p</code> before committing.</p>
<h2>Common mistakes</h2>
<ul>
<li>Describing effort instead of the change: "Worked on fees" says nothing.</li>
<li>Writing for yourself only: "fix for Rahul's issue" means nothing to the rest of the team.</li>
<li>Saying how without saying why. "Change double to BigDecimal" is obvious from the diff; "Use BigDecimal so fee totals are not off by a paisa" is not.</li>
</ul>
<h3>Check yourself</h3>
<p>Rewrite "updated code" for a commit that makes student search ignore the difference between capital and small letters.</p>
<details><summary>Answer</summary><p>For example, the subject <code>Make student search case-insensitive</code>, with a body if useful: "Searching for kavya did not find Kavya. Compare names ignoring case, and add tests for both spellings."</p></details>`,
          resources: [
            {
              title: 'Pro Git: contributing to a project (commit guidelines)',
              url: 'https://git-scm.com/book/en/v2/Distributed-Git-Contributing-to-a-Project',
            },
            { title: 'git commit reference', url: 'https://git-scm.com/docs/git-commit' },
          ],
        },
        { kind: 'practice', question: 'git-commit-message', topic: 'Git basics' },
        {
          kind: 'article',
          title: 'Reading history and undoing mistakes',
          minutes: 15,
          topic: 'Undoing changes',
          html: `<p>Everyone makes mistakes in Git: a typo in a commit message, a file staged by accident, a change that broke the build. The good news is that Git almost never loses committed work. The skill is choosing the right undo, and the deciding question is usually: <strong>has anyone else already got this commit?</strong></p>
<h2>Reading history</h2>
<pre class="language-bash"><code class="language-bash">git log --oneline --graph --all   # compact history, with branches drawn
git log -p src/Fees.java          # every change to one file, with diffs
git show a3f9c21                  # one commit in full
git blame src/Fees.java           # the commit that last changed each line</code></pre>
<p><code>git blame</code> sounds accusing, but it is mostly used to find the commit — and the message — that explains a puzzling line.</p>
<h2>Undoing, from smallest to biggest</h2>
<table>
<thead><tr><th>Situation</th><th>Command</th><th>Safe on shared history?</th></tr></thead>
<tbody>
<tr><td>Throw away an edit you have not staged</td><td><code>git restore Fees.java</code></td><td>Yes, but the edit is lost</td></tr>
<tr><td>Unstage a file and keep the edit</td><td><code>git restore --staged Fees.java</code></td><td>Yes</td></tr>
<tr><td>Fix the last commit's message, or add a forgotten file, before pushing</td><td><code>git commit --amend</code></td><td>No: it replaces the commit</td></tr>
<tr><td>Drop local commits you have not pushed</td><td><code>git reset --hard HEAD~1</code></td><td>No: it rewrites history</td></tr>
<tr><td>Undo a commit that others already have</td><td><code>git revert a3f9c21</code></td><td>Yes: it adds a new commit</td></tr>
</tbody>
</table>
<h3>Revert versus reset</h3>
<p><code>git reset</code> moves your branch back, as if the later commits had never happened. On your own unpushed work that is fine. On a shared branch it causes real trouble: your teammates still have the "removed" commits, so the next time anyone pulls or pushes, the histories disagree and work gets duplicated or lost.</p>
<p><code>git revert</code> works forwards instead. It creates a <em>new</em> commit that applies the exact opposite of the bad one. History stays intact, everyone can pull normally, and the log honestly records that a change was made and then undone.</p>
<pre class="language-bash"><code class="language-bash">git revert a3f9c21     # opens your editor with a "Revert ..." message
git push</code></pre>
<h3>The safety net</h3>
<p><code>git reflog</code> lists every commit your <code>HEAD</code> has pointed at recently, including commits you "lost" with a reset. If you reset too far, find the hash in the reflog and run <code>git reset --hard &lt;hash&gt;</code> to go back. Uncommitted edits thrown away with <code>git restore</code>, however, are gone for good — Git never recorded them.</p>
<h2>Common mistakes</h2>
<ul>
<li>Using <code>git push --force</code> to "fix" a shared branch after a reset. It overwrites your teammates' history.</li>
<li>Amending a commit that is already pushed. Make a new commit instead.</li>
<li>Running <code>git reset --hard</code> with uncommitted work you wanted to keep. Commit it or run <code>git stash</code> first.</li>
</ul>
<h3>Check yourself</h3>
<p>You pushed a commit to <code>main</code> an hour ago, two teammates have pulled since, and it turns out to have broken the fee report. What do you run?</p>
<details><summary>Answer</summary><p><code>git revert &lt;hash&gt;</code> and then <code>git push</code>. The revert adds a new commit that undoes the change, so nobody's history is rewritten. Then fix the problem properly in a new commit, with a test that would have caught it.</p></details>`,
          resources: [
            {
              title: 'Pro Git: undoing things',
              url: 'https://git-scm.com/book/en/v2/Git-Basics-Undoing-Things',
            },
            {
              title: 'Pro Git: viewing the commit history',
              url: 'https://git-scm.com/book/en/v2/Git-Basics-Viewing-the-Commit-History',
            },
            { title: 'git revert reference', url: 'https://git-scm.com/docs/git-revert' },
          ],
        },
        { kind: 'practice', question: 'git-revert-vs-reset', topic: 'Undoing changes' },
      ],
    },
    {
      title: 'Branches and collaboration',
      summary:
        'Working on branches, merging and resolving conflicts, rebasing a feature branch onto main, and sharing work through remotes, pull requests and code review.',
      lessons: [
        {
          kind: 'article',
          title: 'Branches: a safe place for every change',
          minutes: 12,
          topic: 'Branching',
          html: `<p>Suppose you are halfway through a new receipt layout when your trainer reports a serious bug in the fee calculation. Without branches, you would have to finish or throw away the half-done layout before fixing the bug. With branches, you put the layout aside, fix the bug on its own line of work, and come back to the layout afterwards — all in the same folder.</p>
<h2>What a branch really is</h2>
<p>A Git branch is just a movable label pointing at a commit. When you commit on a branch, its label moves forward to the new commit. Creating a branch is instant and costs almost nothing, which is why teams create one for every feature or fix. <code>HEAD</code> is Git's name for "the branch you are on right now".</p>
<h2>Everyday branch commands</h2>
<pre class="language-bash"><code class="language-bash">git branch                          # list branches; * marks the current one
git switch -c feature/receipt-gst   # create a branch and switch to it
# ... edit, add, commit ...
git switch main                     # go back to main
git switch feature/receipt-gst      # and back again
git branch -d feature/receipt-gst   # delete it once it has been merged</code></pre>
<p>Older tutorials use <code>git checkout -b</code> to create and switch in one step; it does the same job. <code>git switch</code> was added because <code>checkout</code> does too many different things.</p>
<h3>Switching with uncommitted changes</h3>
<p>Git carries your uncommitted changes with you when you switch, if it can. If they would clash with the other branch, it refuses. Either commit your work in progress or put it aside for a moment:</p>
<pre class="language-bash"><code class="language-bash">git stash             # save uncommitted changes and clean the working tree
git switch main
# ... fix the urgent bug, commit ...
git switch feature/receipt-gst
git stash pop         # bring the saved changes back</code></pre>
<h2>Why teams insist on branches</h2>
<ul>
<li><strong>Main stays releasable.</strong> Unfinished work lives on a branch until it has been reviewed and tested.</li>
<li><strong>Work happens in parallel.</strong> Five people can build five features without stepping on each other.</li>
<li><strong>Review becomes possible.</strong> A branch is exactly the set of changes a pull request shows to reviewers.</li>
<li><strong>Experiments are cheap.</strong> If an idea does not work out, delete the branch.</li>
</ul>
<p>Name branches so that others can tell what they hold — <code>feature/attendance-export</code>, <code>fix/login-timeout</code> — and follow your team's convention if it has one.</p>
<h2>Common mistakes</h2>
<ul>
<li>Committing straight to <code>main</code> out of habit. Glance at the branch name in <code>git status</code> before you commit.</li>
<li>Keeping a branch alive for weeks. The longer it lives, the further it drifts from main and the harder the merge.</li>
<li>Forgetting about a stash. <code>git stash list</code> shows what you have put aside.</li>
</ul>
<h3>Check yourself</h3>
<p>You made two commits on <code>main</code> by mistake and have not pushed them. How could you move them to a new branch?</p>
<details><summary>Answer</summary><p>Create the branch where you are, then move <code>main</code> back: <code>git branch feature/my-work</code>, then (still on <code>main</code>, with no uncommitted changes) <code>git reset --hard HEAD~2</code>, then <code>git switch feature/my-work</code>. The two commits are safe on the new branch, and the reset is fine because they were never pushed.</p></details>`,
          resources: [
            {
              title: 'Pro Git: branches in a nutshell',
              url: 'https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell',
            },
            { title: 'git switch reference', url: 'https://git-scm.com/docs/git-switch' },
          ],
        },
        { kind: 'practice', question: 'git-branch-purpose', topic: 'Branching' },
        {
          kind: 'article',
          title: 'Merging and resolving conflicts calmly',
          minutes: 15,
          topic: 'Merging',
          html: `<p>Branches are only useful if their work comes back together. Merging does that, and most of the time Git does it automatically. Occasionally two branches change the same lines and Git asks you to decide what the result should be. That is a merge conflict: a normal, everyday event, not an error and not a sign you did something wrong.</p>
<h2>Two kinds of merge</h2>
<pre class="language-bash"><code class="language-bash">git switch main
git merge feature/receipt-gst</code></pre>
<p>If <code>main</code> has not moved since you created your branch, Git simply slides the <code>main</code> label forward to your latest commit. This is a <strong>fast-forward</strong>. If both branches have new commits, Git creates a <strong>merge commit</strong> with two parents, combining both lines of work.</p>
<h2>When lines collide</h2>
<p>Say you changed the GST line in <code>Fees.java</code> on your branch while a teammate changed the same line on <code>main</code>. Git stops the merge and marks the file:</p>
<pre class="language-java"><code class="language-java">&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD
    BigDecimal gst = discounted.multiply(GST_RATE).setScale(2, RoundingMode.HALF_UP);
=======
    BigDecimal gst = discounted.multiply(new BigDecimal("0.18"));
&gt;&gt;&gt;&gt;&gt;&gt;&gt; feature/receipt-gst</code></pre>
<p>The part between <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD</code> and <code>=======</code> is the version on the branch you are on (here <code>main</code>); the part after it, down to <code>&gt;&gt;&gt;&gt;&gt;&gt;&gt;</code>, is the version from the branch you are merging in.</p>
<h3>Resolving, step by step</h3>
<ol>
<li>Run <code>git status</code>. Files with conflicts are listed under "Unmerged paths".</li>
<li>Open each file and find the markers. Decide what the code should be: one side, the other, or — very often — a combination. Here the right result probably keeps the named constant and the rounding from <code>main</code>.</li>
<li>Delete all three marker lines, so that the file compiles.</li>
<li>Build and run the tests. A conflict "resolved" by blindly keeping both halves often compiles and is still wrong.</li>
<li>Run <code>git add Fees.java</code> to mark it resolved, then <code>git commit</code> to complete the merge.</li>
</ol>
<p>If you get lost, <code>git merge --abort</code> puts everything back as it was before the merge. And ask the teammate whose change you are merging with: two minutes of conversation beats guessing what their code was for.</p>
<h2>Making conflicts rarer</h2>
<ul>
<li>Bring the latest <code>main</code> into your branch often, so the differences stay small.</li>
<li>Keep branches short-lived and focused on one thing.</li>
<li>Do not mix mass reformatting with real changes; reformatting touches every line and conflicts with everyone.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Committing a file that still contains conflict markers. Search for <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code> before you commit.</li>
<li>Choosing "keep mine" for every conflict to make them go away, silently throwing out a teammate's fix.</li>
<li>Finishing the merge without running the tests.</li>
</ul>
<h3>Check yourself</h3>
<p>After editing the conflicted file, <code>git status</code> still says "You have unmerged paths". What did you forget?</p>
<details><summary>Answer</summary><p>To stage the resolved file with <code>git add</code>. Staging is how you tell Git that a conflict is resolved; <code>git commit</code> then completes the merge.</p></details>`,
          resources: [
            {
              title: 'Pro Git: basic branching and merging',
              url: 'https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging',
            },
            { title: 'git merge reference', url: 'https://git-scm.com/docs/git-merge' },
          ],
        },
        { kind: 'practice', question: 'git-merge-conflict', topic: 'Merging' },
        {
          kind: 'article',
          title: 'Rebasing basics: keeping your branch up to date',
          minutes: 12,
          topic: 'Rebasing',
          html: `<p>While you work on your branch, <code>main</code> keeps moving as teammates merge their work. Before your pull request can merge cleanly, your branch needs those new commits. You can bring them in with a merge, or you can <strong>rebase</strong>. Many teams prefer rebasing feature branches because it keeps the history in a straight, readable line.</p>
<h2>What rebase does</h2>
<p>Picture your branch as three commits that started from an older point on <code>main</code>. <code>git rebase main</code> sets those three commits aside, moves your branch to the tip of the current <code>main</code>, and replays your commits on top, one at a time. The result looks as if you had started your work today.</p>
<pre class="language-text"><code class="language-text">Before:  main:     A---B---C---D
                        \\
         feature:        X---Y---Z

After:   main:     A---B---C---D
                                \\
         feature:                X'--Y'--Z'</code></pre>
<p>The replayed commits get new hashes (shown with a prime mark), because their parent has changed. That detail is behind rebasing's one important rule.</p>
<h2>The everyday workflow</h2>
<pre class="language-bash"><code class="language-bash">git switch feature/receipt-gst
git fetch origin
git rebase origin/main
# if a conflict appears: fix the file, then
git add Fees.java
git rebase --continue
# or give up and return to where you started
git rebase --abort</code></pre>
<p>During a rebase, conflicts are resolved one commit at a time, in the same way as during a merge. When it finishes, run the tests: your code now sits on top of everyone else's latest changes.</p>
<h2>The golden rule</h2>
<p><strong>Do not rebase commits that other people have already built on.</strong> Rebasing replaces commits with new ones. If you rebase a shared branch and force-push it, everyone who pulled the old commits now has a history that no longer matches, and untangling it can cost a team an afternoon.</p>
<p>Rebasing your own feature branch is fine, even after pushing it for a pull request, as long as nobody else commits to it. You will then need <code>git push --force-with-lease</code>, which refuses to overwrite the remote branch if someone else has pushed to it in the meantime — much safer than a plain <code>--force</code>.</p>
<h2>Merge or rebase?</h2>
<table>
<thead><tr><th></th><th>Merge main into your branch</th><th>Rebase your branch onto main</th></tr></thead>
<tbody>
<tr><td>History</td><td>Records exactly what happened, with merge commits</td><td>A straight line, easier to read</td></tr>
<tr><td>Rewrites commits</td><td>No</td><td>Yes, your branch's commits</td></tr>
<tr><td>Safe on shared branches</td><td>Yes</td><td>No</td></tr>
</tbody>
</table>
<p>Neither is "the correct one". Follow your team's convention, and when in doubt on a shared branch, merge.</p>
<h2>Common mistakes</h2>
<ul>
<li>Rebasing <code>main</code> itself, or any branch others are working on.</li>
<li>Forgetting to run the tests after a rebase, even when there were no conflicts.</li>
<li>Panicking halfway through a rebase. <code>git status</code> tells you where you are, and <code>git rebase --abort</code> is always available.</li>
</ul>
<h3>Check yourself</h3>
<p>A teammate suggests rebasing <code>main</code> to tidy up last week's history and then force-pushing it. What do you say?</p>
<details><summary>Answer</summary><p>Do not do it. <code>main</code> is shared, so rewriting it breaks every clone that already has those commits. Tidy up history only on your own branches, before they are merged.</p></details>`,
          resources: [
            {
              title: 'Pro Git: rebasing',
              url: 'https://git-scm.com/book/en/v2/Git-Branching-Rebasing',
            },
            { title: 'git rebase reference', url: 'https://git-scm.com/docs/git-rebase' },
          ],
        },
        {
          kind: 'article',
          title: 'Remotes, pull requests and code review',
          minutes: 15,
          topic: 'Collaboration',
          html: `<p>So far everything has happened on your own laptop. Teams share work through a <strong>remote</strong>: a copy of the repository on a server such as GitHub or GitLab. A <strong>pull request</strong> (GitLab calls it a merge request) is how you ask the team to review your branch and merge it into <code>main</code>.</p>
<h2>Working with a remote</h2>
<pre class="language-bash"><code class="language-bash">git remote -v                             # list remotes; "origin" is the usual name
git fetch origin                          # download new commits; change nothing locally
git pull                                  # fetch, then merge into your current branch
git push -u origin feature/receipt-gst    # publish your branch the first time
git push                                  # later pushes from the same branch</code></pre>
<p><code>fetch</code> is always safe: it only updates your view of the remote (<code>origin/main</code> and so on). <code>pull</code> also changes your branch. Many developers run <code>git config --global pull.rebase true</code> so that a pull rebases their local commits instead of creating small merge commits.</p>
<h3>Clone or fork?</h3>
<p>If you have write access to a repository, you clone it and push branches to it. If you do not — an open-source project, or a class practice repository — you first <strong>fork</strong> it (make your own copy on the server), push your branch to the fork, and open a pull request from the fork back to the original.</p>
<h2>A pull request, start to finish</h2>
<ol>
<li>Create a branch from an up-to-date <code>main</code> and make focused commits.</li>
<li>Push the branch and open a pull request. Give it a clear title and a description: what changed, why, how you tested it, and screenshots for anything visual.</li>
<li>Automated checks run (you will set these up in the continuous integration lesson). Fix anything that fails.</li>
<li>Reviewers comment. Answer every comment — with a follow-up commit, or with a reasoned reply if you disagree.</li>
<li>Once it is approved and the checks pass, the branch is merged and deleted.</li>
</ol>
<h2>Reviewing and being reviewed</h2>
<p>Code review is not an exam. It is how a team shares knowledge and catches problems while they are still cheap to fix.</p>
<ul>
<li><strong>As the author:</strong> keep pull requests small — a few hundred lines at most — so they can be reviewed properly. Read your own diff before asking anyone else to. Remember that comments are about the code, not about you.</li>
<li><strong>As a reviewer:</strong> be specific and kind. "This loop recalculates the total for every student; could we compute it once before the loop?" helps; "This is bad" does not. Separate must-fix problems from suggestions, and mention what you liked too.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Pushing directly to <code>main</code> instead of opening a pull request.</li>
<li>A 2,000-line pull request that mixes a feature, a refactor and formatting changes.</li>
<li>Marking a review comment as resolved without changing anything or replying.</li>
</ul>
<h3>Check yourself</h3>
<p>What is the difference between <code>git fetch</code> and <code>git pull</code>?</p>
<details><summary>Answer</summary><p><code>fetch</code> downloads new commits from the remote and updates the remote-tracking branches such as <code>origin/main</code>, without touching your own branches or files. <code>pull</code> does a fetch and then merges (or rebases) those commits into your current branch.</p></details>`,
          resources: [
            {
              title: 'Pro Git: working with remotes',
              url: 'https://git-scm.com/book/en/v2/Git-Basics-Working-with-Remotes',
            },
            {
              title: 'GitHub Docs: getting started',
              url: 'https://docs.github.com/en/get-started',
            },
          ],
        },
      ],
    },
    {
      title: 'Building and testing',
      summary:
        'What build tools such as Maven and npm do, writing unit tests with JUnit 5, choosing test cases that find bugs, and isolating code from its dependencies with mocks.',
      lessons: [
        {
          kind: 'article',
          title: 'Build tools: what Maven and npm do for you',
          minutes: 15,
          topic: 'Build tools',
          html: `<p>A real project depends on dozens of libraries, has to be compiled, tested and packaged, and must build the same way on your laptop, a teammate's laptop and the CI server. Doing that by hand with <code>javac</code> does not scale. A build tool does it from a single description of the project. For Java the most common choices are Maven and Gradle; for JavaScript it is npm.</p>
<h2>What every build tool gives you</h2>
<ul>
<li><strong>Dependency management.</strong> You declare "I need this library, at this version"; the tool downloads it, and the libraries it needs in turn.</li>
<li><strong>A standard layout.</strong> Source in one place, tests in another, output in a third, so any developer can find their way around a new project.</li>
<li><strong>Repeatable steps.</strong> Compile, test and package with one command, the same way every time.</li>
</ul>
<h2>Maven on one page</h2>
<p>A Maven project is described by its <code>pom.xml</code>. A dependency looks like this:</p>
<pre class="language-text"><code class="language-text">&lt;dependency&gt;
  &lt;groupId&gt;org.junit.jupiter&lt;/groupId&gt;
  &lt;artifactId&gt;junit-jupiter&lt;/artifactId&gt;
  &lt;version&gt;5.10.2&lt;/version&gt;
  &lt;scope&gt;test&lt;/scope&gt;
&lt;/dependency&gt;</code></pre>
<p>The <code>test</code> scope means the library is used only by the tests and is not shipped with your application. Maven expects production code in <code>src/main/java</code> and tests in <code>src/test/java</code>, and writes everything it builds into <code>target/</code>.</p>
<p>Maven works in <strong>lifecycle phases</strong>, and running a phase runs every phase before it:</p>
<pre class="language-bash"><code class="language-bash">mvn compile         # compile src/main/java
mvn test            # compile, then run the unit tests
mvn package         # ...then build a jar in target/
mvn clean           # delete target/ to start fresh
mvn clean verify    # a full clean build with every check, as CI runs it</code></pre>
<h2>npm on one page</h2>
<p>JavaScript projects use <code>package.json</code> for the same purposes. Dependencies are listed there, and the <code>scripts</code> section gives names to common commands:</p>
<pre class="language-json"><code class="language-json">{
  "name": "fees-web",
  "scripts": {
    "dev": "vite",
    "test": "vitest run",
    "build": "vite build"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}</code></pre>
<p><code>npm install</code> downloads the dependencies into <code>node_modules/</code>; <code>npm test</code> and <code>npm run build</code> run the named scripts.</p>
<h3>Lock files</h3>
<p>A version range such as <code>^5.4.0</code> allows newer minor versions, so two installs a month apart could fetch different code. <code>package-lock.json</code> records the exact versions that were installed. Commit it, and use <code>npm ci</code> on build servers so they install exactly what it lists. Maven avoids the problem by having you write exact versions in <code>pom.xml</code>.</p>
<h2>Common mistakes</h2>
<ul>
<li>Committing <code>target/</code> or <code>node_modules/</code>. They are generated, so they belong in <code>.gitignore</code>.</li>
<li>Copying jar files into the project by hand instead of declaring dependencies.</li>
<li>"It builds in my IDE" — but not with <code>mvn clean verify</code>. The command-line build is the one CI and your teammates use, so it is the one that counts.</li>
</ul>
<h3>Check yourself</h3>
<p>Why does <code>mvn package</code> also run your tests?</p>
<details><summary>Answer</summary><p>Because <code>package</code> comes after <code>test</code> in Maven's lifecycle, and running a phase runs every earlier phase. A failing test therefore stops the jar from being built — which is exactly what you want.</p></details>`,
          resources: [
            {
              title: 'Maven getting started guide',
              url: 'https://maven.apache.org/guides/getting-started/',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Your first unit tests with JUnit 5',
          minutes: 20,
          topic: 'Unit testing',
          html: `<p>A unit test is a small piece of code that calls one unit of your code — a method or a class — with known inputs and checks the result. It runs in milliseconds, needs no database or network, and can be run hundreds of times a day. Unit tests are how you find out that a change broke something before your users do.</p>
<h2>The code under test</h2>
<pre class="language-java"><code class="language-java">public class FeeCalculator {
    private static final BigDecimal GST = new BigDecimal("0.18");

    /** The fee after a percentage discount, plus GST on the discounted amount. */
    public BigDecimal finalFee(BigDecimal baseFee, int discountPercent) {
        if (discountPercent &lt; 0 || discountPercent &gt; 100) {
            throw new IllegalArgumentException("Discount must be 0 to 100");
        }
        BigDecimal discount = baseFee.multiply(BigDecimal.valueOf(discountPercent))
                                     .divide(BigDecimal.valueOf(100));
        BigDecimal discounted = baseFee.subtract(discount);
        return discounted.add(discounted.multiply(GST)).setScale(2, RoundingMode.HALF_UP);
    }
}</code></pre>
<h2>The tests</h2>
<pre class="language-java"><code class="language-java">import static org.junit.jupiter.api.Assertions.*;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FeeCalculatorTest {
    private final FeeCalculator calculator = new FeeCalculator();

    @Test
    @DisplayName("applies the discount before adding GST")
    void discountThenGst() {
        BigDecimal fee = calculator.finalFee(new BigDecimal("20000"), 10);
        assertEquals(new BigDecimal("21240.00"), fee);
    }

    @Test
    void noDiscountMeansFullFeePlusGst() {
        assertEquals(new BigDecimal("11800.00"),
                     calculator.finalFee(new BigDecimal("10000"), 0));
    }

    @Test
    void rejectsADiscountAboveHundred() {
        assertThrows(IllegalArgumentException.class,
                     () -&gt; calculator.finalFee(new BigDecimal("10000"), 120));
    }
}</code></pre>
<h2>How to read a test</h2>
<p>Each test follows the same three steps, often called <strong>Arrange, Act, Assert</strong>: set up the inputs and objects you need, call the method under test once, and check that the result is what it should be.</p>
<p>JUnit 5 finds the methods marked <code>@Test</code> and runs each one on a fresh instance of the test class, so tests cannot leak state into one another. Test classes and methods do not need to be <code>public</code>. Useful assertions include <code>assertEquals(expected, actual)</code> (expected first), <code>assertTrue</code>, <code>assertNull</code>, <code>assertThrows</code>, and <code>assertAll</code>, which checks several things and reports every failure instead of stopping at the first.</p>
<h2>Running them</h2>
<pre class="language-bash"><code class="language-bash">mvn test                           # all tests
mvn test -Dtest=FeeCalculatorTest  # one test class</code></pre>
<p>Your IDE can also run a single test with one click. A failing assertion prints both values — <code>expected: &lt;21240.00&gt; but was: &lt;21600.00&gt;</code> — which often points straight at the bug: here, GST worked out on the full ₹20,000 instead of the discounted ₹18,000.</p>
<h2>Unit tests and their bigger siblings</h2>
<p>A unit test checks one class on its own. An <strong>integration test</strong> checks that several parts work together — for example, starting the application, calling an endpoint and checking the row it saved in a test database. Integration tests catch wiring and configuration problems that unit tests cannot, but they are slower and harder to diagnose. Healthy projects have many unit tests, fewer integration tests, and a small number of end-to-end tests through the real user interface.</p>
<h2>What makes a good unit test</h2>
<ul>
<li><strong>One behaviour per test</strong>, with a name that says what it is: when <code>rejectsADiscountAboveHundred</code> fails, you know what broke without reading the code.</li>
<li><strong>Fast and independent.</strong> No test should rely on another running first, or on the date, the network or a database.</li>
<li><strong>Deterministic.</strong> Same code, same result, every time. A test that fails "sometimes" is soon ignored.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Swapping the arguments of <code>assertEquals</code>, which makes the failure message misleading.</li>
<li>Tests with no assertion: they pass whatever the code does.</li>
<li>Working with money as <code>double</code>. Use <code>BigDecimal</code> in the code and in the tests.</li>
</ul>
<h3>Check yourself</h3>
<p>Write the assertion for a 50% discount on a fee of ₹1,000.</p>
<details><summary>Answer</summary><p>The discount is ₹500, the discounted fee ₹500, GST ₹90, so the total is ₹590: <code>assertEquals(new BigDecimal("590.00"), calculator.finalFee(new BigDecimal("1000"), 50));</code></p></details>`,
          resources: [
            {
              title: 'JUnit 5 user guide',
              url: 'https://junit.org/junit5/docs/current/user-guide/',
            },
          ],
        },
        { kind: 'practice', question: 'testing-unit-vs-integration', topic: 'Unit testing' },
        {
          kind: 'article',
          title: 'Designing test cases that find bugs',
          minutes: 15,
          topic: 'Test design',
          html: `<p>Writing a test is easy; choosing <em>which</em> tests to write is the real skill. You cannot try every possible input, so you pick a small set that is most likely to expose mistakes. Testers use a few simple, reliable techniques for this — and interviewers love asking about them ("How would you test a sign-in page?").</p>
<h2>Equivalence classes</h2>
<p>Group the inputs that the code should treat in the same way, and test one value from each group. If an exam gives grade A for 90 and above and B for 75 to 89, then 92 and 97 belong to the same class, and testing both adds little. Testing 95 (an A), 80 (a B) and 40 (a fail) covers three different behaviours.</p>
<p>Remember the <strong>invalid</strong> classes too: negative marks, marks above 100, an empty field, text where a number belongs.</p>
<h2>Boundary values</h2>
<p>Bugs cluster at the edges, where someone typed <code>&gt;</code> instead of <code>&gt;=</code>. For each boundary, test the value on it and the values just either side:</p>
<table>
<thead><tr><th>Rule</th><th>Boundary tests</th></tr></thead>
<tbody>
<tr><td>Grade A for 90 and above</td><td>89, 90, 91</td></tr>
<tr><td>Marks must be 0 to 100</td><td>-1, 0, 100, 101</td></tr>
<tr><td>Password of 8 to 64 characters</td><td>7, 8, 64 and 65 characters</td></tr>
</tbody>
</table>
<p>If the code says <code>marks &gt; 90</code> by mistake, only the test with exactly 90 catches it — a test with 95 passes either way.</p>
<h2>A JUnit 5 shortcut: parameterised tests</h2>
<pre class="language-java"><code class="language-java">@ParameterizedTest
@CsvSource({ "89, B", "90, A", "91, A", "100, A" })
void gradesAroundTheBoundary(int marks, String expected) {
    assertEquals(expected, Grades.of(marks));
}</code></pre>
<p>One method, four test cases, each reported separately. Parameterised tests live in the <code>junit-jupiter-params</code> module, which the <code>junit-jupiter</code> dependency already includes.</p>
<h2>Beyond the obvious</h2>
<ul>
<li><strong>Empty and missing:</strong> null, empty strings, empty lists, zero.</li>
<li><strong>Very large:</strong> a list of a million students, a name of 500 characters.</li>
<li><strong>Special characters:</strong> names with apostrophes or letters from other scripts, email addresses with a plus sign.</li>
<li><strong>Order and repetition:</strong> submitting the same form twice, pressing back after paying.</li>
<li><strong>Security:</strong> a wrong password five times in a row, HTML or SQL typed into a name field.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Testing only the "happy path" — the one input the developer had in mind while writing the code.</li>
<li>Many tests from the same equivalence class and none at the boundaries.</li>
<li>Getting the expected value by running the code and copying its output. If the code is wrong, the test is now wrong too.</li>
</ul>
<h3>Check yourself</h3>
<p>A scholarship is given to students whose family income is at most ₹2,50,000 a year. Which incomes would you test?</p>
<details><summary>Answer</summary><p>On and around the boundary: ₹2,49,999, ₹2,50,000 and ₹2,50,001 (eligible, eligible, not eligible). Add one clearly eligible and one clearly ineligible value, zero, and invalid inputs such as a negative or empty income.</p></details>`,
          resources: [
            {
              title: 'JUnit 5 user guide: parameterized tests',
              url: 'https://junit.org/junit5/docs/current/user-guide/',
            },
          ],
        },
        { kind: 'practice', question: 'testing-assert', topic: 'Test design' },
        {
          kind: 'article',
          title: 'Mocks and test doubles',
          minutes: 15,
          topic: 'Mocking',
          html: `<p>Real classes have dependencies. A <code>FeeService</code> might save to a database, call a payment gateway and send an SMS. If its unit tests used the real versions, they would be slow, need a network, might charge a real card, and would fail whenever the gateway was down — even if your code were perfect. Test doubles solve this.</p>
<h2>Stand-ins for dependencies</h2>
<p>A <strong>test double</strong> is any object that replaces a real dependency during a test. The common kinds are:</p>
<ul>
<li><strong>Stub:</strong> returns canned answers ("the payment succeeded").</li>
<li><strong>Fake:</strong> a simple working version, such as an in-memory list instead of a database table.</li>
<li><strong>Mock:</strong> also records how it was called, so the test can check the interaction ("the SMS sender was asked to send exactly one message, to this number").</li>
</ul>
<p>In everyday speech, people call all of these "mocks".</p>
<h2>Design so you can substitute</h2>
<p>A dependency can be replaced only if your class receives it from outside instead of creating it itself. That is the idea behind constructor injection, which Spring uses everywhere:</p>
<pre class="language-java"><code class="language-java">public interface PaymentGateway {
    boolean charge(String studentId, BigDecimal amount);
}

public class FeeService {
    private final PaymentGateway gateway;

    public FeeService(PaymentGateway gateway) {   // handed in, not created here
        this.gateway = gateway;
    }

    public String pay(String studentId, BigDecimal amount) {
        return gateway.charge(studentId, amount) ? "PAID" : "FAILED";
    }
}</code></pre>
<h2>A hand-written stub, then a mocking library</h2>
<pre class="language-java"><code class="language-java">@Test
void reportsFailureWhenTheGatewayDeclines() {
    PaymentGateway declining = (id, amount) -&gt; false;   // a stub, written as a lambda
    FeeService service = new FeeService(declining);
    assertEquals("FAILED", service.pay("S101", new BigDecimal("5000")));
}</code></pre>
<p>Libraries such as Mockito create these objects for you and can also verify the calls:</p>
<pre class="language-java"><code class="language-java">PaymentGateway gateway = mock(PaymentGateway.class);
when(gateway.charge("S101", new BigDecimal("5000"))).thenReturn(true);

assertEquals("PAID", new FeeService(gateway).pay("S101", new BigDecimal("5000")));
verify(gateway).charge("S101", new BigDecimal("5000"));</code></pre>
<p>Either way, the test runs in milliseconds, never touches the network, and checks <em>your</em> logic: what <code>FeeService</code> does with each answer the gateway could give.</p>
<h2>Do not overdo it</h2>
<ul>
<li>Replace things at the edges of your system — network calls, databases, the clock, email — not every small helper class.</li>
<li>Never mock the class you are testing.</li>
<li>A test that only checks "method A called method B" breaks whenever you refactor, even when the behaviour is unchanged. Prefer checking results.</li>
<li>A mock does not prove that the real gateway works. That is the job of a smaller number of integration tests.</li>
</ul>
<h3>Check yourself</h3>
<p>Your <code>AttendanceReport</code> calls <code>LocalDate.now()</code> to decide whether today is a holiday, and its test fails every Sunday. How would you change the design?</p>
<details><summary>Answer</summary><p>Hand the class its notion of "today" from outside: pass a <code>java.time.Clock</code> (or the date itself) to its constructor or method. Production code passes the system clock; the test passes a fixed clock set to a known working day or holiday, so the result no longer depends on the day the test runs.</p></details>`,
        },
        { kind: 'practice', question: 'testing-mock-purpose', topic: 'Mocking' },
      ],
    },
    {
      title: 'Shipping your code',
      summary:
        'Continuous integration, environments and configuration, keeping secrets out of code, containers, and the logs, health checks and monitoring that keep a release healthy.',
      lessons: [
        {
          kind: 'article',
          title: 'Continuous integration: every change checked automatically',
          minutes: 15,
          topic: 'Continuous integration',
          html: `<p>"It works on my machine" is the oldest excuse in software, and continuous integration (CI) retires it. Every time someone pushes a commit or opens a pull request, a clean machine checks out the code, builds it from scratch and runs the tests. If anything fails, the team knows within minutes — and the change does not merge until it is fixed.</p>
<h2>What a pipeline does</h2>
<p>A typical CI pipeline for a Java service runs these steps in order:</p>
<ol>
<li>Check out the exact commit being tested.</li>
<li>Set up the right JDK version.</li>
<li>Build and run the unit tests (<code>mvn clean verify</code>).</li>
<li>Run static checks: formatting, linting, dependencies with known vulnerabilities.</li>
<li>Run integration tests, often against a temporary database.</li>
<li>Optionally, package the application and store the result for deployment.</li>
</ol>
<p>The pipeline relies on exit codes, exactly as you saw in the command-line module: any step that exits with a non-zero code fails the run, and the pull request shows a red cross.</p>
<h2>A GitHub Actions example</h2>
<p>Workflow files live in the repository, in <code>.github/workflows/</code>, so they are versioned and reviewed like any other code:</p>
<pre class="language-yaml"><code class="language-yaml">name: build
on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'
          cache: maven
      - name: Build and test
        run: mvn -B clean verify</code></pre>
<p>Each <code>uses</code> line pulls in a ready-made action; each <code>run</code> line is a shell command. <code>-B</code> runs Maven in batch mode, which keeps the log readable. Other CI systems use different file formats for the same ideas.</p>
<h2>Habits that make CI worth having</h2>
<ul>
<li><strong>Keep main green.</strong> If the main branch's build breaks, fixing it is the whole team's first job.</li>
<li><strong>Keep it fast.</strong> A pipeline that takes an hour gets bypassed. Aim for minutes, and run the slowest suites less often.</li>
<li><strong>Protect the branch.</strong> Configure the repository so a pull request cannot merge until its checks pass.</li>
<li><strong>Treat flaky tests as bugs.</strong> A test that fails at random trains everyone to ignore red builds.</li>
</ul>
<p>Continuous <em>delivery</em> goes one step further: every change that passes the pipeline is packaged and ready to deploy, so releasing becomes a routine, often automated, step.</p>
<h2>Common mistakes</h2>
<ul>
<li>Re-running a failed pipeline until it happens to pass, instead of finding out why it failed.</li>
<li>Writing secrets into the workflow file. CI systems have a secrets store; the workflow refers to a secret by name, such as <code>\${{ secrets.DEPLOY_TOKEN }}</code>, and the value never appears in the repository.</li>
<li>A CI build that differs from the local build. Use the same commands in both places.</li>
</ul>
<h3>Check yourself</h3>
<p>Your pull request is red because one test fails on CI but passes on your laptop. Name two likely causes.</p>
<details><summary>Answer</summary><p>For example: the test relies on something only your machine has (a local file, an environment variable, a running database); a different JDK version or time zone; a test that depends on the order tests run in or on today's date; or a file you forgot to commit. CI's clean machine is doing its job by exposing the difference.</p></details>`,
          resources: [
            { title: 'GitHub Actions documentation', url: 'https://docs.github.com/en/actions' },
          ],
        },
        { kind: 'practice', question: 'deploy-ci-pipeline', topic: 'Continuous integration' },
        {
          kind: 'article',
          title: 'Environments, configuration and secrets',
          minutes: 15,
          topic: 'Configuration',
          html: `<p>The same build of your application usually runs in several places: your laptop, a test server, a staging copy that mirrors production, and production itself. Each place needs different settings — a different database, a different payment account, different logging. The rule that keeps this manageable is simple: <strong>the code is the same everywhere; only the configuration changes.</strong></p>
<h2>Environments</h2>
<table>
<thead><tr><th>Environment</th><th>Purpose</th><th>Data</th></tr></thead>
<tbody>
<tr><td>Development</td><td>Your own machine, for building and debugging</td><td>Made-up sample data</td></tr>
<tr><td>Test or CI</td><td>Automated tests on every change</td><td>Created and thrown away by the tests</td></tr>
<tr><td>Staging</td><td>A rehearsal: set up like production, used for final checks</td><td>Realistic, but not real users' data</td></tr>
<tr><td>Production</td><td>Real users</td><td>Real data, protected carefully</td></tr>
</tbody>
</table>
<p>A change is promoted through these in order. The same tested build moves forward; you do not rebuild it differently for production.</p>
<h2>Configuration from the environment</h2>
<p>Settings that differ between environments — database addresses, API keys, feature switches — are read when the application starts, most commonly from environment variables. In Spring Boot, a property can refer to one:</p>
<pre class="language-text"><code class="language-text"># application.properties (committed, so it holds no real secrets)
spring.datasource.url=\${DB_URL}
spring.datasource.username=\${DB_USER}
spring.datasource.password=\${DB_PASSWORD}</code></pre>
<p>Each environment then supplies its own values: on your laptop, perhaps a <code>.env</code> file loaded by your IDE or run script and listed in <code>.gitignore</code>; on a server, the hosting platform's settings or a dedicated secrets manager; in CI, the CI system's secrets store.</p>
<h2>Secrets need extra care</h2>
<p>A secret is anything that grants access: passwords, API keys, tokens, private keys. These rules are standard in every serious team:</p>
<ul>
<li><strong>Never commit a secret</strong> — not "temporarily", and not to a private repository. Git keeps history: deleting the line in the next commit does not remove it from the earlier one.</li>
<li><strong>If a secret leaks, rotate it.</strong> Issue a new one, update the environments, and revoke the old one. Assume anything that reached a repository, a chat or a screenshot is compromised.</li>
<li><strong>Give each environment its own secrets</strong>, so that a leak from a test server cannot unlock production.</li>
<li><strong>Keep secrets out of logs</strong> and error messages.</li>
<li><strong>Grant the least privilege needed.</strong> The application's database user needs to read and write its own tables, not to drop the database.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Hard-coding <code>localhost</code> or a password in a Java class "just for now".</li>
<li>Sharing a <code>.env</code> file with real credentials in a team chat.</li>
<li>Testing against the production database because it "has better data".</li>
</ul>
<h3>Check yourself</h3>
<p>A teammate's pull request adds <code>sms.api.key=</code> followed by a live key to <code>application.properties</code>. It has been pushed but not merged. What should happen?</p>
<details><summary>Answer</summary><p>Point it out to them quickly and privately. Because the key was pushed to a shared server, it must be <strong>rotated</strong> — the old key revoked and a new one issued — and removed from the branch. The property should read <code>\${SMS_API_KEY}</code> from the environment instead.</p></details>`,
        },
        { kind: 'practice', question: 'deploy-env-vars', topic: 'Configuration' },
        {
          kind: 'article',
          title: 'Containers in plain words',
          minutes: 15,
          topic: 'Containers',
          html: `<p>Deploying used to mean following a long document: install this Java version, set these variables, copy this jar, open this port. Every server ended up slightly different, and "works on staging, fails on production" was common. Containers package an application together with everything it needs to run, so the same package behaves the same way everywhere.</p>
<h2>Images and containers</h2>
<ul>
<li>An <strong>image</strong> is a read-only package: a minimal operating-system layer, the runtime (for example a Java runtime), your application and the command that starts it. You build it once.</li>
<li>A <strong>container</strong> is a running instance of an image, isolated from the other processes on the machine. You can run many containers from one image.</li>
</ul>
<p>If it helps, think of an image as a class and a container as an object created from it. Unlike a virtual machine, a container shares the host's operating-system kernel, so it starts in seconds and uses little memory.</p>
<h2>A Dockerfile for a Spring Boot service</h2>
<pre class="language-text"><code class="language-text">FROM eclipse-temurin:21-jre
WORKDIR /app
COPY target/fees-service.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]</code></pre>
<p>Line by line: start from an image that already contains Java 21, set the working folder, copy in the jar Maven built, document the port the service listens on, and say how to start it. Notice what is <em>not</em> in the image: passwords and environment-specific settings. Those are passed in when the container starts.</p>
<pre class="language-bash"><code class="language-bash">mvn package
docker build -t fees-service:1.4.0 .         # build an image and tag it
docker run -p 8080:8080 \\
  -e DB_URL=jdbc:postgresql://db:5432/fees \\
  -e DB_PASSWORD \\
  fees-service:1.4.0                         # run it, passing configuration in
docker ps                                    # list running containers
docker logs &lt;container-id&gt;                   # see what it printed</code></pre>
<p><code>-p 8080:8080</code> connects port 8080 on your machine to port 8080 inside the container. <code>-e DB_PASSWORD</code> with no value passes the variable through from your own shell, so the password never appears in the command itself.</p>
<h2>Why teams use containers</h2>
<ul>
<li><strong>Consistency:</strong> the image tested in CI is exactly what runs in production.</li>
<li><strong>Isolation:</strong> two services that need different Java versions can share one machine.</li>
<li><strong>Easy local setup:</strong> one command starts a database for development, with nothing to install.</li>
<li><strong>Scaling and recovery:</strong> a platform can start more copies under load and replace a container that crashes.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Copying a <code>.env</code> file or credentials into the image. Anyone who can pull the image can read them.</li>
<li>Keeping important data inside a container. When the container is replaced, the data goes with it; databases use volumes or managed services.</li>
<li>Tagging every build <code>latest</code>, so nobody can tell which version is running. Tag with version numbers or commit hashes.</li>
</ul>
<h3>Check yourself</h3>
<p>Your team builds one image and runs it in both staging and production. How does the production container end up connected to the production database rather than the staging one?</p>
<details><summary>Answer</summary><p>Through configuration supplied when the container starts — environment variables or a secrets store, set differently in each environment. The image itself is identical in both places; that is the whole point.</p></details>`,
          resources: [
            { title: 'Docker: get started', url: 'https://docs.docker.com/get-started/' },
          ],
        },
        { kind: 'practice', question: 'deploy-docker-image', topic: 'Containers' },
        {
          kind: 'article',
          title: 'After the release: logs, health checks and monitoring',
          minutes: 15,
          topic: 'Operations',
          html: `<p>Deployment is not the finish line. Once real users arrive, you need to know whether the application is up, whether it is fast enough, and what went wrong when someone reports "the fee page is not loading". You cannot attach a debugger to production, so you rely on what the application tells you: its logs, its health checks and its metrics.</p>
<h2>Logs that help in an emergency</h2>
<p>A log line should let someone who has never seen your code understand what happened:</p>
<pre class="language-text"><code class="language-text">2026-03-14T10:42:07Z INFO  fee.paid studentId=S101 amount=5900.00 receipt=R-20931 durationMs=412
2026-03-14T10:42:09Z WARN  sms.retry studentId=S101 attempt=2 reason=timeout
2026-03-14T10:42:15Z ERROR sms.failed studentId=S101 attempts=3 reason=timeout</code></pre>
<ul>
<li><strong>Use levels:</strong> ERROR for failures that need attention, WARN for recoverable problems, INFO for important business events, and DEBUG for detail you switch on only while investigating.</li>
<li><strong>Include context:</strong> which request, which record, how long it took. Many teams log in a structured format (key-value pairs or JSON) so that logs can be searched and filtered.</li>
<li><strong>Never log secrets or sensitive personal data:</strong> passwords, tokens, card numbers, Aadhaar numbers. Logs are copied to many places and kept for a long time.</li>
<li><strong>Log the exception with its stack trace</strong> when you catch one, rather than swallowing it in an empty <code>catch</code> block.</li>
</ul>
<p>Use a logging library (Spring Boot comes with SLF4J and Logback) instead of <code>System.out.println</code>, so that levels and formats can be changed through configuration.</p>
<h2>Health checks</h2>
<p>A health-check endpoint, such as <code>/health</code> or Spring Boot Actuator's <code>/actuator/health</code>, answers one question: can this instance do its job right now? The platform calls it every few seconds. If an instance stops answering or reports itself unhealthy, the platform stops sending it traffic and restarts or replaces it — often before any user notices. A good check is quick and verifies what matters, such as whether the database is reachable.</p>
<h2>Metrics and alerts</h2>
<p>Metrics are numbers tracked over time: requests per minute, error rate, response time, memory use. Dashboards show the trends; <strong>alerts</strong> notify the person on call when a number crosses a threshold — for example, "more than 2% of requests failed in the last five minutes". Alert on symptoms users actually feel, not on every small blip, or people learn to ignore the alerts.</p>
<h2>When a release goes wrong</h2>
<p>Plan your way back before you need it. Because each release is a versioned image, rolling back means redeploying the previous version — minutes, not hours. Then fix forward calmly, with a test that reproduces the problem. After a serious incident, good teams write a short, blame-free review: what happened, how it was noticed, and what will stop it happening again.</p>
<h2>Common mistakes</h2>
<ul>
<li>Logging too little ("Error occurred") or far too much (every loop iteration at INFO).</li>
<li>A health check that always answers OK, even when the database is down.</li>
<li>Releasing late on a Friday with nobody around to watch the metrics.</li>
</ul>
<h3>Check yourself</h3>
<p>Users say fee receipts stopped arriving by SMS this morning. Where do you look first?</p>
<details><summary>Answer</summary><p>Search the logs for the SMS step around the time the problem started — the WARN and ERROR lines and their <code>reason</code> — and check the metrics for when the failure rate rose. Then compare with what changed at that moment: a deployment, an expired key, an outage at the SMS provider.</p></details>`,
        },
        { kind: 'practice', question: 'deploy-health-check', topic: 'Operations' },
      ],
    },
    {
      title: 'Working with AI coding assistants',
      summary:
        'Using AI coding assistants well: what they are good and bad at, asking precise questions, reviewing and testing their output, and protecting secrets, personal data and honesty.',
      lessons: [
        {
          kind: 'article',
          title: 'What AI coding assistants do well, and where they fail',
          minutes: 12,
          topic: 'AI assistants',
          html: `<p>AI coding assistants — chat tools and editor plugins built on large language models — have become part of everyday development. They draft code, explain unfamiliar libraries, suggest tests and point out mistakes. Used well, they save real time. Used carelessly, they produce confident, plausible code that is subtly wrong — and the person who commits it is responsible for it. This module is about staying in the first group.</p>
<h2>How they work, in one paragraph</h2>
<p>A language model generates the text that is most likely to come next, based on patterns learned from a very large amount of training data. It does not run your code, does not see your project unless the tool gives it that context, and does not "know" whether its answer is correct. That explains its strengths — it has seen countless examples of common tasks — and its main weakness: when the likely-looking answer is wrong, it is wrong just as fluently.</p>
<h2>Where they help</h2>
<ul>
<li><strong>Boilerplate:</strong> data classes, mapping code, configuration files you rarely write.</li>
<li><strong>Explanations:</strong> "What does this regular expression match?" or "Walk me through this stack trace."</li>
<li><strong>First drafts of tests</strong>, which you then check and extend with your own boundary cases.</li>
<li><strong>Learning a new tool:</strong> a starting point that you confirm against the official documentation.</li>
<li><strong>A second pair of eyes:</strong> "What could go wrong with this method?"</li>
</ul>
<h2>Where they fail</h2>
<ul>
<li><strong>Invented APIs:</strong> methods, options or library versions that do not exist.</li>
<li><strong>Outdated answers:</strong> code written for an old version of a framework.</li>
<li><strong>Missing context:</strong> the assistant does not know your team's conventions, your data or your edge cases unless you tell it.</li>
<li><strong>Security blind spots:</strong> SQL built by joining strings, passwords compared as plain text, input that is never validated.</li>
<li><strong>Plausible logic errors:</strong> an off-by-one boundary, the wrong rounding mode, an inverted condition.</li>
</ul>
<h2>Your responsibility does not change</h2>
<p>Whether a line was typed by you, copied from a forum or suggested by an assistant, once you commit it, it is your code. Reviewers and interviewers will ask you to explain it. A useful rule: <strong>never commit code you could not have written or explained yourself.</strong> While you are still learning a topic, use the assistant to explain and check your work rather than to do it for you — otherwise the skill you are here to build never forms.</p>
<h2>Common mistakes</h2>
<ul>
<li>Accepting a long suggestion with one keystroke, without reading it.</li>
<li>Asking the assistant whether its own code is correct, and treating "yes" as proof.</li>
<li>Letting it do the fundamentals that interviews will test you on.</li>
</ul>
<h3>Check yourself</h3>
<p>An assistant suggests calling <code>list.removeIfPresent(x)</code> on a Java <code>ArrayList</code>. How do you find out whether that method exists?</p>
<details><summary>Answer</summary><p>Look it up in the official Java API documentation, or let the compiler tell you. It does not exist — <code>remove(Object)</code> and <code>removeIf(Predicate)</code> do. Checking against the documentation and the compiler, not the assistant's confidence, is the habit to build.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Asking good questions: context, constraints and examples',
          minutes: 10,
          topic: 'Asking for help',
          html: `<p>The quality of an assistant's answer depends heavily on the question. "Fix my code" with nothing else gets a guess. A precise request with context gets something you can actually use. The same skill makes you good at asking a senior developer or a forum for help, so it is worth practising either way.</p>
<h2>What a useful request contains</h2>
<ol>
<li><strong>The goal:</strong> what you are trying to achieve, in one sentence.</li>
<li><strong>The context:</strong> language and version, framework, and the relevant code, trimmed to what matters.</li>
<li><strong>What happened:</strong> the exact error message or wrong output, and what you expected instead.</li>
<li><strong>What you have tried</strong>, so those suggestions do not come back.</li>
<li><strong>Constraints:</strong> "no new libraries", "must work on Java 17", "keep the method signature".</li>
</ol>
<h2>Before and after</h2>
<p><strong>Weak:</strong> "my login is not working help"</p>
<p><strong>Better:</strong></p>
<pre class="language-text"><code class="language-text">I'm building a REST API with Spring Boot 3 on Java 21. POST /api/auth/login
returns 403 Forbidden for every request, even with a correct password; I
expected 200 with a token. My security configuration is below (trimmed).
I have already checked that the user exists and that the stored password
is a BCrypt hash. What are the likely causes of a 403 here, and how can
I confirm each one?</code></pre>
<p>Notice the last sentence: it asks for <em>causes and how to confirm them</em>, not just a block of code to paste. That keeps you in charge of the diagnosis and teaches you something you can reuse next time.</p>
<h2>Working in steps</h2>
<ul>
<li>Ask for a plan before code: "What are the steps to add CSV export to this report?"</li>
<li>Ask for one small piece at a time, and test each piece before moving on.</li>
<li>Give an example of input and expected output; it removes ambiguity better than paragraphs of description.</li>
<li>When an answer is wrong, say exactly how: "This throws <code>NullPointerException</code> when the list is empty."</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Pasting an entire project and asking "what's wrong?".</li>
<li>Leaving out the error message, or paraphrasing it instead of copying it exactly.</li>
<li>Including secrets or real personal data in the context — the subject of the last lesson in this module.</li>
</ul>
<h3>Check yourself</h3>
<p>Improve this request: "write a function for marks".</p>
<details><summary>Answer</summary><p>For example: "In Java 21, write a method <code>String grade(int marks)</code> that returns A for 90 to 100, B for 75 to 89, C for 50 to 74 and F below 50, and throws <code>IllegalArgumentException</code> outside 0 to 100. Then list the boundary values I should test." It states the language, the signature, the rules and the error handling — and asks for test ideas you can check yourself.</p></details>`,
        },
        { kind: 'practice', question: 'ai-good-prompt', topic: 'Asking for help' },
        {
          kind: 'article',
          title: 'Reviewing and testing what an assistant writes',
          minutes: 15,
          topic: 'Verifying AI output',
          html: `<p>Treat code from an assistant the way a careful senior developer treats a pull request from a new teammate: probably useful, possibly wrong, and not merged until it has been read, understood and tested. This lesson gives you a checklist and a worked example.</p>
<h2>A review checklist</h2>
<ol>
<li><strong>Read every line.</strong> If you cannot explain a line, find out what it does before keeping it.</li>
<li><strong>Check that it compiles and uses real APIs</strong> for the versions your project uses.</li>
<li><strong>Check the logic against the requirement</strong>, especially boundaries, empty input, nulls and rounding.</li>
<li><strong>Look for security problems:</strong> SQL built from strings, secrets or personal data in logs, missing input validation, passwords stored or compared as plain text.</li>
<li><strong>Write and run tests</strong>, including cases you chose yourself, not only the ones the assistant suggested.</li>
<li><strong>Match the project's conventions:</strong> naming, error handling, existing helpers it should have reused.</li>
<li><strong>Consider where it came from.</strong> If a large block looks copied from somewhere, check your team's rules on licensing.</li>
</ol>
<h2>A worked example</h2>
<p>You ask for a method that finds a student by email address. The assistant replies:</p>
<pre class="language-java"><code class="language-java">public Student findByEmail(String email) throws SQLException {
    String sql = "SELECT * FROM students WHERE email = '" + email + "'";
    try (Statement st = connection.createStatement();
         ResultSet rs = st.executeQuery(sql)) {
        log.info("Looking up " + email);
        return rs.next() ? map(rs) : null;
    }
}</code></pre>
<p>It compiles and works in a quick manual test. A review finds four problems:</p>
<ul>
<li><strong>SQL injection.</strong> The email is pasted into the SQL text, so input such as <code>' OR '1'='1</code> changes the query itself. Use a <code>PreparedStatement</code> with a <code>?</code> parameter.</li>
<li><strong>Personal data in logs.</strong> Logging every email address at INFO spreads personal data into log storage. Log an ID, or nothing.</li>
<li><strong>Returning <code>null</code>.</strong> Callers will forget to check. <code>Optional&lt;Student&gt;</code> makes "not found" explicit.</li>
<li><strong>Letter case.</strong> Is <code>Priya@Example.com</code> the same student as <code>priya@example.com</code>? The requirement decides — the assistant simply guessed.</li>
</ul>
<pre class="language-java"><code class="language-java">public Optional&lt;Student&gt; findByEmail(String email) throws SQLException {
    String sql = "SELECT * FROM students WHERE lower(email) = lower(?)";
    try (PreparedStatement ps = connection.prepareStatement(sql)) {
        ps.setString(1, email);
        try (ResultSet rs = ps.executeQuery()) {
            return rs.next() ? Optional.of(map(rs)) : Optional.empty();
        }
    }
}</code></pre>
<p>Then the tests: a known email, the same email in different case, an unknown email, and an input containing a quote character.</p>
<h2>Common mistakes</h2>
<ul>
<li>"It ran once, so it works." One manual run checks one input.</li>
<li>Asking the assistant to write the tests for its own code and stopping there: code and tests can share the same misunderstanding.</li>
<li>Committing a large generated change in one go, which nobody can review properly.</li>
</ul>
<h3>Check yourself</h3>
<p>An assistant's sorting method passes the three tests it also wrote. What do you add before trusting it?</p>
<details><summary>Answer</summary><p>Your own cases: an empty list, a single element, duplicates, an already sorted list and a reverse-sorted one, negative numbers, and a large input. Then read the code until you understand why it works, not just that it passed.</p></details>`,
        },
        { kind: 'practice', question: 'ai-verify-generated-code', topic: 'Verifying AI output' },
        {
          kind: 'article',
          title: 'Privacy, secrets and honesty when using AI tools',
          minutes: 12,
          topic: 'Responsible use',
          html: `<p>Whatever you paste into an AI service leaves your machine. Depending on the tool and its settings, it may be stored, reviewed by people or used to improve future models. That is fine for a general question about Java streams. It is not fine for a production password, a customer list, or code your employer has not allowed you to share. This lesson covers the rules professionals follow.</p>
<h2>Never share</h2>
<ul>
<li><strong>Secrets:</strong> passwords, API keys, tokens, private keys, connection strings that include credentials. If you paste one by mistake, treat it as leaked and rotate it.</li>
<li><strong>Personal data:</strong> real people's names with phone numbers, emails, addresses, ID numbers, marks or health details. Data protection law, including India's Digital Personal Data Protection Act, places duties on anyone handling such data.</li>
<li><strong>Confidential code and documents</strong> that your employer or client has not approved for the tool you are using.</li>
</ul>
<h2>How to ask safely</h2>
<ul>
<li>Replace real values with placeholders: <code>jdbc:postgresql://HOST:5432/DBNAME</code>, <code>password=REDACTED</code>.</li>
<li>Use made-up sample rows — "Student A, 72 marks" — instead of a real export.</li>
<li>Reduce the problem to a small example that shows the bug without the rest of the system. Doing that often reveals the bug on its own.</li>
<li>Use only the tools your organisation has approved, set up the way it requires. Many organisations provide an approved assistant precisely so that staff do not paste work into public ones.</li>
</ul>
<h2>Honesty while learning and in interviews</h2>
<ul>
<li><strong>Follow each assignment's rules.</strong> If your trainer asks you to solve a problem without assistance, an assistant-written answer is not your answer — and the gap shows the moment you face a live coding round.</li>
<li><strong>Be open about how you used it.</strong> "I used an assistant to draft the tests and then added the boundary cases" is a perfectly professional sentence in a pull request or an interview.</li>
<li><strong>Own the result.</strong> If generated code causes a bug, "the AI wrote it" is not an explanation anyone will accept.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>Pasting a full stack trace that contains a database URL with the password in it.</li>
<li>Uploading a spreadsheet of real student or customer records to "clean it up".</li>
<li>Assuming that a paid or "private" account makes any data safe to share. Check what your organisation allows.</li>
</ul>
<h3>Check yourself</h3>
<p>Your application cannot connect to its database, and the error message contains the full connection string, password included. How do you ask an assistant for help?</p>
<details><summary>Answer</summary><p>Copy the error, then replace the host, database name, user name and password with placeholders before pasting it. Add the driver and framework versions and what you have already checked. If the real password was ever pasted anywhere outside your secure systems, rotate it.</p></details>`,
        },
        { kind: 'practice', question: 'ai-secrets-in-prompts', topic: 'Responsible use' },
      ],
    },
  ],
  assignments: ['Git and Collaboration', 'Testing, Deployment and AI-Assisted Development'],
  tests: [
    {
      title: 'Developer Tools — on-demand practice test',
      kind: 'practice',
      description:
        'Fifteen quick questions across Git, testing, deployment and AI-assisted development. Take it whenever you like and use the result to choose which lessons to revisit.',
      durationMinutes: 25,
      sections: [
        {
          title: 'Git',
          questions: [
            'git-staging-area',
            'git-branch-purpose',
            'git-merge-conflict',
            'git-revert-vs-reset',
            'git-commit-message',
          ],
        },
        {
          title: 'Testing',
          questions: ['testing-unit-vs-integration', 'testing-assert', 'testing-mock-purpose'],
        },
        {
          title: 'Shipping and AI assistants',
          questions: [
            'deploy-env-vars',
            'deploy-docker-image',
            'deploy-ci-pipeline',
            'deploy-health-check',
            'ai-verify-generated-code',
            'ai-secrets-in-prompts',
            'ai-good-prompt',
          ],
        },
      ],
    },
    {
      title: 'Developer Tools — final assessment',
      kind: 'final',
      description:
        'The closing assessment for the course: objective questions on every module, plus two written answers marked by your trainer — test cases for a sign-in form, and a review of a method an AI assistant wrote.',
      durationMinutes: 60,
      sections: [
        {
          title: 'Version control',
          questions: [
            'git-staging-area',
            'git-branch-purpose',
            'git-merge-conflict',
            'git-revert-vs-reset',
            'git-commit-message',
          ],
        },
        {
          title: 'Testing',
          questions: [
            'testing-unit-vs-integration',
            'testing-assert',
            'testing-mock-purpose',
            'testing-login-cases',
          ],
        },
        {
          title: 'Deployment',
          questions: [
            'deploy-env-vars',
            'deploy-docker-image',
            'deploy-ci-pipeline',
            'deploy-health-check',
          ],
        },
        {
          title: 'AI-assisted development',
          questions: [
            'ai-verify-generated-code',
            'ai-secrets-in-prompts',
            'ai-good-prompt',
            'ai-review-written',
          ],
        },
      ],
    },
  ],
};
