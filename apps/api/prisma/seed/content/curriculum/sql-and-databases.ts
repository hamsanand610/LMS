import type { CurriculumCourse } from './types.js';

export const COURSE: CurriculumCourse = {
  slug: 'sql-and-databases',
  title: 'SQL and Databases',
  subject: 'sql',
  level: 'beginner',
  description:
    'Learn to store, query and change data in a relational database with standard SQL. You start from tables, keys and constraints, write queries that filter, sort, group and join, change data safely, and finish with normalisation, indexes and transactions, with the MySQL and PostgreSQL differences you will meet at work called out along the way.',
  tags: ['sql', 'mysql', 'postgresql', 'databases', 'joins', 'transactions', 'placement'],
  modules: [
    {
      title: 'Foundations',
      summary:
        'What a relational database is, how to set one up, and how tables, data types, NULL, keys and constraints keep your data organised and correct.',
      lessons: [
        {
          kind: 'article',
          title: 'What a relational database is, and why not a spreadsheet',
          minutes: 12,
          topic: 'The relational model',
          html: `<p>Every app you used today (a food-delivery order, a UPI payment, your university's results portal) reads and writes data kept in a database. A <strong>database</strong> is an organised collection of data. A <strong>database management system</strong> (DBMS) is the software that stores that data safely, lets many people use it at once and answers questions about it. The language almost every DBMS understands is <strong>SQL</strong>, and it is asked in nearly every IT interview, whether the role is Java developer, tester, data analyst or support engineer.</p>
<h2>Why not just use a spreadsheet?</h2>
<p>A spreadsheet is fine for fifty students. Now imagine an institute with five thousand students, a dozen courses and counsellors in three branches updating records at the same time. Problems pile up:</p>
<ul>
<li><strong>Repeated facts drift apart.</strong> If the course fee is typed on every student's row, a fee change means editing hundreds of cells, and missing one.</li>
<li><strong>Nothing checks the data.</strong> Someone types "Chenai", leaves the phone number empty or enters a score of 920.</li>
<li><strong>Two people, one file.</strong> Simultaneous edits overwrite each other.</li>
<li><strong>Crashes lose work.</strong> A power cut in the middle of a save can corrupt the file.</li>
</ul>
<p>A relational DBMS answers each problem: every fact is stored once and linked, constraints reject bad values, transactions keep simultaneous users apart, and a log lets the database recover after a crash.</p>
<h2>Tables, rows, columns and keys</h2>
<p>In a <strong>relational</strong> database, data lives in <strong>tables</strong> (the theory calls them relations). Each table describes one kind of thing:</p>
<ul>
<li>a <strong>row</strong> (also called a record or tuple) is one thing, such as one student;</li>
<li>a <strong>column</strong> (an attribute or field) is one fact recorded for every row, such as the student's city;</li>
<li>a <strong>key</strong> is a column, or a set of columns, that identifies a row and links tables together.</li>
</ul>
<p>This course uses one small institute database from start to finish. Here is the <code>students</code> table:</p>
<table>
<thead><tr><th>id</th><th>name</th><th>city</th><th>batch</th></tr></thead>
<tbody>
<tr><td>1</td><td>Asha Krishnan</td><td>Chennai</td><td>B1</td></tr>
<tr><td>2</td><td>Rahul Varma</td><td>Coimbatore</td><td>B1</td></tr>
<tr><td>3</td><td>Divya Sundar</td><td>Chennai</td><td>B2</td></tr>
<tr><td>4</td><td>Imran Sheikh</td><td>Madurai</td><td>B1</td></tr>
<tr><td>5</td><td>Keerthana Raj</td><td>Coimbatore</td><td>B2</td></tr>
<tr><td>6</td><td>Vignesh Babu</td><td>Chennai</td><td>B1</td></tr>
<tr><td>7</td><td>Nandhini Ravi</td><td>Tiruchirappalli</td><td>B2</td></tr>
</tbody>
</table>
<p>The <code>courses</code> table, with fees in rupees:</p>
<table>
<thead><tr><th>id</th><th>title</th><th>fee</th></tr></thead>
<tbody>
<tr><td>1</td><td>Core Java</td><td>18000</td></tr>
<tr><td>2</td><td>SQL and Databases</td><td>9000</td></tr>
<tr><td>3</td><td>Web Development</td><td>15000</td></tr>
<tr><td>4</td><td>Spring Boot</td><td>22000</td></tr>
</tbody>
</table>
<p>And <code>enrolments</code>, which records who joined which course and the score they got. <code>NULL</code> marks a score that has not been recorded yet:</p>
<table>
<thead><tr><th>student_id</th><th>course_id</th><th>score</th></tr></thead>
<tbody>
<tr><td>1</td><td>1</td><td>88</td></tr>
<tr><td>1</td><td>2</td><td>92</td></tr>
<tr><td>2</td><td>1</td><td>64</td></tr>
<tr><td>2</td><td>3</td><td>71</td></tr>
<tr><td>3</td><td>2</td><td>55</td></tr>
<tr><td>3</td><td>3</td><td>80</td></tr>
<tr><td>4</td><td>1</td><td>91</td></tr>
<tr><td>5</td><td>4</td><td>NULL</td></tr>
<tr><td>6</td><td>1</td><td>73</td></tr>
<tr><td>6</td><td>2</td><td>68</td></tr>
<tr><td>6</td><td>4</td><td>85</td></tr>
</tbody>
</table>
<p>Look at what <code>enrolments</code> does <em>not</em> contain: no student names, no course titles, no fees. It stores only <code>student_id</code> and <code>course_id</code>, and those numbers point to rows in the other two tables. Store each fact once and link with keys: that single idea is what keeps relational databases consistent.</p>
<h2>SQL: you say what you want, the database decides how</h2>
<p>SQL (Structured Query Language, pronounced "ess-cue-ell" or "sequel") is <em>declarative</em>. You describe the result you want; the database's <em>query optimiser</em> works out how to fetch it, which index to use and in which order to read the tables.</p>
<pre><code class="language-sql">SELECT name, city
FROM students
WHERE batch = 'B2';</code></pre>
<table>
<thead><tr><th>name</th><th>city</th></tr></thead>
<tbody>
<tr><td>Divya Sundar</td><td>Chennai</td></tr>
<tr><td>Keerthana Raj</td><td>Coimbatore</td></tr>
<tr><td>Nandhini Ravi</td><td>Tiruchirappalli</td></tr>
</tbody>
</table>
<p>There is no loop, no file handling and no parsing. Compare that with the Java you would need to read a file line by line, split each line and check the batch.</p>
<h2>Which database will you meet at work?</h2>
<p>SQL is an ISO standard, and the major relational databases follow it closely, each with its own dialect:</p>
<ul>
<li><strong>MySQL</strong>: very common in Indian service companies, start-ups and Java or PHP web applications.</li>
<li><strong>PostgreSQL</strong>: open source, strict about the standard and a frequent choice for new products.</li>
<li><strong>Oracle Database</strong> and <strong>Microsoft SQL Server</strong>: widespread in banks, insurance and large enterprises.</li>
<li><strong>SQLite</strong>: a small database kept in a single file, built into every Android phone.</li>
</ul>
<p>This course teaches standard SQL and flags the places where MySQL and PostgreSQL differ. Learn one well and moving to another takes days, not months.</p>
<h2>Check yourself</h2>
<details><summary>Why does enrolments store course_id instead of the course title and fee?</summary><p>So that each fact lives in exactly one place. If the Core Java fee changes, you update one row in <code>courses</code>, and every enrolment sees the new fee through the link. Copying the fee into every enrolment would mean many updates and a real chance of missing some.</p></details>
<details><summary>An interviewer asks: what is the difference between a DBMS and an RDBMS?</summary><p>Any DBMS stores and manages data. An RDBMS is a DBMS built on the relational model: data in tables, relationships through keys, integrity enforced by constraints, and SQL as the query language. MySQL and PostgreSQL are RDBMSs; a document store such as MongoDB is a DBMS that is not relational.</p></details>`,
          resources: [
            {
              title: 'PostgreSQL tutorial',
              url: 'https://www.postgresql.org/docs/current/tutorial.html',
            },
            {
              title: 'MySQL 8.0 Reference Manual',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Setting up MySQL or PostgreSQL and running your first statements',
          minutes: 20,
          topic: 'Getting started',
          html: `<p>You learn SQL by typing queries and looking at the results, not by reading about them. In this lesson you install a database server, create the institute database from the previous lesson and meet the four families of SQL statements that interviewers like to ask about.</p>
<h2>Pick one database and install it</h2>
<p>You need only one. Everything in this course runs on both of these:</p>
<ul>
<li><strong>MySQL 8</strong>: install MySQL Community Server. It brings the <code>mysql</code> command-line client, and you can add MySQL Workbench if you prefer a graphical editor. Choose MySQL if the companies you are targeting mention it in their job posts; many service companies and start-ups do.</li>
<li><strong>PostgreSQL 16 or later</strong>: install the server. It brings the <code>psql</code> client, and pgAdmin as a graphical tool. Choose PostgreSQL if you want the dialect that sticks closest to the standard.</li>
</ul>
<p>The installer asks for a password for the administrator account (<code>root</code> in MySQL, <code>postgres</code> in PostgreSQL). Keep it somewhere safe. Later, when you connect from a Java application, you will create a separate, less powerful user; applications should never connect as the administrator.</p>
<h2>Create a database and connect to it</h2>
<p>One server holds many databases. Create one for this course:</p>
<pre><code class="language-sql">CREATE DATABASE institute;</code></pre>
<p>Moving between databases and listing tables are features of the client program, not SQL, so the commands differ:</p>
<table>
<thead><tr><th>Task</th><th>mysql client</th><th>psql client</th></tr></thead>
<tbody>
<tr><td>Connect as the administrator</td><td><code>mysql -u root -p</code></td><td><code>psql -U postgres</code></td></tr>
<tr><td>Switch to a database</td><td><code>USE institute;</code></td><td><code>\\c institute</code></td></tr>
<tr><td>List the tables</td><td><code>SHOW TABLES;</code></td><td><code>\\dt</code></td></tr>
<tr><td>Describe one table</td><td><code>DESCRIBE students;</code></td><td><code>\\d students</code></td></tr>
<tr><td>Quit</td><td><code>exit</code></td><td><code>\\q</code></td></tr>
</tbody>
</table>
<h2>Create the tables and add the rows</h2>
<p>Run this script. It creates the three tables and fills them with the rows you will query in every lesson. You will understand each line by the end of this module; for now, type it rather than paste it, because typing is how the syntax sticks.</p>
<pre><code class="language-sql">CREATE TABLE students (
  id    INTEGER PRIMARY KEY,
  name  VARCHAR(100) NOT NULL,
  city  VARCHAR(60)  NOT NULL,
  batch VARCHAR(10)  NOT NULL
);

CREATE TABLE courses (
  id    INTEGER PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  fee   INTEGER      NOT NULL
);

CREATE TABLE enrolments (
  student_id INTEGER NOT NULL,
  course_id  INTEGER NOT NULL,
  score      INTEGER,
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES students (id),
  FOREIGN KEY (course_id)  REFERENCES courses (id)
);

INSERT INTO students (id, name, city, batch) VALUES
  (1, 'Asha Krishnan', 'Chennai', 'B1'),
  (2, 'Rahul Varma', 'Coimbatore', 'B1'),
  (3, 'Divya Sundar', 'Chennai', 'B2'),
  (4, 'Imran Sheikh', 'Madurai', 'B1'),
  (5, 'Keerthana Raj', 'Coimbatore', 'B2'),
  (6, 'Vignesh Babu', 'Chennai', 'B1'),
  (7, 'Nandhini Ravi', 'Tiruchirappalli', 'B2');

INSERT INTO courses (id, title, fee) VALUES
  (1, 'Core Java', 18000),
  (2, 'SQL and Databases', 9000),
  (3, 'Web Development', 15000),
  (4, 'Spring Boot', 22000);

INSERT INTO enrolments (student_id, course_id, score) VALUES
  (1, 1, 88), (1, 2, 92), (2, 1, 64), (2, 3, 71), (3, 2, 55),
  (3, 3, 80), (4, 1, 91), (5, 4, NULL), (6, 1, 73), (6, 2, 68), (6, 4, 85);</code></pre>
<p>Check that it worked with <code>SELECT * FROM enrolments;</code>. You should see eleven rows.</p>
<h2>The four families of SQL statements</h2>
<table>
<thead><tr><th>Family</th><th>What it does</th><th>Statements</th></tr></thead>
<tbody>
<tr><td>DDL, Data Definition Language</td><td>Creates and changes structure</td><td>CREATE, ALTER, DROP, TRUNCATE</td></tr>
<tr><td>DML, Data Manipulation Language</td><td>Reads and changes rows</td><td>SELECT, INSERT, UPDATE, DELETE</td></tr>
<tr><td>DCL, Data Control Language</td><td>Grants and removes permissions</td><td>GRANT, REVOKE</td></tr>
<tr><td>TCL, Transaction Control Language</td><td>Groups changes into all-or-nothing units</td><td>COMMIT, ROLLBACK, SAVEPOINT</td></tr>
</tbody>
</table>
<p>Some books give SELECT a family of its own, DQL (Data Query Language). If an interviewer asks you to classify a statement, say which family and what it acts on: "TRUNCATE is DDL because it works on the table as a whole, not row by row."</p>
<h2>Habits that will save you later</h2>
<ul>
<li>End every statement with a semicolon. The command-line clients wait for it before running anything.</li>
<li>Write keywords in capitals and names in lower case with underscores, such as <code>course_id</code>. SQL keywords are not case-sensitive, but a consistent style makes long queries readable.</li>
<li>Put text values in single quotes: <code>'Chennai'</code>. In standard SQL, double quotes mean a column or table name, not text.</li>
<li>Start a comment with two dashes and a space: <code>-- like this</code>.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li><strong>Running the script twice.</strong> You get "table already exists". To start over, drop the tables first, children before parents: <code>DROP TABLE IF EXISTS enrolments;</code> and then <code>students</code> and <code>courses</code>. Dropping <code>students</code> first fails because <code>enrolments</code> still refers to it.</li>
<li><strong>Forgetting to switch databases.</strong> MySQL answers "No database selected"; psql quietly creates the tables in the default <code>postgres</code> database.</li>
<li><strong>Missing semicolon.</strong> The prompt changes to <code>-&gt;</code> (mysql) or <code>-#</code> (psql) and waits. Type <code>;</code> and press Enter.</li>
</ul>`,
          resources: [
            {
              title: 'MySQL 8.0 Reference Manual',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/',
            },
            {
              title: 'PostgreSQL tutorial',
              url: 'https://www.postgresql.org/docs/current/tutorial.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Creating tables: data types, NULL and defaults',
          minutes: 16,
          topic: 'Tables',
          html: `<p>A table definition is a contract. Every row you insert later must fit the column types and rules you choose now, so a few minutes of thought here saves weeks of cleaning bad data. In this lesson you choose data types sensibly, learn what <code>NULL</code> really means and use defaults.</p>
<h2>The anatomy of CREATE TABLE</h2>
<p>Each column gets a name, a data type and optional rules. Here is a table for fee payments:</p>
<pre><code class="language-sql">CREATE TABLE payments (
  id         INTEGER       PRIMARY KEY,
  student_id INTEGER       NOT NULL,
  amount     DECIMAL(10,2) NOT NULL,
  paid_on    DATE          NOT NULL,
  mode       VARCHAR(20)   NOT NULL DEFAULT 'UPI',
  remarks    VARCHAR(200)
);</code></pre>
<p>Read it aloud: "a payment has an id, belongs to a student, has an amount with two decimal places, a date, a payment mode that is UPI unless stated otherwise, and optional remarks."</p>
<h2>Choosing data types</h2>
<table>
<thead><tr><th>Kind of value</th><th>Standard and PostgreSQL</th><th>MySQL</th><th>Typical use</th></tr></thead>
<tbody>
<tr><td>Whole numbers</td><td>INTEGER, BIGINT</td><td>INT, BIGINT</td><td>ids, counts, marks</td></tr>
<tr><td>Exact decimals</td><td>NUMERIC(p,s) or DECIMAL(p,s)</td><td>DECIMAL(p,s)</td><td>money, percentages</td></tr>
<tr><td>Text</td><td>VARCHAR(n), TEXT</td><td>VARCHAR(n), TEXT</td><td>names, emails, phone numbers</td></tr>
<tr><td>Dates and times</td><td>DATE, TIMESTAMP</td><td>DATE, DATETIME, TIMESTAMP</td><td>date of birth, created time</td></tr>
<tr><td>True or false</td><td>BOOLEAN</td><td>BOOLEAN (stored as TINYINT(1))</td><td>flags such as is_active</td></tr>
</tbody>
</table>
<p>A few rules of thumb:</p>
<ul>
<li><strong>Money is never FLOAT or DOUBLE.</strong> Floating-point numbers cannot hold 0.1 exactly, so totals drift by paise. Use <code>DECIMAL(10,2)</code>, or store whole paise in an integer column.</li>
<li><strong>Phone numbers and PIN codes are text.</strong> You never do arithmetic on them, and an integer would drop the leading zero of <code>044</code> and reject <code>+91</code>.</li>
<li><strong>Dates are DATE, not text.</strong> Write date values as <code>'2026-10-09'</code> (year, month, day). A real date column sorts correctly and supports date arithmetic; the text <code>'09/10/2026'</code> does neither.</li>
<li><strong>VARCHAR(n) needs a sensible n.</strong> 100 for a name or 254 for an email is reasonable.</li>
</ul>
<h3>Ids the database generates</h3>
<p>Typing ids by hand is fine for practice. In real tables you let the database generate them, and this is one place where the dialects differ:</p>
<pre><code class="language-sql">-- MySQL
id INT AUTO_INCREMENT PRIMARY KEY

-- PostgreSQL (and the SQL standard)
id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY</code></pre>
<p>Older PostgreSQL code uses <code>SERIAL</code> for the same purpose; you will still see it in many projects.</p>
<h2>NULL: a missing value, not zero</h2>
<p><code>NULL</code> means "unknown" or "not applicable". In <code>enrolments</code>, Keerthana's Spring Boot score is <code>NULL</code> because she has not taken the exam yet. A score of <code>0</code> would say something very different: that she took it and scored nothing. Likewise, a <code>NULL</code> in <code>remarks</code> is not the same as an empty string <code>''</code> in MySQL or PostgreSQL. (Oracle is the odd one out: it treats an empty string as <code>NULL</code>.)</p>
<p>NULL changes how comparisons work. Any comparison with NULL, even <code>NULL = NULL</code>, gives neither true nor false but <strong>unknown</strong>, and <code>WHERE</code> keeps only rows where the condition is true. So the way to find missing values is the special operator <code>IS NULL</code>:</p>
<pre><code class="language-sql">SELECT student_id, course_id
FROM enrolments
WHERE score IS NULL;</code></pre>
<table>
<thead><tr><th>student_id</th><th>course_id</th></tr></thead>
<tbody><tr><td>5</td><td>4</td></tr></tbody>
</table>
<p>The opposite is <code>IS NOT NULL</code>. You will lean on both constantly.</p>
<h2>NOT NULL and DEFAULT</h2>
<p><code>NOT NULL</code> forbids missing values: an insert without <code>student_id</code> fails with an error instead of creating a payment that belongs to nobody. <code>DEFAULT</code> supplies a value when the insert leaves the column out:</p>
<pre><code class="language-sql">INSERT INTO payments (id, student_id, amount, paid_on)
VALUES (1, 3, 4500.00, '2026-10-01');
-- mode becomes 'UPI', remarks becomes NULL</code></pre>
<p>Make a column <code>NOT NULL</code> unless you can name a real situation where the value is unknown. Optional should be a decision, not an accident.</p>
<h2>Common mistakes</h2>
<ul>
<li>Using <code>FLOAT</code> for fees and wondering why the totals are off by a few paise.</li>
<li>Storing marks as <code>VARCHAR</code>: then <code>'9'</code> sorts after <code>'10'</code>, because text compares character by character.</li>
<li>Leaving every column nullable "to be safe", so the table fills with half-empty rows.</li>
<li>Writing <code>WHERE score = NULL</code>. It never matches; use <code>IS NULL</code>.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>Which type would you choose for a student's Aadhaar-style 12-digit ID number, and why?</summary><p><code>CHAR(12)</code> or <code>VARCHAR(12)</code>. It is an identifier, not a quantity: you never add or average it, and text keeps any leading zeros.</p></details>`,
          resources: [
            {
              title: 'PostgreSQL: Data Types',
              url: 'https://www.postgresql.org/docs/current/datatype.html',
            },
            {
              title: 'MySQL: Data Types',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/data-types.html',
            },
            {
              title: 'MySQL: Working with NULL Values',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/working-with-null.html',
            },
          ],
        },
        { kind: 'practice', question: 'sql-null-comparison', topic: 'Tables' },
        {
          kind: 'article',
          title: 'Keys and constraints that keep your data honest',
          minutes: 18,
          topic: 'Keys',
          html: `<p>An application checks its input, but data also arrives from import scripts, admin tools and other services. <strong>Constraints</strong> are rules the database itself enforces, whoever writes the data. They are your last line of defence, and interviewers expect you to know them well.</p>
<h2>Primary key: one row, one identity</h2>
<p>A <strong>primary key</strong> identifies each row. The database guarantees two things about it: no two rows share the value, and the value is never <code>NULL</code>. A table has at most one primary key, and the database builds an index on it automatically, so looking a row up by its key is fast.</p>
<p>A key can span several columns. In <code>enrolments</code> the primary key is the pair <code>(student_id, course_id)</code>:</p>
<pre><code class="language-sql">PRIMARY KEY (student_id, course_id)</code></pre>
<p>That composite key encodes a business rule: a student can join many courses, and a course can have many students, but the same student cannot enrol in the same course twice. Try it:</p>
<pre><code class="language-sql">INSERT INTO enrolments (student_id, course_id, score) VALUES (1, 1, 75);
-- fails: duplicate entry '1-1' for the primary key</code></pre>
<h3>Natural or surrogate?</h3>
<p>A <em>natural</em> key is a real-world value such as an email address or a university register number. A <em>surrogate</em> key is a number generated just to identify the row, like <code>students.id</code>. Most teams prefer surrogate keys for main tables, because real-world values change: people change email addresses, and a key that changes must be updated everywhere it is referenced. Keep the natural value too, protected with <code>UNIQUE</code>.</p>
<h2>Foreign key: links that cannot break</h2>
<p>A <strong>foreign key</strong> says that a column's values must exist in another table's key. It protects <em>referential integrity</em>: no enrolment can point to a student who does not exist.</p>
<pre><code class="language-sql">FOREIGN KEY (student_id) REFERENCES students (id)</code></pre>
<p>With that in place, two kinds of change are refused:</p>
<pre><code class="language-sql">INSERT INTO enrolments (student_id, course_id) VALUES (99, 1);
-- fails: there is no student 99

DELETE FROM students WHERE id = 1;
-- fails: enrolments still refer to student 1</code></pre>
<p>You can choose what happens when a referenced row is deleted:</p>
<ul>
<li><code>ON DELETE RESTRICT</code> or <code>NO ACTION</code> (the default): refuse the delete.</li>
<li><code>ON DELETE CASCADE</code>: delete the referring rows too. Handy for an order's line items; dangerous for anything you may need later, such as payments.</li>
<li><code>ON DELETE SET NULL</code>: keep the referring row and clear the link. The column must allow NULL.</li>
</ul>
<p>A MySQL detail worth knowing: MySQL 8.0 accepts a <code>REFERENCES</code> clause written inline on a column definition but does not enforce it. Write the separate <code>FOREIGN KEY (...) REFERENCES ...</code> clause, as in the script you ran, and it works in every database.</p>
<h2>UNIQUE, CHECK and NOT NULL</h2>
<pre><code class="language-sql">CREATE TABLE applicants (
  id      INTEGER PRIMARY KEY,
  email   VARCHAR(254) NOT NULL UNIQUE,
  name    VARCHAR(100) NOT NULL,
  cutoff  DECIMAL(5,2) CHECK (cutoff BETWEEN 0 AND 200),
  quota   VARCHAR(10)  NOT NULL CHECK (quota IN ('GENERAL', 'MANAGEMENT'))
);</code></pre>
<ul>
<li><strong>UNIQUE</strong> forbids duplicates but, unlike a primary key, allows NULLs (in both MySQL and PostgreSQL, several rows may have NULL), and a table can have many unique constraints.</li>
<li><strong>CHECK</strong> enforces a condition on each row. MySQL enforces CHECK only from version 8.0.16; older versions parsed it and silently ignored it. A NULL value passes a CHECK, because the condition is unknown rather than false, so pair CHECK with NOT NULL when the value is required.</li>
<li><strong>NOT NULL</strong> forbids missing values, as you saw in the previous lesson.</li>
</ul>
<p>Give constraints names in real projects, such as <code>CONSTRAINT fk_enrolment_student FOREIGN KEY ...</code>. The name appears in error messages, which makes failures far easier to trace.</p>
<h2>Interview corner: primary key versus unique key</h2>
<table>
<thead><tr><th></th><th>Primary key</th><th>Unique key</th></tr></thead>
<tbody>
<tr><td>How many per table</td><td>At most one</td><td>As many as you need</td></tr>
<tr><td>NULL allowed</td><td>No</td><td>Yes</td></tr>
<tr><td>Purpose</td><td>The row's identity, the target of foreign keys</td><td>Prevents duplicates in other columns</td></tr>
</tbody>
</table>
<h2>Common mistakes</h2>
<ul>
<li>Skipping foreign keys "because the application checks". Sooner or later a script bypasses the application, and orphan rows appear.</li>
<li>Using <code>ON DELETE CASCADE</code> everywhere, so one careless delete wipes out a student's whole payment history.</li>
<li>Believing a primary key keeps rows in order. It guarantees uniqueness, not the order in which rows come back; only <code>ORDER BY</code> does that.</li>
</ul>`,
          resources: [
            {
              title: 'PostgreSQL: Constraints',
              url: 'https://www.postgresql.org/docs/current/ddl-constraints.html',
            },
            {
              title: 'MySQL: FOREIGN KEY Constraints',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html',
            },
          ],
        },
        { kind: 'practice', question: 'sql-primary-key', topic: 'Keys' },
      ],
    },
    {
      title: 'Queries',
      summary:
        'Read data with SELECT: choose and calculate columns, filter rows with WHERE, sort and page results, and summarise them with aggregates, GROUP BY and HAVING.',
      lessons: [
        {
          kind: 'article',
          title: 'SELECT basics: columns, aliases and calculated values',
          minutes: 14,
          topic: 'Selecting',
          html: `<p>Most of the SQL you write at work will be <code>SELECT</code> statements: reports, screens, exports and checks all start by reading data. This lesson covers the core of every query: which columns you want and how to compute new values from them.</p>
<h2>Choosing columns</h2>
<p>The smallest useful query names a table and asks for everything in it:</p>
<pre><code class="language-sql">SELECT * FROM courses;</code></pre>
<p>The star is handy for a quick look in the client. In application code, list the columns you need instead:</p>
<pre><code class="language-sql">SELECT title, fee
FROM courses;</code></pre>
<p>Naming columns makes the query self-explanatory, sends less data over the network, and keeps your code working when someone adds a column to the table next year.</p>
<h2>Calculated columns and aliases</h2>
<p>A column in the result can be an expression. Suppose the accounts team wants each course fee with 18% GST added:</p>
<pre><code class="language-sql">SELECT title,
       fee,
       fee * 18 / 100       AS gst,
       fee + fee * 18 / 100 AS total_fee
FROM courses;</code></pre>
<table>
<thead><tr><th>title</th><th>fee</th><th>gst</th><th>total_fee</th></tr></thead>
<tbody>
<tr><td>Core Java</td><td>18000</td><td>3240</td><td>21240</td></tr>
<tr><td>SQL and Databases</td><td>9000</td><td>1620</td><td>10620</td></tr>
<tr><td>Web Development</td><td>15000</td><td>2700</td><td>17700</td></tr>
<tr><td>Spring Boot</td><td>22000</td><td>3960</td><td>25960</td></tr>
</tbody>
</table>
<p><code>AS</code> gives the column a name, called an <strong>alias</strong>. Without it the column would be titled with the whole expression. Two dialect notes: MySQL's <code>/</code> always returns a decimal, so it prints <code>3240.0000</code>; PostgreSQL divides one integer by another as whole numbers, so it prints <code>3240</code> (and would print <code>3</code> for <code>7 / 2</code>). You will meet that difference again when you update fees.</p>
<h3>Functions on text</h3>
<p>Databases come with many built-in functions. A few you will use often:</p>
<pre><code class="language-sql">SELECT UPPER(name)                     AS shouting,
       CHAR_LENGTH(name)               AS letters,
       CONCAT(name, ' (', batch, ')') AS label
FROM students;</code></pre>
<p>For Asha this gives <code>ASHA KRISHNAN</code>, <code>13</code> and <code>Asha Krishnan (B1)</code>. The standard way to join text is the <code>||</code> operator, which PostgreSQL supports, but in MySQL <code>||</code> means logical OR unless a special mode is on. <code>CONCAT</code> works in both, so prefer it when your code must run on either. Similarly, use <code>CHAR_LENGTH</code>: MySQL's <code>LENGTH</code> counts bytes, which differs from letters for Tamil or Hindi text.</p>
<h2>Removing duplicates with DISTINCT</h2>
<pre><code class="language-sql">SELECT DISTINCT city
FROM students;</code></pre>
<p>Seven students live in only four cities, so you get four rows: Chennai, Coimbatore, Madurai and Tiruchirappalli. <code>DISTINCT</code> applies to the whole result row, not to the first column: <code>SELECT DISTINCT city, batch</code> returns six rows, because Chennai appears with both B1 and B2, and so does Coimbatore.</p>
<h2>Rows come back in no particular order</h2>
<p>A table is a set of rows, not a list. Without <code>ORDER BY</code> the database may return rows in any order, and that order can change when data grows or an index is added. If the order matters, ask for it; the next lessons show how.</p>
<h2>Common mistakes</h2>
<ul>
<li><strong>A missing comma.</strong> <code>SELECT name city FROM students</code> is valid SQL: it returns the <code>name</code> column under the alias <code>city</code>. No error, just a wrong report.</li>
<li><strong>A trailing comma.</strong> <code>SELECT name, city, FROM students</code> is a syntax error.</li>
<li><strong>Double quotes for text.</strong> <code>"Chennai"</code> happens to work in MySQL, but PostgreSQL reads it as a column name and fails. Single quotes work everywhere.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>Write a query that shows each course title and its fee in thousands, named fee_k.</summary><p><code>SELECT title, fee / 1000 AS fee_k FROM courses;</code> PostgreSQL shows 18, 9, 15 and 22; MySQL shows 18.0000 and so on, because its division returns a decimal.</p></details>`,
          resources: [
            {
              title: 'PostgreSQL tutorial: Querying a Table',
              url: 'https://www.postgresql.org/docs/current/tutorial-select.html',
            },
            {
              title: 'MySQL: SELECT Statement',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/select.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Filtering rows with WHERE: comparisons, AND/OR, IN, BETWEEN and LIKE',
          minutes: 18,
          topic: 'Filtering',
          html: `<p>Real tables hold thousands or millions of rows, and you almost never want all of them. <code>WHERE</code> keeps only the rows for which a condition is true. Writing precise conditions, especially when NULL and OR are involved, is where beginners lose marks in tests and interviews.</p>
<h2>Comparison operators</h2>
<table>
<thead><tr><th>Operator</th><th>Meaning</th><th>Example</th></tr></thead>
<tbody>
<tr><td><code>=</code></td><td>equal</td><td><code>batch = 'B1'</code></td></tr>
<tr><td><code>&lt;&gt;</code> or <code>!=</code></td><td>not equal</td><td><code>city &lt;&gt; 'Chennai'</code></td></tr>
<tr><td><code>&lt;</code>, <code>&gt;</code></td><td>less than, greater than</td><td><code>score &lt; 70</code></td></tr>
<tr><td><code>&lt;=</code>, <code>&gt;=</code></td><td>at most, at least</td><td><code>fee &gt;= 15000</code></td></tr>
</tbody>
</table>
<pre><code class="language-sql">SELECT student_id, course_id, score
FROM enrolments
WHERE score &lt; 70;</code></pre>
<table>
<thead><tr><th>student_id</th><th>course_id</th><th>score</th></tr></thead>
<tbody>
<tr><td>2</td><td>1</td><td>64</td></tr>
<tr><td>3</td><td>2</td><td>55</td></tr>
<tr><td>6</td><td>2</td><td>68</td></tr>
</tbody>
</table>
<p>Notice who is missing: Keerthana's <code>NULL</code> score is neither below 70 nor 70 and above. Comparing NULL gives "unknown", and <code>WHERE</code> drops unknown rows. If you also want missing scores, say so: <code>WHERE score &lt; 70 OR score IS NULL</code>.</p>
<h2>Combining conditions: AND, OR, NOT</h2>
<p><code>AND</code> needs both conditions to be true, <code>OR</code> needs at least one, and <code>NOT</code> flips a condition. The trap is precedence: <strong>AND binds tighter than OR</strong>, just as multiplication binds tighter than addition. Suppose you want B2 students from Chennai or Coimbatore:</p>
<pre><code class="language-sql">-- Wrong: read as  Chennai OR (Coimbatore AND B2)
SELECT name FROM students
WHERE city = 'Chennai' OR city = 'Coimbatore' AND batch = 'B2';

-- Right: brackets say what you mean
SELECT name FROM students
WHERE (city = 'Chennai' OR city = 'Coimbatore') AND batch = 'B2';</code></pre>
<p>The first query returns four names, including Asha and Vignesh from batch B1. The second returns the two you wanted, Divya Sundar and Keerthana Raj. Whenever a condition mixes AND and OR, add brackets, even if you think you know the precedence; the next reader will thank you.</p>
<h2>IN, BETWEEN and LIKE</h2>
<p><code>IN</code> is a short way to write several equality checks joined by OR:</p>
<pre><code class="language-sql">SELECT name, city
FROM students
WHERE city IN ('Coimbatore', 'Madurai');</code></pre>
<p>This returns Rahul Varma, Imran Sheikh and Keerthana Raj. <code>NOT IN</code> does the opposite, with a NULL trap you will meet in the subqueries lesson.</p>
<p><code>BETWEEN</code> tests a range, and it <strong>includes both ends</strong>:</p>
<pre><code class="language-sql">SELECT title, fee
FROM courses
WHERE fee BETWEEN 9000 AND 18000;</code></pre>
<p>Core Java (18000), SQL and Databases (9000) and Web Development (15000) all qualify, because 9000 and 18000 are inside the range. It works for dates too: <code>paid_on BETWEEN '2026-04-01' AND '2027-03-31'</code> covers a financial year.</p>
<p><code>LIKE</code> matches text patterns with two wildcards: <code>%</code> stands for any number of characters (including none) and <code>_</code> for exactly one.</p>
<pre><code class="language-sql">SELECT name FROM students WHERE name LIKE 'V%';     -- starts with V: Vignesh Babu
SELECT name FROM students WHERE name LIKE '%Raj';   -- ends with Raj: Keerthana Raj
SELECT name FROM students WHERE batch LIKE 'B_';    -- B and one more character: all seven</code></pre>
<h3>Upper and lower case</h3>
<p>Here the two databases differ. MySQL's default settings compare text without regard to case, so <code>city = 'chennai'</code> finds the Chennai rows. PostgreSQL compares exactly, so it finds nothing; there you write <code>LOWER(city) = 'chennai'</code>, or use PostgreSQL's <code>ILIKE</code> for a case-insensitive pattern. Code that must run on both should not rely on MySQL's leniency.</p>
<h2>Common mistakes</h2>
<ul>
<li><code>WHERE city = Chennai</code> without quotes: the database looks for a column called Chennai.</li>
<li><code>WHERE score = NULL</code>: never true. Use <code>IS NULL</code>.</li>
<li><code>WHERE name LIKE 'Asha'</code> without a wildcard: that is just an equality test, so it misses "Asha Krishnan".</li>
<li>Mixing AND and OR without brackets.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>Find the courses that cost less than 10000 or more than 20000.</summary><p><code>SELECT title FROM courses WHERE fee &lt; 10000 OR fee &gt; 20000;</code> gives SQL and Databases and Spring Boot. <code>WHERE fee NOT BETWEEN 10000 AND 20000</code> gives the same answer.</p></details>`,
          resources: [
            {
              title: 'PostgreSQL tutorial: Querying a Table',
              url: 'https://www.postgresql.org/docs/current/tutorial-select.html',
            },
            {
              title: 'MySQL: Working with NULL Values',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/working-with-null.html',
            },
          ],
        },
        { kind: 'practice', question: 'sql-students-in-chennai', topic: 'Filtering' },
        {
          kind: 'article',
          title: 'Sorting and paging results with ORDER BY and LIMIT',
          minutes: 14,
          topic: 'Sorting',
          html: `<p>Every list a user sees is sorted somehow: newest orders first, students alphabetically, highest scores at the top. Because a database promises no row order unless you ask, <code>ORDER BY</code> belongs in almost every query that feeds a screen or a report.</p>
<h2>ORDER BY: one or more columns</h2>
<pre><code class="language-sql">SELECT title, fee
FROM courses
ORDER BY fee DESC;</code></pre>
<p>That lists Spring Boot (22000), Core Java (18000), Web Development (15000) and SQL and Databases (9000). <code>ASC</code> (ascending) is the default; <code>DESC</code> reverses it. When you sort by several columns, the second one only breaks ties in the first:</p>
<pre><code class="language-sql">SELECT city, name
FROM students
ORDER BY city, name;</code></pre>
<table>
<thead><tr><th>city</th><th>name</th></tr></thead>
<tbody>
<tr><td>Chennai</td><td>Asha Krishnan</td></tr>
<tr><td>Chennai</td><td>Divya Sundar</td></tr>
<tr><td>Chennai</td><td>Vignesh Babu</td></tr>
<tr><td>Coimbatore</td><td>Keerthana Raj</td></tr>
<tr><td>Coimbatore</td><td>Rahul Varma</td></tr>
<tr><td>Madurai</td><td>Imran Sheikh</td></tr>
<tr><td>Tiruchirappalli</td><td>Nandhini Ravi</td></tr>
</tbody>
</table>
<p>Each column takes its own direction: <code>ORDER BY city ASC, name DESC</code> is perfectly valid. You can also sort by an alias or an expression, such as <code>ORDER BY total_fee DESC</code> from the GST query.</p>
<h2>Where do NULLs go?</h2>
<p>The two databases disagree, which surprises people in production:</p>
<ul>
<li><strong>PostgreSQL</strong> treats NULL as larger than every value: NULLs come last in ascending order and first in descending order. You can override that with <code>ORDER BY score NULLS FIRST</code> or <code>NULLS LAST</code>.</li>
<li><strong>MySQL</strong> treats NULL as smaller than every value: NULLs come first in ascending order. It has no <code>NULLS LAST</code> syntax.</li>
</ul>
<p>A trick that works on both is to sort by "is it missing?" first: <code>ORDER BY score IS NULL, score</code>. The expression is false (0) for real scores and true (1) for missing ones, so missing scores go to the end.</p>
<h2>LIMIT and OFFSET: the top few, and paging</h2>
<p>To get the two most expensive courses, sort and then cut the list:</p>
<pre><code class="language-sql">SELECT title, fee
FROM courses
ORDER BY fee DESC
LIMIT 2;</code></pre>
<p>Spring Boot and Core Java. Screens that show results page by page combine <code>LIMIT</code> with <code>OFFSET</code>, the number of rows to skip. With ten rows per page, page 3 is:</p>
<pre><code class="language-sql">SELECT id, name
FROM students
ORDER BY name, id
LIMIT 10 OFFSET 20;</code></pre>
<p><code>LIMIT ... OFFSET ...</code> works in MySQL and PostgreSQL. The SQL standard spells it <code>OFFSET 20 ROWS FETCH FIRST 10 ROWS ONLY</code>, which PostgreSQL, Oracle and SQL Server accept but MySQL does not. MySQL also has a short form, <code>LIMIT 20, 10</code>, where the offset comes first; it confuses everyone, so avoid it.</p>
<h3>Two rules for paging that interviewers like</h3>
<ul>
<li><strong>Always sort before you limit.</strong> <code>LIMIT 10</code> without <code>ORDER BY</code> returns some ten rows, and page 2 may repeat rows from page 1.</li>
<li><strong>Make the order unique.</strong> If two students share a name, sorting by name alone lets them swap places between page loads. Adding the key, as in <code>ORDER BY name, id</code>, fixes it.</li>
</ul>
<h2>The order in which a query is evaluated</h2>
<p>You write <code>SELECT</code> first, but the database logically works in this order:</p>
<pre><code class="language-text">FROM  →  WHERE  →  SELECT  →  ORDER BY  →  LIMIT</code></pre>
<p>That explains two rules you would otherwise have to memorise. <code>ORDER BY</code> can use an alias defined in <code>SELECT</code>, because it runs afterwards. <code>WHERE</code> cannot use that alias, because when it runs the alias does not exist yet: <code>WHERE total_fee &gt; 20000</code> fails, and you repeat the expression instead.</p>
<h2>Common mistakes</h2>
<ul>
<li>Using <code>LIMIT 1</code> to find "the" highest fee. If two courses tie, one is silently dropped.</li>
<li>Assuming rows come back in insertion order because they did on your laptop.</li>
<li>Sorting numbers stored as text: <code>'9000'</code> sorts after <code>'18000'</code> because <code>9</code> comes after <code>1</code>.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>Write a query that shows the three lowest recorded scores, lowest first.</summary><p><code>SELECT student_id, course_id, score FROM enrolments WHERE score IS NOT NULL ORDER BY score LIMIT 3;</code> gives 55, 64 and 68. Without the IS NOT NULL filter, MySQL would put Keerthana's NULL first.</p></details>`,
          resources: [
            {
              title: 'PostgreSQL: LIMIT and OFFSET',
              url: 'https://www.postgresql.org/docs/current/queries-limit.html',
            },
            {
              title: 'MySQL: SELECT Statement',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/select.html',
            },
          ],
        },
        { kind: 'practice', question: 'sql-courses-above-fee', topic: 'Sorting' },
        {
          kind: 'article',
          title: 'Aggregate functions: COUNT, SUM, AVG, MIN and MAX',
          minutes: 14,
          topic: 'Aggregates',
          html: `<p>Managers rarely want rows; they want numbers. How many students enrolled? What is the average score? How much fee did we collect? <strong>Aggregate functions</strong> turn many rows into one value, and they are the first step towards real reports.</p>
<h2>The five you will use every day</h2>
<pre><code class="language-sql">SELECT COUNT(*)     AS enrolments,
       COUNT(score) AS scored,
       SUM(score)   AS total,
       AVG(score)   AS average,
       MIN(score)   AS lowest,
       MAX(score)   AS highest
FROM enrolments;</code></pre>
<table>
<thead><tr><th>enrolments</th><th>scored</th><th>total</th><th>average</th><th>lowest</th><th>highest</th></tr></thead>
<tbody><tr><td>11</td><td>10</td><td>767</td><td>76.7</td><td>55</td><td>92</td></tr></tbody>
</table>
<p>Look closely at the first two columns. There are 11 enrolment rows, but only 10 scores, because Keerthana's is missing. That leads to the most important rule of this lesson.</p>
<h2>Aggregates ignore NULL (except COUNT(*))</h2>
<ul>
<li><code>COUNT(*)</code> counts rows, whatever they contain.</li>
<li><code>COUNT(score)</code> counts rows where <code>score</code> is not NULL.</li>
<li><code>SUM</code>, <code>AVG</code>, <code>MIN</code> and <code>MAX</code> skip NULLs entirely.</li>
</ul>
<p>So the average above is 767 / 10 = 76.7: the missing score is left out, not treated as zero. Usually that is exactly right, because "not yet examined" is not "scored nothing". If a rule really does say a missing score counts as zero, make it explicit with <code>COALESCE</code>, which returns its first non-NULL argument:</p>
<pre><code class="language-sql">SELECT AVG(COALESCE(score, 0)) AS average_with_zeros
FROM enrolments;   -- 767 / 11, about 69.7</code></pre>
<p>A difference of seven marks from one NULL. Get this wrong in a results report and real students are affected.</p>
<h3>Counting distinct values</h3>
<p><code>COUNT(DISTINCT student_id)</code> counts different values rather than rows. Eleven enrolments come from six different students (Nandhini has none), so it returns 6. Interviewers often ask you to explain the difference between <code>COUNT(*)</code>, <code>COUNT(column)</code> and <code>COUNT(DISTINCT column)</code>; you now can.</p>
<h2>Aggregates with WHERE</h2>
<p><code>WHERE</code> runs first, so the aggregate sees only the rows that pass:</p>
<pre><code class="language-sql">SELECT COUNT(*) AS b1_students
FROM students
WHERE batch = 'B1';   -- 4</code></pre>
<p>And on the courses table: <code>SELECT SUM(fee), AVG(fee), MIN(fee), MAX(fee) FROM courses;</code> returns 64000, 16000, 9000 and 22000. <code>MIN</code> and <code>MAX</code> also work on text (alphabetical order) and dates (earliest and latest).</p>
<h3>Rounding the average</h3>
<p>AVG often produces long decimals. MySQL prints <code>76.7000</code> and PostgreSQL prints even more digits. Use <code>ROUND(AVG(score), 1)</code> to show one decimal place in both.</p>
<h2>The rule that trips everyone: plain columns and aggregates</h2>
<p>Suppose you want the most expensive course and try this:</p>
<pre><code class="language-sql">SELECT title, MAX(fee) FROM courses;   -- error</code></pre>
<p><code>MAX(fee)</code> collapses four rows into one, but <code>title</code> still has four values. Which title should the database show? It refuses to guess: PostgreSQL rejects the query, and so does MySQL 8 with its default settings. (Very old MySQL versions returned a random title, which is worse than an error.) To find the row that holds the maximum, compare against it with a subquery, which you will study in the Relationships module:</p>
<pre><code class="language-sql">SELECT title, fee
FROM courses
WHERE fee = (SELECT MAX(fee) FROM courses);   -- Spring Boot, 22000</code></pre>
<p>To show one result row per course, per batch or per city, you need <code>GROUP BY</code>, the subject of the next lesson.</p>
<h2>Common mistakes</h2>
<ul>
<li>Using <code>COUNT(column)</code> when you meant to count rows, and getting a smaller number because of NULLs.</li>
<li>Replacing NULL with zero by habit and dragging averages down.</li>
<li>Mixing a plain column with an aggregate without <code>GROUP BY</code>.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>How many enrolments in course 4 have a recorded score?</summary><p><code>SELECT COUNT(score) FROM enrolments WHERE course_id = 4;</code> returns 1. Course 4 has two enrolments, but one score is NULL. <code>COUNT(*)</code> would return 2.</p></details>`,
          resources: [
            {
              title: 'PostgreSQL tutorial: Aggregate Functions',
              url: 'https://www.postgresql.org/docs/current/tutorial-agg.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'GROUP BY and HAVING: one result row per group',
          minutes: 18,
          topic: 'Aggregates',
          html: `<p>An aggregate over the whole table gives one number. Most reports need one number <em>per something</em>: students per batch, revenue per course, orders per customer. <code>GROUP BY</code> splits the rows into groups and runs the aggregates once for each group. <code>HAVING</code> then filters the groups.</p>
<h2>GROUP BY: rows into buckets</h2>
<pre><code class="language-sql">SELECT batch, COUNT(*) AS students
FROM students
GROUP BY batch;</code></pre>
<table>
<thead><tr><th>batch</th><th>students</th></tr></thead>
<tbody>
<tr><td>B1</td><td>4</td></tr>
<tr><td>B2</td><td>3</td></tr>
</tbody>
</table>
<p>Picture the database sorting the seven student rows into two buckets labelled B1 and B2, then counting each bucket. Every bucket becomes exactly one result row.</p>
<p>Several aggregates can share the same grouping. Here are enrolments and the best score in each course:</p>
<pre><code class="language-sql">SELECT course_id,
       COUNT(*)   AS enrolled,
       MAX(score) AS best
FROM enrolments
GROUP BY course_id
ORDER BY course_id;</code></pre>
<table>
<thead><tr><th>course_id</th><th>enrolled</th><th>best</th></tr></thead>
<tbody>
<tr><td>1</td><td>4</td><td>91</td></tr>
<tr><td>2</td><td>3</td><td>92</td></tr>
<tr><td>3</td><td>2</td><td>80</td></tr>
<tr><td>4</td><td>2</td><td>85</td></tr>
</tbody>
</table>
<p>You can group by more than one column. <code>GROUP BY city, batch</code> makes one group for each combination that occurs, such as Chennai with B1 and Chennai with B2.</p>
<h3>The grouping rule</h3>
<p>Every column in the <code>SELECT</code> list must either appear in <code>GROUP BY</code> or sit inside an aggregate. <code>SELECT course_id, student_id, COUNT(*) FROM enrolments GROUP BY course_id</code> fails, because each course group contains several student ids and the database cannot show them all on one row. MySQL enforces this rule with its <code>ONLY_FULL_GROUP_BY</code> mode, which is on by default in MySQL 8; PostgreSQL always enforces it. Both allow one exception: if you group by a table's primary key, you may select the other columns of that table, because the key decides them.</p>
<h2>HAVING: filtering groups</h2>
<p>Which courses have at least three enrolments? The count exists only after grouping, so the condition goes in <code>HAVING</code>:</p>
<pre><code class="language-sql">SELECT course_id, COUNT(*) AS enrolled
FROM enrolments
GROUP BY course_id
HAVING COUNT(*) &gt;= 3;</code></pre>
<p>Courses 1 and 2 qualify, with 4 and 3 enrolments.</p>
<h3>WHERE and HAVING together</h3>
<p>The two clauses work at different moments:</p>
<ul>
<li><code>WHERE</code> filters <strong>rows</strong> before they are grouped. It cannot use aggregates.</li>
<li><code>HAVING</code> filters <strong>groups</strong> after aggregation. It is meant for conditions on aggregates.</li>
</ul>
<p>Combine them to answer: which courses have at least two students who scored 70 or more?</p>
<pre><code class="language-sql">SELECT course_id, COUNT(*) AS strong_students
FROM enrolments
WHERE score &gt;= 70
GROUP BY course_id
HAVING COUNT(*) &gt;= 2;</code></pre>
<table>
<thead><tr><th>course_id</th><th>strong_students</th></tr></thead>
<tbody>
<tr><td>1</td><td>3</td></tr>
<tr><td>3</td><td>2</td></tr>
</tbody>
</table>
<p>Walk through it: <code>WHERE</code> throws away the scores 64, 55 and 68, and the NULL; grouping then counts what is left per course; <code>HAVING</code> keeps the groups with at least two. A condition on a plain column, such as <code>score &gt;= 70</code>, belongs in <code>WHERE</code>: filtering early means less data to group.</p>
<h2>The full evaluation order</h2>
<pre><code class="language-text">FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT</code></pre>
<p>Learn this line; it answers half of all "why does this query fail?" questions. One dialect note: MySQL lets <code>HAVING</code> refer to a <code>SELECT</code> alias (<code>HAVING enrolled &gt;= 3</code>), but PostgreSQL does not. Repeating the aggregate, as above, works in both.</p>
<h2>Common mistakes</h2>
<ul>
<li>Putting an aggregate in <code>WHERE</code>: <code>WHERE COUNT(*) &gt;= 3</code> is an error.</li>
<li>Selecting a column that is neither grouped nor aggregated.</li>
<li>Expecting grouped results to come back sorted. Add <code>ORDER BY</code>.</li>
</ul>
<h2>Interview corner</h2>
<details><summary>Can you use HAVING without GROUP BY?</summary><p>Yes. The whole table then forms a single group. <code>SELECT COUNT(*) FROM enrolments HAVING COUNT(*) &gt; 10</code> returns one row (11) if the condition holds and no rows otherwise. It is rare in practice, but it shows you understand that HAVING filters groups.</p></details>`,
          resources: [
            {
              title: 'PostgreSQL tutorial: Aggregate Functions',
              url: 'https://www.postgresql.org/docs/current/tutorial-agg.html',
            },
            {
              title: 'MySQL: Handling of GROUP BY',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/group-by-handling.html',
            },
          ],
        },
        { kind: 'practice', question: 'sql-students-per-city', topic: 'Aggregates' },
        { kind: 'practice', question: 'sql-where-vs-having', topic: 'Aggregates' },
      ],
    },
    {
      title: 'Relationships',
      summary:
        'Model one-to-many and many-to-many relationships, combine tables with inner, outer and self joins, and answer harder questions with subqueries, EXISTS and UNION.',
      lessons: [
        {
          kind: 'article',
          title: 'One-to-many and many-to-many: how tables relate',
          minutes: 12,
          topic: 'Relationships',
          html: `<p>Nothing in a real system stands alone. A customer places orders, an order contains products, a student joins courses. Before you can join tables you need to see how they relate, because the kind of relationship decides where the foreign key goes. Get this right and your queries become simple; get it wrong and no query will save you.</p>
<h2>The three kinds of relationship</h2>
<table>
<thead><tr><th>Kind</th><th>Example</th><th>How it is stored</th></tr></thead>
<tbody>
<tr><td>One-to-one</td><td>A student and their hostel allotment</td><td>The second table's key is also a foreign key to the first, or a foreign key with UNIQUE</td></tr>
<tr><td>One-to-many</td><td>A customer and their orders</td><td>A foreign key on the "many" side: <code>orders.customer_id</code></td></tr>
<tr><td>Many-to-many</td><td>Students and courses</td><td>A third table holding pairs of keys: <code>enrolments</code></td></tr>
</tbody>
</table>
<h2>One-to-many: the foreign key goes on the many side</h2>
<p>One customer has many orders; each order belongs to exactly one customer. Ask yourself: "One X has many Y?" If yes, Y gets a column pointing to X.</p>
<pre><code class="language-sql">CREATE TABLE customers (
  id   INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  city VARCHAR(60)  NOT NULL
);

CREATE TABLE orders (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  ordered_on  DATE    NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers (id)
);</code></pre>
<p>Why not the other way round, with a column in <code>customers</code> listing order ids? Because a column holds one value per row. A customer with fifty orders would need fifty columns, or one text cell such as <code>'101,102,117'</code>, which you cannot join, index or protect with a foreign key.</p>
<h2>Many-to-many: a table in the middle</h2>
<p>A student joins many courses and a course has many students. Neither side can hold a single foreign key, so a third table, called a <strong>junction</strong>, <strong>bridge</strong> or <strong>associative</strong> table, stores one row per pairing. That is exactly what <code>enrolments</code> is:</p>
<pre><code class="language-text">students                enrolments                 courses
--------                ----------                 -------
id   ───────────&lt;      student_id
                        course_id      &gt;────────   id
                        score</code></pre>
<p>Read the arrows as "one student has many enrolment rows" and "one course has many enrolment rows". Two one-to-many relationships together make the many-to-many. Notice the bonus: the junction table is the natural home for facts about the pairing itself, such as the score, the enrolment date or the fee discount. Those facts belong neither to the student alone nor to the course alone.</p>
<p>The e-commerce version is the same shape. Orders and products are many-to-many, linked by <code>order_items(order_id, product_id, quantity, unit_price)</code>. The quantity describes one product within one order, so it lives in the junction table.</p>
<h2>Reading relationships from data</h2>
<p>In our institute data, Vignesh (student 6) has three enrolment rows, so he takes three courses. Core Java (course 1) appears in four rows, so it has four students. Nandhini (student 7) appears in no row at all. Keep her in mind: she is the reason outer joins exist.</p>
<h2>One-to-one, briefly</h2>
<p>One-to-one relationships are less common. You use them to split rarely used or sensitive columns into their own table, for example a student's bank details for scholarship payments, which only the accounts team may read. The second table uses the student's id as its own primary key, so there can be at most one row per student.</p>
<h2>Common mistakes</h2>
<ul>
<li>Storing lists in a cell: <code>courses = 'Java, SQL'</code>. Use a junction table.</li>
<li>Putting the foreign key on the "one" side.</li>
<li>Creating a many-to-many junction table without a key on the pair, so the same student can be enrolled twice in the same course.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>A college library has books, members and loans. A member borrows many books over time, and a book is borrowed by many members. Which table holds which foreign keys?</summary><p><code>loans</code> is the junction table. It holds <code>book_id</code> and <code>member_id</code>, plus facts about the loan itself: the issue date, the due date and the return date. Because the same member may borrow the same book again next term, its key should be its own <code>id</code>, not the pair.</p></details>`,
          resources: [
            {
              title: 'PostgreSQL tutorial: Foreign Keys',
              url: 'https://www.postgresql.org/docs/current/tutorial-fk.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'INNER JOIN: combining rows that match',
          minutes: 18,
          topic: 'Joins',
          html: `<p>The <code>enrolments</code> table is full of numbers: student 6, course 2, score 68. A report needs "Vignesh Babu, SQL and Databases, 68". A <strong>join</strong> combines rows from two or more tables by matching keys, and <code>INNER JOIN</code> is the one you will write most.</p>
<h2>Your first join</h2>
<pre><code class="language-sql">SELECT s.name, e.course_id, e.score
FROM students AS s
JOIN enrolments AS e ON e.student_id = s.id;</code></pre>
<p>Read it as: "for every pair of a student row and an enrolment row where the enrolment's <code>student_id</code> equals the student's <code>id</code>, output one combined row." <code>JOIN</code> on its own means <code>INNER JOIN</code>; the two are identical.</p>
<p>The result has 11 rows, one per enrolment. Asha appears twice because she has two enrolments. Nandhini does not appear at all, because no enrolment matches her. That is the defining property of an inner join: <strong>rows without a match are dropped</strong>.</p>
<h3>Aliases and qualified columns</h3>
<p><code>students AS s</code> gives the table a short alias, and <code>s.name</code> says which table a column comes from. Qualifying is optional when a column name is unique across the tables, but required when it is not: both <code>students</code> and <code>courses</code> have an <code>id</code>, and an unqualified <code>id</code> causes an "ambiguous column" error. Qualify every column in a join; it costs nothing and makes the query readable.</p>
<h2>Joining three tables</h2>
<p>Each extra table needs its own <code>JOIN ... ON</code>. Who is enrolled in SQL and Databases, best score first?</p>
<pre><code class="language-sql">SELECT s.name, e.score
FROM enrolments AS e
JOIN students AS s ON s.id = e.student_id
JOIN courses  AS c ON c.id = e.course_id
WHERE c.title = 'SQL and Databases'
ORDER BY e.score DESC;</code></pre>
<table>
<thead><tr><th>name</th><th>score</th></tr></thead>
<tbody>
<tr><td>Asha Krishnan</td><td>92</td></tr>
<tr><td>Vignesh Babu</td><td>68</td></tr>
<tr><td>Divya Sundar</td><td>55</td></tr>
</tbody>
</table>
<p>Starting from the junction table and joining outwards is a good habit for many-to-many data.</p>
<h2>Joins with GROUP BY</h2>
<p>Joins and aggregates combine naturally. How much fee has each course collected, assuming every enrolled student paid in full?</p>
<pre><code class="language-sql">SELECT c.title,
       COUNT(*)   AS students,
       SUM(c.fee) AS collected
FROM courses AS c
JOIN enrolments AS e ON e.course_id = c.id
GROUP BY c.id, c.title
ORDER BY collected DESC;</code></pre>
<table>
<thead><tr><th>title</th><th>students</th><th>collected</th></tr></thead>
<tbody>
<tr><td>Core Java</td><td>4</td><td>72000</td></tr>
<tr><td>Spring Boot</td><td>2</td><td>44000</td></tr>
<tr><td>Web Development</td><td>2</td><td>30000</td></tr>
<tr><td>SQL and Databases</td><td>3</td><td>27000</td></tr>
</tbody>
</table>
<p>Grouping by <code>c.id</code> as well as <code>c.title</code> is deliberate: two courses could share a title, but never an id.</p>
<h2>What goes wrong: the accidental Cartesian product</h2>
<p>Older code joins tables with commas and puts the matching condition in <code>WHERE</code>:</p>
<pre><code class="language-sql">SELECT s.name, e.score
FROM students s, enrolments e
WHERE e.student_id = s.id;</code></pre>
<p>It works, but forget the condition and every student is paired with every enrolment: 7 × 11 = 77 rows of nonsense. That pairing of everything with everything is called a <strong>Cartesian product</strong>, or a <code>CROSS JOIN</code> when you ask for it on purpose (for example, to list every student against every course for a timetable). The explicit <code>JOIN ... ON</code> style keeps the join condition next to the table it belongs to, so a missing condition is easy to spot.</p>
<h2>Common mistakes</h2>
<ul>
<li>Matching the wrong columns, such as <code>ON e.student_id = c.id</code>. The query runs and returns rubbish, so always read your ON clauses aloud.</li>
<li>Expecting students with no enrolments to appear. An inner join drops them; the next lesson fixes that.</li>
<li>Counting after a join without thinking about duplication: joining a table with three matches per row triples any sums over the first table.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>Write a query that lists each student's name with the titles of their courses, sorted by name and then title.</summary><p><code>SELECT s.name, c.title FROM students s JOIN enrolments e ON e.student_id = s.id JOIN courses c ON c.id = e.course_id ORDER BY s.name, c.title;</code> It returns 11 rows, and Nandhini is not among them.</p></details>`,
          resources: [
            {
              title: 'PostgreSQL tutorial: Joins Between Tables',
              url: 'https://www.postgresql.org/docs/current/tutorial-join.html',
            },
            {
              title: 'MySQL: JOIN Clause',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/join.html',
            },
          ],
        },
        { kind: 'practice', question: 'sql-average-score-per-course', topic: 'Joins' },
        {
          kind: 'article',
          title: 'Outer joins, self joins and UNION: keeping rows with no match',
          minutes: 20,
          topic: 'Joins',
          html: `<p>An inner join answers "who has enrolments?". Many real questions are about what is <em>missing</em>: students who have not joined any course, products never ordered, customers with no orders this year. For those you need outer joins. This lesson also covers joining a table to itself and stacking results with <code>UNION</code>.</p>
<h2>LEFT JOIN: keep everything on the left</h2>
<p>A <code>LEFT JOIN</code> returns every row of the left table. Where a right-side row matches, it is attached as usual; where nothing matches, the right side's columns are filled with <code>NULL</code>.</p>
<pre><code class="language-sql">SELECT s.name, COUNT(e.course_id) AS courses
FROM students AS s
LEFT JOIN enrolments AS e ON e.student_id = s.id
GROUP BY s.id, s.name
ORDER BY courses DESC, s.name;</code></pre>
<table>
<thead><tr><th>name</th><th>courses</th></tr></thead>
<tbody>
<tr><td>Vignesh Babu</td><td>3</td></tr>
<tr><td>Asha Krishnan</td><td>2</td></tr>
<tr><td>Divya Sundar</td><td>2</td></tr>
<tr><td>Rahul Varma</td><td>2</td></tr>
<tr><td>Imran Sheikh</td><td>1</td></tr>
<tr><td>Keerthana Raj</td><td>1</td></tr>
<tr><td>Nandhini Ravi</td><td>0</td></tr>
</tbody>
</table>
<p>Nandhini is back, with 0 courses. Before grouping, her joined row was <code>Nandhini Ravi | NULL | NULL</code>. Now the classic mistake: had you written <code>COUNT(*)</code>, she would show 1, because <code>COUNT(*)</code> counts that row even though it has no enrolment. After a left join, count a column from the right-hand table.</p>
<h3>Finding rows with no match: the anti-join</h3>
<p>Filter a left join for <code>NULL</code> on the right side and you get exactly the rows that have no partner. Suppose the institute adds a Python course:</p>
<pre><code class="language-sql">INSERT INTO courses (id, title, fee) VALUES (5, 'Python', 12000);

SELECT c.title
FROM courses AS c
LEFT JOIN enrolments AS e ON e.course_id = c.id
WHERE e.course_id IS NULL;</code></pre>
<p>The only result is Python: no enrolment matches it. Test the right side's key column (or any column declared NOT NULL), so that a NULL there can only mean "no match". When you have tried it, remove the course again with <code>DELETE FROM courses WHERE id = 5;</code> so that your results in the next lessons match the ones shown.</p>
<h2>The ON-or-WHERE trap</h2>
<p>You want <em>every</em> student, with their Core Java score where they have one. This looks right but is not:</p>
<pre><code class="language-sql">SELECT s.name, e.score
FROM students s
LEFT JOIN enrolments e ON e.student_id = s.id
WHERE e.course_id = 1;          -- only 4 rows!</code></pre>
<p>The <code>WHERE</code> runs after the join and throws away the rows where <code>e.course_id</code> is NULL, which quietly turns your left join back into an inner join. Put conditions on the right-hand table into the <code>ON</code> clause instead:</p>
<pre><code class="language-sql">SELECT s.name, e.score
FROM students s
LEFT JOIN enrolments e ON e.student_id = s.id AND e.course_id = 1
ORDER BY s.id;</code></pre>
<p>Now all seven students appear: Asha 88, Rahul 64, Divya NULL, Imran 91, Keerthana NULL, Vignesh 73 and Nandhini NULL. Interviewers love this one.</p>
<h2>RIGHT and FULL OUTER JOIN</h2>
<p><code>RIGHT JOIN</code> keeps every row of the right-hand table. It is a left join with the tables swapped, so most teams write left joins only and keep queries easy to read. <code>FULL OUTER JOIN</code> keeps unmatched rows from both sides. PostgreSQL supports it; MySQL does not, and there you combine a left join and a right join with <code>UNION</code>.</p>
<h2>UNION and UNION ALL</h2>
<p><code>UNION</code> stacks the results of two queries. Who is from Madurai, or scored above 90 anywhere?</p>
<pre><code class="language-sql">SELECT name FROM students WHERE city = 'Madurai'
UNION
SELECT s.name
FROM students s
JOIN enrolments e ON e.student_id = s.id
WHERE e.score &gt; 90;</code></pre>
<p>Imran is in both halves (Madurai, and 91 in Core Java), but <code>UNION</code> removes duplicates, so you get two rows: Imran Sheikh and Asha Krishnan. <code>UNION ALL</code> keeps duplicates and returns three rows; it is faster because it skips the duplicate check, so use it when you know duplicates cannot occur or want to keep them. Both halves must return the same number of columns with compatible types.</p>
<h2>Self joins: a table joined to itself</h2>
<p>Which students live in the same city, so they could share a cab to class?</p>
<pre><code class="language-sql">SELECT a.name AS student, b.name AS cab_partner, a.city
FROM students a
JOIN students b ON b.city = a.city AND a.id &lt; b.id;</code></pre>
<p>Two aliases let you treat one table as two. The condition <code>a.id &lt; b.id</code> stops a student pairing with themselves and stops each pair appearing twice. You get four pairs: three in Chennai (Asha with Divya, Asha with Vignesh, Divya with Vignesh) and one in Coimbatore (Rahul with Keerthana). The famous interview version is an <code>employees</code> table with a <code>manager_id</code> column: <code>JOIN employees m ON m.id = e.manager_id</code> lists each employee with their manager's name.</p>
<h2>Common mistakes</h2>
<ul>
<li><code>COUNT(*)</code> after a left join, so unmatched rows count as 1.</li>
<li>Filtering the right-hand table in <code>WHERE</code> and losing the unmatched rows.</li>
<li>Using <code>UNION</code> where <code>UNION ALL</code> is meant, and silently merging two genuinely different rows that happen to look alike.</li>
</ul>`,
          resources: [
            {
              title: 'PostgreSQL tutorial: Joins Between Tables',
              url: 'https://www.postgresql.org/docs/current/tutorial-join.html',
            },
            {
              title: 'MySQL: JOIN Clause',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/join.html',
            },
          ],
        },
        { kind: 'practice', question: 'sql-left-join', topic: 'Joins' },
        { kind: 'practice', question: 'sql-not-enrolled', topic: 'Joins' },
        {
          kind: 'article',
          title: 'Subqueries: IN, EXISTS, scalar and correlated',
          minutes: 20,
          topic: 'Subqueries',
          html: `<p>Some questions need an answer before they can be asked. "Which courses cost more than the average?" first needs the average. A <strong>subquery</strong> is a query inside another query that supplies that intermediate answer. Subqueries also give the cleanest solutions to several interview favourites, such as the second highest salary and the top scorer per group.</p>
<h2>Scalar subqueries: one value</h2>
<p>A subquery that returns exactly one row and one column can stand wherever a single value can:</p>
<pre><code class="language-sql">SELECT title, fee
FROM courses
WHERE fee &gt; (SELECT AVG(fee) FROM courses);</code></pre>
<p>The inner query computes 16000; the outer query keeps Core Java (18000) and Spring Boot (22000). The database runs the inner query once and uses its answer like a constant.</p>
<h2>IN: a list of values</h2>
<p>When the subquery returns a column of several values, test membership with <code>IN</code>. Who is enrolled in Spring Boot (course 4)?</p>
<pre><code class="language-sql">SELECT name
FROM students
WHERE id IN (SELECT student_id FROM enrolments WHERE course_id = 4);</code></pre>
<p>Keerthana Raj and Vignesh Babu. Writing <code>=</code> instead of <code>IN</code> here is an error, because the subquery returns two rows and <code>=</code> needs exactly one.</p>
<h3>The NOT IN trap</h3>
<p><code>NOT IN</code> looks like the obvious way to find what is missing, but if the subquery returns even one <code>NULL</code>, the whole condition becomes unknown and the query returns <strong>no rows</strong>. The reason is that <code>x NOT IN (1, NULL)</code> means <code>x &lt;&gt; 1 AND x &lt;&gt; NULL</code>, and the second part is never true. Make sure the column cannot be NULL, or use <code>NOT EXISTS</code>, which does not have this problem.</p>
<h2>EXISTS: is there at least one?</h2>
<p><code>EXISTS</code> is true when its subquery returns any row at all. It is the natural way to ask "has at least one ...":</p>
<pre><code class="language-sql">SELECT s.name
FROM students s
WHERE EXISTS (
  SELECT 1
  FROM enrolments e
  WHERE e.student_id = s.id
    AND e.score &gt; 90
);</code></pre>
<p>Asha Krishnan (92) and Imran Sheikh (91). What the subquery selects does not matter, only whether it finds a row, so <code>SELECT 1</code> is the convention. <code>NOT EXISTS</code> gives the rows with no such match, and it is a safe alternative to the left-join anti-join from the previous lesson.</p>
<h2>Correlated subqueries: the inner query reads the outer row</h2>
<p>In the <code>EXISTS</code> example, the inner query uses <code>s.id</code> from the outer query. That makes it <strong>correlated</strong>: conceptually it runs once for each outer row. Correlation lets you compare each row with its own group. Which enrolments scored above their own course's average?</p>
<pre><code class="language-sql">SELECT s.name, c.title, e.score
FROM enrolments e
JOIN students s ON s.id = e.student_id
JOIN courses  c ON c.id = e.course_id
WHERE e.score &gt; (
  SELECT AVG(e2.score)
  FROM enrolments e2
  WHERE e2.course_id = e.course_id
)
ORDER BY c.title, e.score DESC;</code></pre>
<table>
<thead><tr><th>name</th><th>title</th><th>score</th></tr></thead>
<tbody>
<tr><td>Imran Sheikh</td><td>Core Java</td><td>91</td></tr>
<tr><td>Asha Krishnan</td><td>Core Java</td><td>88</td></tr>
<tr><td>Asha Krishnan</td><td>SQL and Databases</td><td>92</td></tr>
<tr><td>Divya Sundar</td><td>Web Development</td><td>80</td></tr>
</tbody>
</table>
<p>The averages are 79 for Core Java, about 71.7 for SQL and Databases and 75.5 for Web Development. Spring Boot has one recorded score, 85, so its average is 85 and nobody is strictly above it. The inner alias <code>e2</code> must differ from the outer <code>e</code>, otherwise the condition would compare a row with itself.</p>
<h2>Subqueries in FROM: derived tables</h2>
<p>A subquery in <code>FROM</code> acts as a temporary table. Which students take more than one course?</p>
<pre><code class="language-sql">SELECT t.student_id, t.courses
FROM (
  SELECT student_id, COUNT(*) AS courses
  FROM enrolments
  GROUP BY student_id
) AS t
WHERE t.courses &gt; 1;</code></pre>
<p>Students 1, 2 and 3 with two courses each, and student 6 with three. MySQL requires the alias (<code>AS t</code>) on a derived table, so always give one. (A <code>HAVING COUNT(*) &gt; 1</code> would do the same job here; derived tables earn their place when you need to aggregate an aggregate.) MySQL 8 and PostgreSQL also let you name such a subquery up front with <code>WITH t AS (...) SELECT ...</code>, a common table expression, which many people find easier to read.</p>
<h2>Subquery or join?</h2>
<p>Many questions can be answered either way, and modern optimisers often run both forms with the same plan. Choose the form that reads most like the question: <code>EXISTS</code> for "has at least one", a join when you need columns from both tables in the output, and a scalar subquery when you compare against one computed value.</p>
<h2>Common mistakes</h2>
<ul>
<li>A scalar subquery that returns more than one row: a run-time error, sometimes only once real data grows.</li>
<li><code>NOT IN</code> over a column that can contain NULL.</li>
<li>Reusing the outer alias inside a correlated subquery.</li>
</ul>`,
          resources: [
            {
              title: 'PostgreSQL: Subquery Expressions',
              url: 'https://www.postgresql.org/docs/current/functions-subquery.html',
            },
            {
              title: 'MySQL: Subqueries',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/subqueries.html',
            },
          ],
        },
        { kind: 'practice', question: 'sql-second-highest-fee', topic: 'Subqueries' },
        { kind: 'practice', question: 'sql-top-scorer-per-course', topic: 'Subqueries' },
      ],
    },
    {
      title: 'Changing data',
      summary:
        'Add, change and remove rows with INSERT, UPDATE and DELETE, check every change before you make it, and use upserts, soft deletes and audit columns as production systems do.',
      lessons: [
        {
          kind: 'article',
          title: 'INSERT: adding rows the right way',
          minutes: 14,
          topic: 'Inserting',
          html: `<p>So far you have only read data. Applications also write it: a new admission, a fee payment, an order. <code>INSERT</code> adds rows. It is simple, but a few habits separate code that keeps working from code that breaks the day someone changes a table.</p>
<p>The examples in this module change your practice data. To get back to the original rows at any time, drop the three tables and run the setup script from the Foundations module again.</p>
<h2>Always name the columns</h2>
<pre><code class="language-sql">INSERT INTO students (id, name, city, batch)
VALUES (8, 'Arjun Mehta', 'Salem', 'B2');</code></pre>
<p>The column list says which value goes where. You may leave it out (<code>INSERT INTO students VALUES (...)</code>), but then the values must follow the table's own column order, and the statement breaks, or worse, puts values into the wrong columns, as soon as somebody adds or reorders a column. Name the columns every time.</p>
<h3>Several rows in one statement</h3>
<pre><code class="language-sql">INSERT INTO enrolments (student_id, course_id, score) VALUES
  (8, 1, NULL),
  (8, 2, NULL);</code></pre>
<p>One statement carrying many rows is much faster than many single-row statements, because every statement is a round trip to the server. When you import a few thousand rows, batch them like this.</p>
<h2>Columns you leave out</h2>
<p>A column missing from the list gets its <code>DEFAULT</code>, or <code>NULL</code> if it has no default. If it is <code>NOT NULL</code> and has no default, the insert fails. So you can simply omit an unknown score:</p>
<pre><code class="language-sql">INSERT INTO enrolments (student_id, course_id) VALUES (8, 3);   -- score is NULL</code></pre>
<h2>Generated ids, and getting them back</h2>
<p>When the database generates the id, leave the id column out and ask for the new value. Suppose the <code>payments</code> table from the Foundations module had a generated id:</p>
<pre><code class="language-sql">-- PostgreSQL: RETURNING hands back values from the new row
INSERT INTO payments (student_id, amount, paid_on)
VALUES (8, 4500.00, '2026-10-09')
RETURNING id;

-- MySQL: ask for the last id generated on this connection
INSERT INTO payments (student_id, amount, paid_on)
VALUES (8, 4500.00, '2026-10-09');
SELECT LAST_INSERT_ID();</code></pre>
<p><code>LAST_INSERT_ID()</code> is tracked per connection, so another user inserting at the same moment does not disturb your answer. Never find "your" new row with <code>SELECT MAX(id)</code>: with many users inserting at once, the largest id may belong to someone else.</p>
<h2>INSERT ... SELECT: rows from a query</h2>
<p>Instead of <code>VALUES</code>, an insert can take the rows that a query returns. The institute launches a free Aptitude course and enrols every B2 student in it:</p>
<pre><code class="language-sql">INSERT INTO courses (id, title, fee) VALUES (6, 'Aptitude', 0);

INSERT INTO enrolments (student_id, course_id)
SELECT id, 6
FROM students
WHERE batch = 'B2';</code></pre>
<p>One statement creates an enrolment for each B2 student: four of them, now that Arjun has joined. The same technique copies data between tables, fills summary tables and archives old rows.</p>
<h2>When the database says no</h2>
<table>
<thead><tr><th>Statement</th><th>Why it fails</th></tr></thead>
<tbody>
<tr><td><code>INSERT INTO students (id, name, city, batch) VALUES (1, 'Ravi Kumar', 'Salem', 'B1');</code></td><td>Id 1 is taken: primary key violation</td></tr>
<tr><td><code>INSERT INTO enrolments (student_id, course_id) VALUES (42, 1);</code></td><td>There is no student 42: foreign key violation</td></tr>
<tr><td><code>INSERT INTO students (id, name, batch) VALUES (9, 'Ravi Kumar', 'B1');</code></td><td><code>city</code> is NOT NULL and has no default</td></tr>
</tbody>
</table>
<p>These errors are good news: the database protected your data. The application should catch them and tell the user something useful, such as "This student is already enrolled in Core Java", rather than showing a stack trace.</p>
<h2>Text containing an apostrophe</h2>
<p>To put a single quote inside a text value, write it twice: <code>'D''Souza'</code> stores D'Souza. When the value comes from a user, never build the SQL by joining strings together; pass the value as a parameter, as you will do with JDBC. Gluing user input into SQL text is exactly how SQL injection attacks work.</p>
<h2>Common mistakes</h2>
<ul>
<li>Inserting without a column list.</li>
<li>Inserting a child row (an enrolment) before its parent (the course) exists.</li>
<li>Reading back a generated id with <code>MAX(id)</code>.</li>
<li>Typing dates in local formats such as <code>'09-10-2026'</code>. Use <code>'2026-10-09'</code>.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>Add a Data Analytics course with id 7 and fee 16000, then enrol Nandhini (student 7) in it without a score.</summary><p><code>INSERT INTO courses (id, title, fee) VALUES (7, 'Data Analytics', 16000);</code> and then <code>INSERT INTO enrolments (student_id, course_id) VALUES (7, 7);</code> The order matters: the course must exist before the foreign key will accept the enrolment.</p></details>`,
          resources: [
            {
              title: 'PostgreSQL: INSERT',
              url: 'https://www.postgresql.org/docs/current/sql-insert.html',
            },
            {
              title: 'MySQL: INSERT Statement',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/insert.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'UPDATE and DELETE without regrets',
          minutes: 16,
          topic: 'Updating and deleting',
          html: `<p><code>UPDATE</code> changes values in existing rows and <code>DELETE</code> removes rows. Both are short statements with long consequences: one forgotten <code>WHERE</code> clause changes every row of a table in a fraction of a second. This lesson is as much about safe habits as about syntax.</p>
<h2>UPDATE: SET what, WHERE which</h2>
<pre><code class="language-sql">UPDATE enrolments
SET score = 77
WHERE student_id = 5 AND course_id = 4;</code></pre>
<p>Keerthana has taken her Spring Boot exam. <code>SET</code> says what changes and <code>WHERE</code> says which rows. Several columns can change at once, and a new value can be computed from the old one:</p>
<pre><code class="language-sql">-- Imran moves to Chennai and switches batch
UPDATE students
SET city = 'Chennai', batch = 'B2'
WHERE id = 4;

-- A festival discount of 1000 rupees on Spring Boot
UPDATE courses
SET fee = fee - 1000
WHERE id = 4;</code></pre>
<p>On the right of the <code>=</code>, <code>fee</code> means the value before the update, and the expression is worked out separately for each row that <code>WHERE</code> selects.</p>
<h3>Percentages on whole numbers</h3>
<p>When you change an integer column by a percentage, think about division. PostgreSQL divides an integer by an integer and drops the fraction, so <code>7 / 2</code> is <code>3</code>. MySQL's <code>/</code> returns a decimal (<code>3.5000</code>), and it offers <code>DIV</code> for whole-number division. In both, the order of operations matters: for a fee of 9050, PostgreSQL computes <code>9050 / 100 * 5</code> as 90 × 5 = 450, but <code>9050 * 5 / 100</code> as 452. Dividing first throws the remainder away before you multiply, so multiply first and divide last.</p>
<h2>Preview, then change</h2>
<p>Experienced developers follow the same routine before any update or delete on real data:</p>
<ol>
<li>Write the <code>WHERE</code> clause first, inside a <code>SELECT</code>: <code>SELECT * FROM courses WHERE id = 4;</code></li>
<li>Look at the rows and the count. Is it the one row you expected, or four hundred?</li>
<li>Only then change <code>SELECT *</code> into <code>UPDATE ... SET ...</code> or <code>DELETE</code>, leaving the <code>WHERE</code> clause untouched.</li>
<li>Read the count the database reports. MySQL prints "Rows matched: 1 Changed: 1"; PostgreSQL prints <code>UPDATE 1</code>.</li>
</ol>
<p>Two more safety nets. Wrap risky changes in a transaction: <code>START TRANSACTION;</code>, the change, a <code>SELECT</code> to check it, then <code>COMMIT;</code> or <code>ROLLBACK;</code>. (The last module covers transactions properly.) And in MySQL, <code>SET SQL_SAFE_UPDATES = 1;</code> makes the server refuse an <code>UPDATE</code> or <code>DELETE</code> whose <code>WHERE</code> clause does not use a key column. MySQL Workbench turns this on by default.</p>
<h2>DELETE: removing rows</h2>
<pre><code class="language-sql">DELETE FROM enrolments
WHERE student_id = 2 AND course_id = 3;</code></pre>
<p>Rahul has dropped Web Development. Without the <code>WHERE</code> clause, every enrolment would disappear. Foreign keys protect related rows here too: <code>DELETE FROM students WHERE id = 6;</code> fails while Vignesh still has enrolments, unless the foreign key was declared <code>ON DELETE CASCADE</code>. Usually that refusal is exactly what you want; remove or archive the child rows deliberately first.</p>
<h3>Changes driven by another table</h3>
<p>The <code>WHERE</code> clause may use a subquery. Raise by 500 rupees the fee of every course that has at least three enrolments:</p>
<pre><code class="language-sql">UPDATE courses
SET fee = fee + 500
WHERE id IN (
  SELECT course_id
  FROM enrolments
  GROUP BY course_id
  HAVING COUNT(*) &gt;= 3
);</code></pre>
<p>MySQL has one restriction to know: the subquery may not read the table being updated (error 1093). Here the update is on <code>courses</code> and the subquery reads <code>enrolments</code>, so it runs in both databases.</p>
<h2>DELETE, TRUNCATE and DROP: the classic interview question</h2>
<table>
<thead><tr><th></th><th>DELETE</th><th>TRUNCATE</th><th>DROP TABLE</th></tr></thead>
<tbody>
<tr><td>What goes</td><td>The rows WHERE selects, or all rows</td><td>All rows; the table stays</td><td>The table itself, with its rows and structure</td></tr>
<tr><td>WHERE allowed</td><td>Yes</td><td>No</td><td>No</td></tr>
<tr><td>Statement family</td><td>DML</td><td>DDL</td><td>DDL</td></tr>
<tr><td>Speed on a large table</td><td>Slower: removes and logs row by row</td><td>Fast</td><td>Fast</td></tr>
<tr><td>Rollback inside a transaction</td><td>Yes</td><td>PostgreSQL: yes. MySQL: no, it commits at once</td><td>PostgreSQL: yes. MySQL: no</td></tr>
<tr><td>Generated id counter</td><td>Carries on</td><td>Reset in MySQL; in PostgreSQL only with RESTART IDENTITY</td><td>Gone with the table</td></tr>
</tbody>
</table>
<h2>Common mistakes</h2>
<ul>
<li>Running an <code>UPDATE</code> without <code>WHERE</code> "just to see what happens".</li>
<li>Updating by a value that is not unique, such as <code>WHERE name = 'Ravi Kumar'</code>, when there are three Ravi Kumars. Update by key.</li>
<li>Deleting rows that reports or auditors will need later. The next lesson shows the soft-delete alternative.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>Write a statement that removes every enrolment of student 8 that has no score yet.</summary><p><code>DELETE FROM enrolments WHERE student_id = 8 AND score IS NULL;</code> Run <code>SELECT * FROM enrolments WHERE student_id = 8 AND score IS NULL;</code> first to see exactly which rows will go.</p></details>`,
          resources: [
            {
              title: 'PostgreSQL tutorial: Updates',
              url: 'https://www.postgresql.org/docs/current/tutorial-update.html',
            },
            {
              title: 'MySQL: UPDATE Statement',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/update.html',
            },
            {
              title: 'MySQL: TRUNCATE TABLE Statement',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/truncate-table.html',
            },
          ],
        },
        { kind: 'practice', question: 'sql-raise-fee', topic: 'Updating and deleting' },
        {
          kind: 'article',
          title: 'Upserts, soft deletes and audit columns',
          minutes: 14,
          topic: 'Real-world patterns',
          html: `<p>Plain INSERT, UPDATE and DELETE are enough for exercises. Production systems add a few patterns on top: insert-or-update in one step, deleting without losing history, and recording when each row changed. You will meet all three in your first project, so learn to recognise them now.</p>
<h2>Upsert: insert, or update if the row exists</h2>
<p>Every week a trainer uploads a marks sheet. Some rows are new; others correct marks already entered. Checking each row with a SELECT and then choosing INSERT or UPDATE is slow, and two uploads running at once can both decide to insert. An <strong>upsert</strong> does the job in one atomic statement, using a primary key or unique constraint to detect the existing row:</p>
<pre><code class="language-sql">-- PostgreSQL
INSERT INTO enrolments (student_id, course_id, score)
VALUES (5, 4, 79)
ON CONFLICT (student_id, course_id)
DO UPDATE SET score = EXCLUDED.score;

-- MySQL 8.0.19 and later
INSERT INTO enrolments (student_id, course_id, score)
VALUES (5, 4, 79) AS incoming
ON DUPLICATE KEY UPDATE score = incoming.score;</code></pre>
<p>In PostgreSQL, <code>EXCLUDED</code> means "the row you tried to insert". In MySQL you give the incoming row an alias; older MySQL code writes <code>VALUES(score)</code> instead, which still works but is deprecated. If the pair (5, 4) does not exist yet, both statements simply insert it.</p>
<p>Sometimes you want to skip duplicates rather than update them. PostgreSQL offers <code>ON CONFLICT DO NOTHING</code>. MySQL's <code>INSERT IGNORE</code> looks similar, but it also downgrades other errors, such as invalid values, to warnings, so use it carefully.</p>
<h2>Soft delete: hide rows instead of destroying them</h2>
<p>When a student leaves, you rarely want their history gone: certificates, fee receipts and placement records still refer to them, and auditors may ask questions years later. A <strong>soft delete</strong> marks the row instead of removing it:</p>
<pre><code class="language-sql">ALTER TABLE students ADD COLUMN deleted_at TIMESTAMP NULL;

-- "Delete" Rahul
UPDATE students SET deleted_at = CURRENT_TIMESTAMP WHERE id = 2;

-- Normal queries now leave deleted rows out
SELECT name FROM students WHERE deleted_at IS NULL;</code></pre>
<p>Undoing a mistake is easy: set <code>deleted_at</code> back to NULL. The price is discipline, because every query must remember the filter. Teams often define a view that applies it once:</p>
<pre><code class="language-sql">CREATE VIEW active_students AS
SELECT id, name, city, batch
FROM students
WHERE deleted_at IS NULL;</code></pre>
<p>Reports then read from <code>active_students</code> as if it were a table. Two cautions. A soft-deleted row still occupies its unique values, so a returning student's email may be rejected by a UNIQUE constraint; decide up front how you will handle that. And privacy rules may require some personal data to be truly erased; hiding a row is not erasing it.</p>
<h2>Audit columns: when did this row change?</h2>
<p>Almost every production table carries <code>created_at</code> and <code>updated_at</code> columns. Support teams use them constantly ("when was this fee changed?"), and other systems use them to fetch only what changed since their last sync.</p>
<pre><code class="language-sql">-- MySQL can maintain updated_at by itself
CREATE TABLE fee_changes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  course_id  INT NOT NULL,
  new_fee    INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                       ON UPDATE CURRENT_TIMESTAMP
);</code></pre>
<p><code>ON UPDATE CURRENT_TIMESTAMP</code> is a MySQL feature. In PostgreSQL, <code>DEFAULT CURRENT_TIMESTAMP</code> takes care of <code>created_at</code>, and <code>updated_at</code> is set either by the application (Hibernate, which you will meet in the Advanced Java course, can do it for you) or by a trigger.</p>
<h2>Common mistakes</h2>
<ul>
<li>Writing "check, then insert or update" in application code without a unique constraint, so two simultaneous requests create duplicates.</li>
<li>Adding soft delete and forgetting the filter in one report, which then counts students who left last year.</li>
<li>Storing times without a time-zone convention. A common choice is UTC in the database and Indian Standard Time on screen; whatever you choose, be consistent.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>Why is an upsert safer than a SELECT followed by an INSERT or an UPDATE?</summary><p>Between your SELECT and your INSERT, another session can insert the same key, so one of you fails or a duplicate slips in. An upsert is a single statement, and the unique constraint decides atomically whether the row already exists.</p></details>`,
          resources: [
            {
              title: 'PostgreSQL: INSERT (ON CONFLICT)',
              url: 'https://www.postgresql.org/docs/current/sql-insert.html',
            },
            {
              title: 'MySQL: INSERT ... ON DUPLICATE KEY UPDATE',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/insert-on-duplicate.html',
            },
          ],
        },
      ],
    },
    {
      title: 'Design and transactions',
      summary:
        'Design tables that stay correct as data grows: normalise to third normal form, add the indexes your queries need, and group changes into ACID transactions that survive crashes and concurrent users.',
      lessons: [
        {
          kind: 'article',
          title: 'Normalisation: from one messy sheet to clean tables (1NF, 2NF, 3NF)',
          minutes: 20,
          topic: 'Design',
          html: `<p>Most messy databases begin as a spreadsheet that grew. <strong>Normalisation</strong> is the method for splitting such data into tables so that each fact is stored exactly once. It is a favourite interview topic, but more importantly it prevents real bugs. In this lesson you normalise one messy table, step by step, through the first three normal forms.</p>
<h2>The messy starting point</h2>
<p>An online store selling supplies to engineering students tracks orders in one sheet:</p>
<table>
<thead><tr><th>order_id</th><th>order_date</th><th>customer</th><th>customer_city</th><th>products</th><th>total</th></tr></thead>
<tbody>
<tr><td>5001</td><td>2026-09-02</td><td>Priya S</td><td>Pune</td><td>Scientific calculator (1), Drawing kit (2)</td><td>2297</td></tr>
<tr><td>5002</td><td>2026-09-03</td><td>Karthik M</td><td>Chennai</td><td>Drawing kit (1)</td><td>649</td></tr>
<tr><td>5003</td><td>2026-09-05</td><td>Priya S</td><td>Pune</td><td>Arduino starter kit (1)</td><td>1899</td></tr>
</tbody>
</table>
<p>It looks tidy, but it hides three kinds of trouble, called <strong>anomalies</strong>:</p>
<ul>
<li><strong>Update anomaly:</strong> Priya moves to Mumbai. Her city appears on two rows; miss one and the data contradicts itself.</li>
<li><strong>Insertion anomaly:</strong> the store adds a soldering iron to its catalogue, but there is nowhere to record its price until somebody orders one.</li>
<li><strong>Deletion anomaly:</strong> cancel order 5002 and delete its row, and you also lose the only record that Karthik exists.</li>
</ul>
<h2>First normal form: one value per cell</h2>
<p>A table is in <strong>1NF</strong> when every cell holds a single value and there are no repeating groups. The <code>products</code> cell holds a list, so split it into one row per order line, with the price and quantity in their own columns:</p>
<table>
<thead><tr><th>order_id</th><th>order_date</th><th>customer</th><th>customer_city</th><th>product</th><th>unit_price</th><th>quantity</th></tr></thead>
<tbody>
<tr><td>5001</td><td>2026-09-02</td><td>Priya S</td><td>Pune</td><td>Scientific calculator</td><td>999</td><td>1</td></tr>
<tr><td>5001</td><td>2026-09-02</td><td>Priya S</td><td>Pune</td><td>Drawing kit</td><td>649</td><td>2</td></tr>
<tr><td>5002</td><td>2026-09-03</td><td>Karthik M</td><td>Chennai</td><td>Drawing kit</td><td>649</td><td>1</td></tr>
<tr><td>5003</td><td>2026-09-05</td><td>Priya S</td><td>Pune</td><td>Arduino starter kit</td><td>1899</td><td>1</td></tr>
</tbody>
</table>
<p>The key is now the pair <code>(order_id, product)</code>. The <code>total</code> column is gone too: it can always be computed as the sum of <code>unit_price × quantity</code>, and a stored copy of a computed value is one more thing that can disagree with its source.</p>
<h2>Second normal form: depend on the whole key</h2>
<p>A table is in <strong>2NF</strong> when it is in 1NF and every non-key column depends on the <em>whole</em> key, not just part of it. Here, <code>order_date</code>, <code>customer</code> and <code>customer_city</code> depend only on <code>order_id</code>, and <code>unit_price</code> depends only on <code>product</code>. Those partial dependencies are why the same facts repeat. Split them out:</p>
<pre><code class="language-text">orders      (order_id, order_date, customer, customer_city)
products    (product_id, name, unit_price)
order_items (order_id, product_id, quantity)</code></pre>
<p>Only <code>quantity</code> truly depends on both an order and a product, so only it stays in <code>order_items</code>. The soldering iron can now go into <code>products</code> before anyone buys one.</p>
<h2>Third normal form: depend on nothing but the key</h2>
<p>A table is in <strong>3NF</strong> when it is in 2NF and no non-key column depends on another non-key column. In <code>orders</code>, <code>customer_city</code> is determined by the customer, not by the order. That is a <em>transitive</em> dependency: order → customer → city. Give customers their own table:</p>
<pre><code class="language-sql">CREATE TABLE customers (
  id   INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  city VARCHAR(60)  NOT NULL
);

CREATE TABLE products (
  id         INTEGER PRIMARY KEY,
  name       VARCHAR(100)  NOT NULL UNIQUE,
  unit_price DECIMAL(10,2) NOT NULL
);

CREATE TABLE orders (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  ordered_on  DATE    NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers (id)
);

CREATE TABLE order_items (
  order_id   INTEGER       NOT NULL,
  product_id INTEGER       NOT NULL,
  quantity   INTEGER       NOT NULL CHECK (quantity &gt; 0),
  unit_price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (order_id, product_id),
  FOREIGN KEY (order_id)   REFERENCES orders (id),
  FOREIGN KEY (product_id) REFERENCES products (id)
);</code></pre>
<p>Priya's move to Mumbai is now one update to one row. Cancelling Karthik's order leaves Karthik in <code>customers</code>. All three anomalies are gone.</p>
<p>Did you notice <code>unit_price</code> came back in <code>order_items</code>? That is not a mistake. <code>products.unit_price</code> is today's price; <code>order_items.unit_price</code> is the price this customer actually paid on that day. When the drawing kit's price rises next month, old invoices must not change. They are two different facts that happen to share a name.</p>
<h2>A one-line summary to remember</h2>
<p>Every non-key column should depend on the key (1NF gives you one), on all of the key (2NF) and on nothing other than the key (3NF). Stricter forms such as BCNF exist, but a design in 3NF is what most interviewers and most real projects expect.</p>
<h2>When to break the rules</h2>
<p>Normalised designs need joins, and very busy reports sometimes copy data on purpose, for example a <code>total</code> stored on each order for fast listing. That is called <strong>denormalisation</strong>. Do it deliberately, for a measured performance reason, and with a clear plan to keep the copy correct; never do it by accident.</p>
<h2>Check yourself</h2>
<details><summary>A college_admissions table has the columns (application_no, applicant_name, college_code, college_name, branch). Which normal form does it break, and how would you fix it?</summary><p>Assuming <code>application_no</code> is the key, <code>college_name</code> depends on <code>college_code</code>, a non-key column, which breaks 3NF. Move colleges into their own table <code>colleges(college_code, college_name)</code> and keep only <code>college_code</code> in the admissions table as a foreign key.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Indexes: faster reads, and what they cost',
          minutes: 18,
          topic: 'Indexes',
          html: `<p>Your queries return the right answers; now they need to return them quickly. On seven students every query is instant. On a payments table with two crore rows, the same query can take a minute without the right <strong>index</strong> and a few milliseconds with it. Indexes are also among the most common backend interview topics.</p>
<h2>What an index is</h2>
<p>Think of the index at the back of a textbook. To find "normalisation" you do not read all 600 pages; you look the word up in an alphabetical list that points you to page 214. A database index is the same idea: a separate, sorted structure (usually a <strong>B-tree</strong>) that maps column values to the rows that hold them. Without one, the database must read and test every row, which is called a <strong>full table scan</strong>.</p>
<pre><code class="language-sql">CREATE INDEX idx_orders_customer ON orders (customer_id);

SELECT id, ordered_on
FROM orders
WHERE customer_id = 4521;</code></pre>
<p>With the index, the database goes straight to customer 4521's entries. The work grows with the logarithm of the table size, so a table a thousand times larger needs only a few more steps.</p>
<h2>Indexes you already have</h2>
<p>Every primary key and every <code>UNIQUE</code> constraint is backed by an index automatically; that is how the database checks uniqueness quickly. MySQL's InnoDB engine also creates an index on each foreign key column if you have not. PostgreSQL does not, so in PostgreSQL index foreign key columns yourself: joins use them, and so does the check that runs when a parent row is deleted.</p>
<h2>Composite indexes and the leftmost-prefix rule</h2>
<pre><code class="language-sql">CREATE INDEX idx_orders_customer_date ON orders (customer_id, ordered_on);</code></pre>
<p>This index is sorted by customer, and by date within each customer, like a phone directory sorted by surname and then first name. It helps all of these:</p>
<ul>
<li><code>WHERE customer_id = 4521</code></li>
<li><code>WHERE customer_id = 4521 AND ordered_on &gt;= '2026-01-01'</code></li>
<li><code>WHERE customer_id = 4521 ORDER BY ordered_on DESC</code></li>
</ul>
<p>It does not help <code>WHERE ordered_on = '2026-09-02'</code> on its own, just as a directory sorted by surname cannot quickly list everyone called Priya. Put the column you test for equality first and the range or sort column second.</p>
<h2>When an index cannot be used</h2>
<ul>
<li><strong>A function wrapped around the column.</strong> <code>WHERE YEAR(ordered_on) = 2026</code> in MySQL, or <code>EXTRACT(YEAR FROM ordered_on) = 2026</code> in PostgreSQL, hides the column inside a calculation. Rewrite it as a range: <code>WHERE ordered_on &gt;= '2026-01-01' AND ordered_on &lt; '2027-01-01'</code>.</li>
<li><strong>A leading wildcard.</strong> A pattern with a fixed start, such as <code>LIKE 'Pri%'</code>, can be answered from an index; <code>LIKE '%ya'</code> cannot, because the index is sorted by the first characters.</li>
<li><strong>A condition that matches most rows.</strong> If 95% of customers are active, <code>WHERE is_active = TRUE</code> is cheaper to answer by scanning, and the optimiser rightly ignores the index.</li>
</ul>
<h2>Check, do not guess: EXPLAIN</h2>
<p>Put <code>EXPLAIN</code> in front of a query and the database shows its plan instead of running it:</p>
<pre><code class="language-sql">EXPLAIN SELECT id, ordered_on FROM orders WHERE customer_id = 4521;</code></pre>
<p>In MySQL, look at the <code>type</code> and <code>key</code> columns: <code>ALL</code> means a full scan, while <code>ref</code> or <code>range</code> with your index's name under <code>key</code> means the index is used. In PostgreSQL, <code>Seq Scan</code> means a full scan and <code>Index Scan</code> or <code>Bitmap Index Scan</code> means the index is used. <code>EXPLAIN ANALYZE</code> (PostgreSQL, and MySQL from 8.0.18) actually runs the query and reports real timings.</p>
<h2>What indexes cost</h2>
<p>If indexes are so good, why not index every column? Because they are not free:</p>
<ul>
<li>Every <code>INSERT</code> and <code>DELETE</code>, and every <code>UPDATE</code> of an indexed column, must update each affected index as well, so writes get slower.</li>
<li>Each index takes disk space and memory that could cache data instead.</li>
<li>An index on a column you never search by is pure cost.</li>
</ul>
<p>The practical rule: index the columns used by frequent <code>WHERE</code> clauses, joins and <code>ORDER BY</code>; measure with <code>EXPLAIN</code>; and remove indexes that nothing uses.</p>
<h2>Common mistakes</h2>
<ul>
<li>Adding an index on every column "for performance" and slowing down every write.</li>
<li>Creating separate single-column indexes when the query needs one composite index.</li>
<li>Defeating a perfectly good index with a function or a leading wildcard.</li>
</ul>
<h2>Interview corner</h2>
<details><summary>Does an index make inserts faster?</summary><p>No. Indexes speed up finding rows, not writing them. Each insert must also add an entry to every index on the table, so more indexes mean slightly slower inserts.</p></details>
<details><summary>What is the difference between a unique index and an ordinary one?</summary><p>Both speed up lookups. A unique index also rejects a second row with the same value; that is how UNIQUE and PRIMARY KEY constraints are enforced.</p></details>`,
          resources: [
            {
              title: 'PostgreSQL: Indexes',
              url: 'https://www.postgresql.org/docs/current/indexes.html',
            },
            {
              title: 'PostgreSQL: Using EXPLAIN',
              url: 'https://www.postgresql.org/docs/current/using-explain.html',
            },
            {
              title: 'MySQL: How MySQL Uses Indexes',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/mysql-indexes.html',
            },
          ],
        },
        { kind: 'practice', question: 'sql-index-purpose', topic: 'Indexes' },
        {
          kind: 'article',
          title: 'Transactions and the ACID guarantees',
          minutes: 16,
          topic: 'Transactions',
          html: `<p>Placing an order is not one change but several: the stock goes down, an order row is created and its items are recorded. If the server crashes halfway, you could have reduced the stock for an order that does not exist. A <strong>transaction</strong> groups several statements into one unit that happens completely or not at all.</p>
<h2>COMMIT and ROLLBACK</h2>
<pre><code class="language-sql">START TRANSACTION;          -- BEGIN works too, in both databases

UPDATE products
SET stock = stock - 1
WHERE id = 101 AND stock &gt;= 1;

INSERT INTO orders (id, customer_id, ordered_on)
VALUES (5004, 42, '2026-10-09');

INSERT INTO order_items (order_id, product_id, quantity, unit_price)
VALUES (5004, 101, 1, 999.00);

COMMIT;</code></pre>
<p>Until <code>COMMIT</code>, the changes are provisional: other sessions do not see them, and <code>ROLLBACK</code> discards them all as if nothing had happened. If anything goes wrong, for example the stock update changes 0 rows because the calculator has sold out, the application issues <code>ROLLBACK</code> instead of carrying on.</p>
<h3>Autocommit</h3>
<p>Both MySQL and PostgreSQL work in <strong>autocommit</strong> mode by default: a statement outside an explicit transaction is committed on its own the moment it succeeds. That is why your earlier UPDATEs took effect without any COMMIT. <code>START TRANSACTION</code> suspends autocommit until the next <code>COMMIT</code> or <code>ROLLBACK</code>.</p>
<h3>Savepoints</h3>
<p>Inside a long transaction you can mark a point and roll back to it without abandoning everything:</p>
<pre><code class="language-sql">SAVEPOINT before_coupon;
UPDATE order_items SET unit_price = 899.00 WHERE order_id = 5004 AND product_id = 101;
ROLLBACK TO SAVEPOINT before_coupon;   -- undoes only the coupon</code></pre>
<h2>ACID: the four guarantees</h2>
<table>
<thead><tr><th>Letter</th><th>Property</th><th>What it means for the order</th></tr></thead>
<tbody>
<tr><td>A</td><td>Atomicity</td><td>All the statements take effect, or none do. Stock is never reduced without an order.</td></tr>
<tr><td>C</td><td>Consistency</td><td>A transaction takes the database from one valid state to another: every constraint (keys, foreign keys, CHECKs) holds when it commits, or it does not commit.</td></tr>
<tr><td>I</td><td>Isolation</td><td>Transactions running at the same time do not see each other's unfinished work. The next lesson covers the levels of isolation.</td></tr>
<tr><td>D</td><td>Durability</td><td>Once COMMIT returns, the change survives a crash or a power cut, because it has been written to the database's log on disk.</td></tr>
</tbody>
</table>
<p>In an interview, define each property in one sentence and then give an example like this order. An example shows understanding; a definition alone shows memory.</p>
<h2>Differences you will run into</h2>
<ul>
<li><strong>Storage engines in MySQL.</strong> Transactions need the InnoDB engine, MySQL's default for many years. The old MyISAM engine ignores COMMIT and ROLLBACK altogether, so check the engine of any legacy table.</li>
<li><strong>Schema changes.</strong> In MySQL, statements such as <code>CREATE TABLE</code>, <code>ALTER TABLE</code> and <code>TRUNCATE</code> commit the current transaction implicitly and cannot be rolled back. PostgreSQL runs most schema changes inside transactions, so a failed migration can roll back cleanly.</li>
<li><strong>Errors in PostgreSQL.</strong> After any error inside a transaction, PostgreSQL rejects further statements ("current transaction is aborted") until you roll back. MySQL lets you continue, and you decide whether to commit.</li>
</ul>
<h2>Keep transactions short</h2>
<p>A transaction holds locks on the rows it has changed, and other sessions that need those rows must wait. Never keep a transaction open while waiting for a user to click something or for a slow outside service such as a payment gateway. Do the database work, commit, then make the outside call.</p>
<h2>Common mistakes</h2>
<ul>
<li>Running related statements in autocommit mode, so a failure in the middle leaves half the work saved.</li>
<li>Forgetting to COMMIT in a client session and wondering why other users cannot see your changes, or why their updates are waiting.</li>
<li>Catching an error in application code and committing anyway.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>A counsellor confirms a seat: the portal inserts an allotment row and reduces the batch's seats_left, in one transaction. The power fails after the insert but before COMMIT. What will you find after the restart?</summary><p>Neither change. The transaction never committed, so atomicity means the insert is undone during recovery. Had COMMIT returned before the power cut, durability would guarantee that both changes were still there.</p></details>`,
          resources: [
            {
              title: 'PostgreSQL tutorial: Transactions',
              url: 'https://www.postgresql.org/docs/current/tutorial-transactions.html',
            },
            {
              title: 'MySQL: START TRANSACTION, COMMIT and ROLLBACK',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/commit.html',
            },
          ],
        },
        { kind: 'practice', question: 'sql-transaction', topic: 'Transactions' },
        {
          kind: 'article',
          title: 'Isolation levels, locks and two users at once',
          minutes: 18,
          topic: 'Transactions',
          html: `<p>The counselling portal has one seat left in the Spring Boot weekend batch. Two counsellors, one in Chennai and one in Coimbatore, click "Confirm" for two different students within the same second. Do both succeed? The answer depends on <strong>isolation</strong>, the I in ACID, and on how you write the update.</p>
<h2>What can go wrong when transactions overlap</h2>
<table>
<thead><tr><th>Problem</th><th>What happens</th></tr></thead>
<tbody>
<tr><td>Dirty read</td><td>You read another transaction's change before it commits, and it then rolls back. You acted on data that never officially existed.</td></tr>
<tr><td>Non-repeatable read</td><td>You read the same row twice in one transaction and get different values, because someone committed an update in between.</td></tr>
<tr><td>Phantom read</td><td>You run the same query twice and new rows appear, because someone committed an insert in between.</td></tr>
<tr><td>Lost update</td><td>Two transactions read the same value, both compute a new value from it, and the second write silently overwrites the first.</td></tr>
</tbody>
</table>
<h2>The four isolation levels</h2>
<p>The SQL standard defines four levels. Each rules out more problems, at the price of more waiting or more retries:</p>
<table>
<thead><tr><th>Level</th><th>Dirty read</th><th>Non-repeatable read</th><th>Phantom read</th></tr></thead>
<tbody>
<tr><td>READ UNCOMMITTED</td><td>possible</td><td>possible</td><td>possible</td></tr>
<tr><td>READ COMMITTED</td><td>prevented</td><td>possible</td><td>possible</td></tr>
<tr><td>REPEATABLE READ</td><td>prevented</td><td>prevented</td><td>possible</td></tr>
<tr><td>SERIALIZABLE</td><td>prevented</td><td>prevented</td><td>prevented</td></tr>
</tbody>
</table>
<p>The defaults differ, and interviewers do ask: <strong>PostgreSQL uses READ COMMITTED</strong>, while <strong>MySQL's InnoDB uses REPEATABLE READ</strong>. Both engines do better than the table's minimum. PostgreSQL never allows dirty reads, even if you ask for READ UNCOMMITTED, and at REPEATABLE READ both keep phantoms out of ordinary reads, because each transaction reads from a consistent snapshot of the data. You can choose the level for one transaction:</p>
<pre><code class="language-sql">-- MySQL: applies to the next transaction
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
START TRANSACTION;

-- PostgreSQL: inside the transaction, before its first query
BEGIN;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;</code></pre>
<h2>The last seat: a lost update</h2>
<p>The naive code reads, decides in the application and then writes:</p>
<pre><code class="language-sql">SELECT seats_left FROM batches WHERE id = 7;      -- both counsellors read 1
-- application: 1 is more than 0, so go ahead
UPDATE batches SET seats_left = 0 WHERE id = 7;   -- both write 0
INSERT INTO allotments (batch_id, student_id) VALUES (7, 1042);   -- the other inserts 1057</code></pre>
<p>Both transactions saw one seat, both wrote zero and both inserted an allotment: two students, one seat. READ COMMITTED does not prevent this, because each transaction only ever read committed data. There are two standard fixes.</p>
<h3>Fix 1: let a single UPDATE check and change</h3>
<pre><code class="language-sql">UPDATE batches
SET seats_left = seats_left - 1
WHERE id = 7 AND seats_left &gt; 0;
-- 1 row changed: the seat is yours. 0 rows: it has gone, so roll back.</code></pre>
<p>The database locks a row while updating it. At the default levels of both databases, the second counsellor's UPDATE waits for the first transaction to commit, then evaluates <code>seats_left &gt; 0</code> against the new value 0 and changes nothing. Your code must check the affected-row count, which every database driver reports.</p>
<h3>Fix 2: lock the row when you read it</h3>
<p>When the decision needs real application logic, read the row with <code>SELECT ... FOR UPDATE</code>:</p>
<pre><code class="language-sql">START TRANSACTION;
SELECT seats_left FROM batches WHERE id = 7 FOR UPDATE;   -- a second session waits here
-- the application checks the value, then:
UPDATE batches SET seats_left = seats_left - 1 WHERE id = 7;
INSERT INTO allotments (batch_id, student_id) VALUES (7, 1042);
COMMIT;</code></pre>
<p><code>FOR UPDATE</code> locks the row until the transaction ends, so the other counsellor's SELECT waits and then reads 0. MySQL and PostgreSQL both support it.</p>
<h2>Deadlocks</h2>
<p>Suppose transaction A has locked row 1 and wants row 2, while transaction B has locked row 2 and wants row 1. Neither can continue. The database detects this <strong>deadlock</strong> and aborts one of the transactions with an error. That is normal behaviour, not a database bug: your application should catch the error and retry the transaction. You make deadlocks rarer by keeping transactions short and by touching rows in a consistent order, for example always by ascending id.</p>
<h2>Common mistakes</h2>
<ul>
<li>Reading a value, deciding in Java and writing back a value computed from the old read, with no lock and no condition in the UPDATE.</li>
<li>Raising every transaction to SERIALIZABLE "to be safe", then being surprised by waiting and serialisation errors under load. At SERIALIZABLE your code must be ready to retry.</li>
<li>Ignoring the affected-row count of an UPDATE.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>Which isolation level does each database use by default?</summary><p>PostgreSQL uses READ COMMITTED. MySQL with InnoDB uses REPEATABLE READ.</p></details>
<details><summary>Why does adding "AND seats_left &gt; 0" to the UPDATE fix the double booking?</summary><p>The check and the change happen in one statement on a locked row. The second update re-checks the condition against the committed value after the first finishes, finds no seat and changes no row, so the application knows to refuse.</p></details>`,
          resources: [
            {
              title: 'PostgreSQL: Transaction Isolation',
              url: 'https://www.postgresql.org/docs/current/transaction-iso.html',
            },
            {
              title: 'MySQL: Transaction Isolation Levels',
              url: 'https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html',
            },
          ],
        },
      ],
    },
  ],
  assignments: ['SQL Practice: Queries and Joins'],
  tests: [
    {
      title: 'SQL and Databases — on-demand practice test',
      kind: 'practice',
      description:
        'A short self-check on the ideas behind the queries: NULL handling, WHERE versus HAVING, outer joins, keys, indexes and transactions. Take it as often as you like; your trainer sees your scores, not a pass or fail.',
      durationMinutes: 15,
      sections: [
        {
          title: 'Queries and joins',
          questions: ['sql-null-comparison', 'sql-where-vs-having', 'sql-left-join'],
        },
        {
          title: 'Design and transactions',
          questions: ['sql-primary-key', 'sql-index-purpose', 'sql-transaction'],
        },
      ],
    },
  ],
};
