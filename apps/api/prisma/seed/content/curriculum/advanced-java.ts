import type { CurriculumCourse } from './types.js';

export const COURSE: CurriculumCourse = {
  slug: 'advanced-java',
  title: 'Advanced Java and Spring Boot',
  subject: 'advanced-java',
  level: 'intermediate',
  description:
    'Go from core Java to building backend services the way companies do. You connect to databases with JDBC, organise projects with Maven, learn Spring dependency injection and Spring Boot, persist data with JPA and Hibernate, build validated REST APIs with the right status codes and error responses, and test and package them, using a college library API as the running example.',
  tags: ['java', 'jdbc', 'maven', 'spring-boot', 'jpa', 'hibernate', 'rest-api', 'testing'],
  modules: [
    {
      title: 'JDBC and the database',
      summary:
        'Connect Java to a relational database with JDBC: drivers, connections, PreparedStatement, result sets, transactions and connection pools, and see why frameworks were built on top of it.',
      lessons: [
        {
          kind: 'article',
          title: 'JDBC from the ground up: drivers, connections and result sets',
          minutes: 18,
          topic: 'JDBC basics',
          html: `<p>Every Java backend you will work on talks to its database through <strong>JDBC</strong>, the Java Database Connectivity API in the <code>java.sql</code> package. Spring Data and Hibernate generate JDBC calls for you, but when something goes wrong (a slow query, a leaked connection, a puzzling error) you debug at this level. That is why JDBC questions appear even in interviews for Spring Boot roles.</p>
<h2>The pieces</h2>
<table>
<thead><tr><th>Piece</th><th>What it is</th></tr></thead>
<tbody>
<tr><td>Driver</td><td>A jar from the database vendor that implements JDBC for that database, such as MySQL Connector/J or the PostgreSQL JDBC driver</td></tr>
<tr><td><code>Connection</code></td><td>An open session with the database: expensive to create, and it must be closed</td></tr>
<tr><td><code>PreparedStatement</code></td><td>A SQL statement with <code>?</code> placeholders for values</td></tr>
<tr><td><code>ResultSet</code></td><td>A cursor over the rows a query returns, read one row at a time</td></tr>
<tr><td><code>SQLException</code></td><td>The checked exception that almost every JDBC method can throw</td></tr>
</tbody>
</table>
<p>Your code uses only the interfaces in <code>java.sql</code>; the driver supplies the implementations. That is why the same code can run against MySQL or PostgreSQL by changing the connection URL and the driver jar.</p>
<h2>Getting the driver</h2>
<p>Add the driver as a Maven dependency (the next module explains Maven properly). For MySQL:</p>
<pre><code class="language-xml">&lt;dependency&gt;
  &lt;groupId&gt;com.mysql&lt;/groupId&gt;
  &lt;artifactId&gt;mysql-connector-j&lt;/artifactId&gt;
  &lt;version&gt;8.4.0&lt;/version&gt;
  &lt;scope&gt;runtime&lt;/scope&gt;
&lt;/dependency&gt;</code></pre>
<p>For PostgreSQL the coordinates are <code>org.postgresql:postgresql</code>. Old tutorials start with <code>Class.forName("com.mysql.jdbc.Driver")</code>; since JDBC 4.0, drivers register themselves automatically, so you can drop that line.</p>
<h2>The library database</h2>
<p>This course builds the backend of a college library. Create the first table in MySQL. In PostgreSQL, write <code>BIGINT GENERATED ALWAYS AS IDENTITY</code> instead of <code>BIGINT AUTO_INCREMENT</code>.</p>
<pre><code class="language-sql">CREATE TABLE books (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  title            VARCHAR(200) NOT NULL,
  author           VARCHAR(120) NOT NULL,
  isbn             CHAR(13)     NOT NULL UNIQUE,
  available_copies INT          NOT NULL
);

INSERT INTO books (title, author, isbn, available_copies) VALUES
  ('Malgudi Days', 'R. K. Narayan', '9789300000011', 3),
  ('Swami and Friends', 'R. K. Narayan', '9789300000028', 1),
  ('Wings of Fire', 'A. P. J. Abdul Kalam', '9789300000059', 2);</code></pre>
<p>The ISBNs are sample values made up for this course.</p>
<h2>Reading rows: a complete program</h2>
<pre><code class="language-java">import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class ListBooks {
    public static void main(String[] args) {
        String url = "jdbc:mysql://localhost:3306/library";
        String user = "library_app";
        String password = System.getenv("LIBRARY_DB_PASSWORD");
        String sql = "SELECT id, title, available_copies FROM books WHERE author = ? ORDER BY title";

        try (Connection conn = DriverManager.getConnection(url, user, password);
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, "R. K. Narayan");
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long id = rs.getLong("id");
                    String title = rs.getString("title");
                    int copies = rs.getInt("available_copies");
                    System.out.printf("%d  %s  (%d available)%n", id, title, copies);
                }
            }
        } catch (SQLException e) {
            System.err.println("Could not read books: " + e.getMessage());
        }
    }
}</code></pre>
<pre><code class="language-text">1  Malgudi Days  (3 available)
2  Swami and Friends  (1 available)</code></pre>
<p>Step by step:</p>
<ol>
<li><strong>The URL</strong> names the driver, host, port and database: <code>jdbc:mysql://localhost:3306/library</code> for MySQL, <code>jdbc:postgresql://localhost:5432/library</code> for PostgreSQL.</li>
<li><strong>The password</strong> comes from an environment variable, never from the source code. Code is shared through Git; passwords must not be.</li>
<li><strong>try-with-resources</strong> closes the <code>ResultSet</code>, the <code>PreparedStatement</code> and the <code>Connection</code> automatically, in reverse order, even when an exception is thrown. Forgetting to close connections is one of the classic production bugs: the application works for an hour, then the database refuses new connections.</li>
<li><strong><code>rs.next()</code></strong> moves the cursor to the next row and returns <code>false</code> when there are no more. The cursor starts <em>before</em> the first row, so you call <code>next()</code> before reading anything.</li>
<li><strong>Getters</strong> such as <code>getString</code>, <code>getInt</code> and <code>getLong</code> read a column by name or by position. Positions start at <strong>1</strong>, not 0.</li>
</ol>
<h3>Reading NULL values</h3>
<p><code>getInt</code> returns <code>0</code> for a SQL <code>NULL</code>, because an <code>int</code> cannot be null. For a nullable column, call <code>rs.wasNull()</code> right after the getter, or read it as an object with <code>rs.getObject("available_copies", Integer.class)</code>, which returns <code>null</code>.</p>
<h2>SQLException is a checked exception</h2>
<p><code>SQLException</code> extends <code>Exception</code>, not <code>RuntimeException</code>, so the compiler makes you catch it or declare it with <code>throws</code>. It carries more than a message: <code>getSQLState()</code> returns a standard five-character code and <code>getErrorCode()</code> the vendor's own number. A duplicate ISBN, for example, has SQLState <code>23000</code> in MySQL and <code>23505</code> in PostgreSQL; both begin with 23, the class for integrity-constraint violations.</p>
<h2>Common mistakes</h2>
<ul>
<li>Reading a column before calling <code>rs.next()</code>: "Before start of result set".</li>
<li>Using column index 0: "Column index out of range". JDBC counts from 1.</li>
<li>Not closing connections. It works in a demo and fails in production.</li>
<li>Hard-coding the database password in the source file.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>Why does the cursor start before the first row instead of on it?</summary><p>So that one <code>while (rs.next())</code> loop handles every case, including an empty result: the first call returns <code>false</code> and the loop body never runs.</p></details>`,
          resources: [
            {
              title: 'JDBC Basics (The Java Tutorials)',
              url: 'https://docs.oracle.com/javase/tutorial/jdbc/basics/index.html',
            },
            {
              title: 'Processing SQL Statements with JDBC',
              url: 'https://docs.oracle.com/javase/tutorial/jdbc/basics/processingsqlstatements.html',
            },
          ],
        },
        { kind: 'practice', question: 'java-checked-exceptions', topic: 'JDBC basics' },
        {
          kind: 'article',
          title: 'PreparedStatement, parameters and SQL injection',
          minutes: 15,
          topic: 'JDBC basics',
          html: `<p>The program in the previous lesson put a <code>?</code> in the SQL and filled it with <code>setString</code>. Gluing the author's name into the string would have been shorter. This lesson shows why you must never do that, and what else <code>PreparedStatement</code> gives you.</p>
<h2>The attack</h2>
<p>A library search box sends whatever the user typed. A careless developer builds the query by concatenation:</p>
<pre><code class="language-java">// NEVER do this
String sql = "SELECT id, title FROM books WHERE author = '" + author + "'";
ResultSet rs = conn.createStatement().executeQuery(sql);</code></pre>
<p>With normal input such as <code>R. K. Narayan</code> it works. Now a curious student types this into the search box:</p>
<pre><code class="language-text">x' OR '1'='1</code></pre>
<p>The SQL that reaches the database becomes:</p>
<pre><code class="language-sql">SELECT id, title FROM books WHERE author = 'x' OR '1'='1'</code></pre>
<p>The condition is always true, so every book comes back. On a login form the same trick can skip the password check, and with a powerful database account an attacker can read other tables or change data. This is <strong>SQL injection</strong>, one of the most exploited web vulnerabilities for more than twenty years, and it is entirely preventable.</p>
<h2>The fix: parameters</h2>
<pre><code class="language-java">String sql = "SELECT id, title FROM books WHERE author = ?";
try (PreparedStatement ps = conn.prepareStatement(sql)) {
    ps.setString(1, author);
    try (ResultSet rs = ps.executeQuery()) {
        while (rs.next()) {
            System.out.println(rs.getString("title"));
        }
    }
}</code></pre>
<p>The SQL text and the values travel separately. The statement is parsed with a placeholder where the value goes, and whatever you pass to <code>setString</code> is treated purely as data. The input <code>x' OR '1'='1</code> is now just an odd author name that matches no book; quotes, semicolons and dashes in it lose any special meaning.</p>
<p>Use the setter that matches the column type: <code>setString</code>, <code>setInt</code>, <code>setLong</code>, <code>setBigDecimal</code> for money, <code>setObject(index, localDate)</code> for a <code>DATE</code> column, and <code>setNull(index, Types.INTEGER)</code> to store NULL.</p>
<h3>What a placeholder cannot do</h3>
<p>A <code>?</code> stands for a <em>value</em>, never for a table name, a column name or a keyword. <code>ORDER BY ?</code> does not sort by the column you pass. When users choose a sort column, check their choice against a fixed list in Java, for example a <code>switch</code> that maps <code>"title"</code> and <code>"author"</code> to known column names, and put only those known names into the SQL.</p>
<h2>Changing data with executeUpdate</h2>
<p>For <code>INSERT</code>, <code>UPDATE</code> and <code>DELETE</code>, call <code>executeUpdate()</code>. It returns the number of rows affected, and you should check it:</p>
<pre><code class="language-java">String sql = "UPDATE books SET available_copies = available_copies - 1 "
           + "WHERE id = ? AND available_copies &gt; 0";
try (PreparedStatement ps = conn.prepareStatement(sql)) {
    ps.setLong(1, bookId);
    int changed = ps.executeUpdate();
    if (changed == 0) {
        throw new IllegalStateException("No copy of book " + bookId + " is available");
    }
}</code></pre>
<p>Putting the availability check inside the <code>UPDATE</code> means two librarians issuing the last copy at the same moment cannot both succeed: the second update finds no row with copies left.</p>
<h3>Getting a generated key back</h3>
<pre><code class="language-java">String sql = "INSERT INTO books (title, author, isbn, available_copies) VALUES (?, ?, ?, ?)";
try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
    ps.setString(1, "The Guide");
    ps.setString(2, "R. K. Narayan");
    ps.setString(3, "9789300000042");
    ps.setInt(4, 2);
    ps.executeUpdate();
    try (ResultSet keys = ps.getGeneratedKeys()) {
        if (keys.next()) {
            System.out.println("New book id: " + keys.getLong(1));
        }
    }
}</code></pre>
<h3>Batches</h3>
<p>To insert hundreds of rows, set the parameters for each row, call <code>ps.addBatch()</code>, and finally <code>ps.executeBatch()</code>. One round trip for 500 rows is far faster than 500 round trips. With MySQL, add <code>rewriteBatchedStatements=true</code> to the connection URL to get the full benefit.</p>
<h2>Interview corner: Statement or PreparedStatement?</h2>
<table>
<thead><tr><th></th><th>Statement</th><th>PreparedStatement</th></tr></thead>
<tbody>
<tr><td>Values</td><td>Concatenated into the SQL text</td><td>Bound to <code>?</code> placeholders</td></tr>
<tr><td>SQL injection</td><td>Vulnerable when values come from users</td><td>Protected</td></tr>
<tr><td>Types</td><td>You format dates and numbers yourself</td><td>The driver converts Java types correctly</td></tr>
<tr><td>Reuse</td><td>Parsed again every time</td><td>Can be parsed once and run many times</td></tr>
</tbody>
</table>
<h2>Common mistakes</h2>
<ul>
<li>"Escaping" quotes by hand instead of using parameters. There is always an edge case you did not think of.</li>
<li>Quoting the placeholder: <code>WHERE author = '?'</code> searches for a literal question mark.</li>
<li>Ignoring the count returned by <code>executeUpdate()</code>.</li>
</ul>`,
          resources: [
            {
              title: 'Using Prepared Statements (The Java Tutorials)',
              url: 'https://docs.oracle.com/javase/tutorial/jdbc/basics/prepared.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Transactions in JDBC: issuing a book safely',
          minutes: 15,
          topic: 'Transactions',
          html: `<p>Issuing a library book takes two changes: one copy fewer on the shelf, and a new row in <code>loans</code>. If the second fails after the first succeeded, the library has lost a copy on paper. You met transactions in SQL; this lesson shows how to control them from Java.</p>
<h2>Two more tables</h2>
<pre><code class="language-sql">CREATE TABLE members (
  id    BIGINT AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE
);

CREATE TABLE loans (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  book_id     BIGINT NOT NULL,
  member_id   BIGINT NOT NULL,
  issued_on   DATE   NOT NULL,
  due_on      DATE   NOT NULL,
  returned_on DATE,
  FOREIGN KEY (book_id)   REFERENCES books (id),
  FOREIGN KEY (member_id) REFERENCES members (id)
);</code></pre>
<h2>Autocommit is on by default</h2>
<p>A new JDBC connection is in autocommit mode: every <code>executeUpdate</code> is committed the moment it finishes. To group statements, switch autocommit off, do the work, then commit or roll back yourself. The method below belongs to a class that holds a <code>DataSource</code>, a factory for connections that the next lesson explains:</p>
<pre><code class="language-java">public void issue(long bookId, long memberId) throws SQLException {
    String takeCopy = "UPDATE books SET available_copies = available_copies - 1 "
                    + "WHERE id = ? AND available_copies &gt; 0";
    String addLoan = "INSERT INTO loans (book_id, member_id, issued_on, due_on) VALUES (?, ?, ?, ?)";

    try (Connection conn = dataSource.getConnection()) {
        conn.setAutoCommit(false);
        try (PreparedStatement take = conn.prepareStatement(takeCopy);
             PreparedStatement loan = conn.prepareStatement(addLoan)) {

            take.setLong(1, bookId);
            if (take.executeUpdate() == 0) {
                throw new IllegalStateException("No copy of book " + bookId + " is available");
            }

            LocalDate today = LocalDate.now();
            loan.setLong(1, bookId);
            loan.setLong(2, memberId);
            loan.setObject(3, today);
            loan.setObject(4, today.plusDays(14));
            loan.executeUpdate();

            conn.commit();
        } catch (SQLException | RuntimeException e) {
            conn.rollback();
            throw e;
        }
    }
}</code></pre>
<p>Walk through the failure cases:</p>
<ul>
<li><strong>No copy left.</strong> The update changes 0 rows, the method throws, and the catch block rolls back (nothing had changed anyway) and rethrows.</li>
<li><strong>Member 99 does not exist.</strong> The insert fails on the foreign key, the catch block rolls back, and the copy taken a moment earlier is back on the shelf.</li>
<li><strong>Both succeed.</strong> <code>commit()</code> makes the changes permanent and visible to other users, together.</li>
</ul>
<h3>Why the catch block rethrows</h3>
<p>Swallowing the exception would hide the failure from the caller, which would then happily tell the member "Book issued!". Roll back to keep the data right, then let the exception travel up so the caller can show a proper message.</p>
<h2>Isolation from Java</h2>
<p><code>conn.setTransactionIsolation(Connection.TRANSACTION_SERIALIZABLE)</code> changes the isolation level for one connection. Most applications keep the database's default level and, like the code above, put the "is a copy available?" check inside the <code>UPDATE</code> itself, which is both simpler and safe under concurrent use.</p>
<h2>Savepoints</h2>
<p><code>Savepoint sp = conn.setSavepoint();</code> followed later by <code>conn.rollback(sp);</code> undoes only the work done after that point, the JDBC version of SQL's <code>SAVEPOINT</code>.</p>
<h2>Common mistakes</h2>
<ul>
<li>Forgetting <code>conn.commit()</code>. With autocommit off nothing is saved, and what happens to an uncommitted transaction when the connection closes depends on the driver. Never rely on it; commit or roll back explicitly.</li>
<li>Running the two statements on two different connections. A transaction belongs to one connection, so the second statement would not be part of it.</li>
<li>Calling something slow, such as an SMS or email service, while the transaction is open, holding row locks the whole time.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>The UPDATE succeeds and then the INSERT throws an SQLException. What does the books table look like afterwards?</summary><p>Unchanged. The catch block calls <code>rollback()</code>, which undoes the decrement, because both statements ran in the same uncommitted transaction.</p></details>`,
          resources: [
            {
              title: 'Using Transactions (The Java Tutorials)',
              url: 'https://docs.oracle.com/javase/tutorial/jdbc/basics/transactions.html',
            },
          ],
        },
        { kind: 'practice', question: 'java-finally', topic: 'Transactions' },
        {
          kind: 'article',
          title: 'Connection pools, DataSource and the DAO pattern',
          minutes: 15,
          topic: 'Beyond raw JDBC',
          html: `<p>Your JDBC code works, but a real service handles hundreds of requests a minute. Opening a fresh database connection for each one is slow, and repeating the same try-with-resources boilerplate in fifty methods invites mistakes. This lesson covers the two standard answers, connection pools and a clean data-access layer, and they lead straight to what Spring and JPA do for you.</p>
<h2>Why connections are expensive</h2>
<p>Opening a connection means a network handshake, authentication, often TLS encryption and the server setting up a session: easily tens of milliseconds. A query on an indexed column can take less than one millisecond. Opening a new connection per request means spending most of your time saying hello.</p>
<h2>Connection pools</h2>
<p>A <strong>connection pool</strong> opens a few connections at start-up and lends them out. When your code calls <code>close()</code> on a pooled connection, it is not really closed; it goes back to the pool for the next request. <strong>HikariCP</strong> is the pool Spring Boot uses by default.</p>
<pre><code class="language-java">HikariConfig config = new HikariConfig();
config.setJdbcUrl("jdbc:mysql://localhost:3306/library");
config.setUsername("library_app");
config.setPassword(System.getenv("LIBRARY_DB_PASSWORD"));
config.setMaximumPoolSize(10);

DataSource dataSource = new HikariDataSource(config);

try (Connection conn = dataSource.getConnection()) {   // borrowed from the pool
    // use it
}                                                       // returned to the pool</code></pre>
<p>Notice the type, <code>javax.sql.DataSource</code>. Code that asks a <code>DataSource</code> for connections neither knows nor cares whether it is pooled, which makes it easy to configure and to test. In Spring Boot you will not write the configuration above at all: you set the URL, user name and password as properties, and Boot builds the HikariCP <code>DataSource</code> for you.</p>
<h3>How big should the pool be?</h3>
<p>Smaller than you might think. A database can only do so much work at once, and a hundred connections fighting over the same CPU and disks are slower than ten taking turns. HikariCP's default of ten is a sensible start; change it only when measurements say so.</p>
<h2>The DAO pattern: keep SQL in one place</h2>
<p>JDBC code scattered across an application is hard to change and hard to test. A <strong>Data Access Object</strong> (DAO) puts all the SQL for one kind of data behind a small interface. Each type below lives in its own file:</p>
<pre><code class="language-java">public record Book(long id, String title, String author, String isbn, int availableCopies) {}

public interface BookDao {
    Optional&lt;Book&gt; findById(long id);
    List&lt;Book&gt; findByAuthor(String author);
}

public class JdbcBookDao implements BookDao {
    private static final String COLUMNS = "id, title, author, isbn, available_copies";
    private final DataSource dataSource;

    public JdbcBookDao(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public Optional&lt;Book&gt; findById(long id) {
        String sql = "SELECT " + COLUMNS + " FROM books WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(toBook(rs)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load book " + id, e);
        }
    }

    @Override
    public List&lt;Book&gt; findByAuthor(String author) {
        String sql = "SELECT " + COLUMNS + " FROM books WHERE author = ? ORDER BY title";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, author);
            try (ResultSet rs = ps.executeQuery()) {
                List&lt;Book&gt; books = new ArrayList&lt;&gt;();
                while (rs.next()) {
                    books.add(toBook(rs));
                }
                return books;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Could not search books by " + author, e);
        }
    }

    private static Book toBook(ResultSet rs) throws SQLException {
        return new Book(rs.getLong("id"), rs.getString("title"), rs.getString("author"),
                rs.getString("isbn"), rs.getInt("available_copies"));
    }
}</code></pre>
<p>Now look at what the rest of the application sees: <code>bookDao.findById(7)</code> returning an <code>Optional&lt;Book&gt;</code>. No SQL, no <code>ResultSet</code>, no checked exception. The <code>SQLException</code> is wrapped in an unchecked exception at the boundary, because a caller asking for a book can do nothing useful about a broken network connection except report it. Spring follows the same idea with its <code>DataAccessException</code> hierarchy.</p>
<h2>Where this is heading</h2>
<p>Read <code>JdbcBookDao</code> once more: borrow a connection, prepare a statement, set parameters, loop over rows, copy columns into an object, translate exceptions. Every DAO repeats that for every table. The rest of this course removes the repetition step by step:</p>
<ul>
<li><strong>Spring</strong> creates the <code>DataSource</code> and hands it to your classes (dependency injection, in the next module).</li>
<li><strong>JPA and Hibernate</strong> map rows to objects for you, and <strong>Spring Data JPA</strong> writes the DAO itself from an interface (the Persistence module).</li>
</ul>
<p>Because you have written the plain JDBC version, you will know what those tools do on your behalf, and what to check when they misbehave.</p>
<h2>Common mistakes</h2>
<ul>
<li>Creating a new pool for every request, which is worse than having no pool.</li>
<li>Keeping a borrowed connection in a field "to reuse it", so the pool runs dry.</li>
<li>Letting <code>SQLException</code> leak through every layer with <code>throws</code> clauses.</li>
</ul>`,
        },
      ],
    },
    {
      title: 'Structure',
      summary:
        "Organise a real Java project: Maven's layout, pom.xml and build lifecycle, Spring's container and dependency injection, and how Spring Boot starters, auto-configuration and profiles fit together.",
      lessons: [
        {
          kind: 'article',
          title: 'Maven: the standard layout, pom.xml and the build lifecycle',
          minutes: 16,
          topic: 'Maven',
          html: `<p>In college you probably compiled Java with <code>javac</code> and downloaded jars by hand. That stops working the day your project needs thirty libraries, each with dependencies of its own, and five teammates who must all build it the same way. <strong>Maven</strong> is the build tool that solves this, and it is the default in a large share of Java projects in Indian IT companies. (Gradle is the other common choice; the ideas carry over.)</p>
<h2>The standard directory layout</h2>
<p>Maven expects files in fixed places, so every Maven project looks the same and you can find your way around a new one on your first day:</p>
<pre><code class="language-text">library-api/
├── pom.xml                              the project description
├── mvnw, mvnw.cmd, .mvn/                the Maven Wrapper
├── src/
│   ├── main/
│   │   ├── java/com/college/library/    application code
│   │   └── resources/                   application.properties and other files
│   └── test/
│       ├── java/com/college/library/    tests
│       └── resources/                   test-only configuration
└── target/                              build output: never commit it</code></pre>
<p>Package names follow the folders: a class in <code>src/main/java/com/college/library/</code> starts with <code>package com.college.library;</code>. Tests live in the same package under <code>src/test/java</code>, so they can reach package-private classes, but they never end up in the jar you ship.</p>
<h2>pom.xml: the project in one file</h2>
<pre><code class="language-xml">&lt;project xmlns="http://maven.apache.org/POM/4.0.0"&gt;
  &lt;modelVersion&gt;4.0.0&lt;/modelVersion&gt;

  &lt;groupId&gt;com.college&lt;/groupId&gt;
  &lt;artifactId&gt;library-api&lt;/artifactId&gt;
  &lt;version&gt;0.0.1-SNAPSHOT&lt;/version&gt;

  &lt;properties&gt;
    &lt;maven.compiler.release&gt;21&lt;/maven.compiler.release&gt;
  &lt;/properties&gt;

  &lt;dependencies&gt;
    &lt;dependency&gt;
      &lt;groupId&gt;com.mysql&lt;/groupId&gt;
      &lt;artifactId&gt;mysql-connector-j&lt;/artifactId&gt;
      &lt;version&gt;8.4.0&lt;/version&gt;
      &lt;scope&gt;runtime&lt;/scope&gt;
    &lt;/dependency&gt;
    &lt;dependency&gt;
      &lt;groupId&gt;org.junit.jupiter&lt;/groupId&gt;
      &lt;artifactId&gt;junit-jupiter&lt;/artifactId&gt;
      &lt;version&gt;5.11.0&lt;/version&gt;
      &lt;scope&gt;test&lt;/scope&gt;
    &lt;/dependency&gt;
  &lt;/dependencies&gt;
&lt;/project&gt;</code></pre>
<ul>
<li><strong>groupId, artifactId and version</strong>, together called the <em>coordinates</em>, identify your project, just as <code>com.mysql:mysql-connector-j:8.4.0</code> identifies the driver. <code>SNAPSHOT</code> means "work in progress"; a release drops it.</li>
<li><strong>dependencies</strong> lists the libraries you need. Maven downloads them from Maven Central into a local cache in <code>~/.m2/repository</code>, together with the libraries <em>they</em> need, called transitive dependencies.</li>
<li><strong>scope</strong> says where a dependency is needed: <code>compile</code>, the default, means everywhere; <code>runtime</code> means to run but not to compile, like a JDBC driver; <code>test</code> means only for tests, like JUnit; <code>provided</code> means the server supplies it at run time.</li>
</ul>
<h2>The build lifecycle</h2>
<p>Maven builds in a fixed sequence of <strong>phases</strong>, and asking for one phase runs every phase before it:</p>
<table>
<thead><tr><th>Phase</th><th>What happens</th></tr></thead>
<tbody>
<tr><td>validate</td><td>Checks that the project definition is correct</td></tr>
<tr><td>compile</td><td>Compiles <code>src/main/java</code> into <code>target/classes</code></td></tr>
<tr><td>test</td><td>Compiles and runs the tests in <code>src/test/java</code></td></tr>
<tr><td>package</td><td>Builds the jar (or war) in <code>target/</code></td></tr>
<tr><td>verify</td><td>Runs further checks, such as integration tests</td></tr>
<tr><td>install</td><td>Copies the jar into your local <code>~/.m2</code> cache for other projects on your machine</td></tr>
<tr><td>deploy</td><td>Uploads it to a shared repository</td></tr>
</tbody>
</table>
<p>So <code>mvn package</code> compiles, runs every test and builds the jar, and if a test fails there is no jar. <code>mvn clean package</code> deletes <code>target/</code> first, so nothing stale survives. Use <code>-DskipTests</code> only with a real reason, never to make a red build look green.</p>
<h2>The Maven Wrapper</h2>
<p>Projects generated by Spring Initializr include <code>mvnw</code> (Linux and macOS) and <code>mvnw.cmd</code> (Windows). Running <code>./mvnw clean package</code> downloads the exact Maven version the project expects, so every developer and the CI server build the same way. Commit the wrapper files with the project.</p>
<h2>Commands you will use every week</h2>
<pre><code class="language-text">./mvnw clean package       build from scratch, running the tests
./mvnw test                run just the tests
./mvnw dependency:tree     show every dependency and who brought it in
./mvnw spring-boot:run     run a Spring Boot application (later lessons)</code></pre>
<p><code>dependency:tree</code> is the tool for the classic problem of two libraries wanting different versions of a third. Maven picks the version declared nearest to your project in that tree, which is not always the newest one.</p>
<h2>Common mistakes</h2>
<ul>
<li>Committing <code>target/</code> or downloaded jars to Git. Add <code>target/</code> to <code>.gitignore</code>; Maven rebuilds it.</li>
<li>Leaving test libraries in the default scope, so they ship inside your production jar.</li>
<li>Putting source files outside <code>src/main/java</code>; Maven will not compile them.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>You run mvn package. Which of the phases in the table run?</summary><p>validate, compile, test and package, in that order. verify, install and deploy do not run.</p></details>`,
          resources: [
            {
              title: 'Maven in 5 Minutes and Getting Started',
              url: 'https://maven.apache.org/guides/getting-started/',
            },
            {
              title: 'Introduction to the Build Lifecycle',
              url: 'https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html',
            },
            {
              title: 'Introduction to the Standard Directory Layout',
              url: 'https://maven.apache.org/guides/introduction/introduction-to-the-standard-directory-layout.html',
            },
          ],
        },
        {
          kind: 'article',
          title: "Spring's container: beans and dependency injection",
          minutes: 18,
          topic: 'Spring core',
          html: `<p>In the JDBC module, <code>JdbcBookDao</code> received its <code>DataSource</code> through its constructor instead of creating one. That small decision is the heart of the Spring Framework. This lesson explains <strong>dependency injection</strong> and <strong>inversion of control</strong>, the ideas behind every Spring application and a near-certain interview topic.</p>
<h2>The problem: classes that build their own dependencies</h2>
<pre><code class="language-java">public class LoanService {
    // LoanService decides for itself which implementations it uses
    private final BookDao books = new JdbcBookDao(DataSources.production());
    private final Notifier notifier = new SmsNotifier();
}</code></pre>
<p>This works, but <code>LoanService</code> now controls too much. To test it you need the production database, and every test run sends real SMS messages. Switching to email means editing and re-testing <code>LoanService</code>. And every class that needs a <code>BookDao</code> builds its own, each with its own connection pool.</p>
<h2>The fix: ask for what you need</h2>
<pre><code class="language-java">public interface Notifier {
    void send(String to, String message);
}

public class LoanService {
    private final BookDao books;
    private final Notifier notifier;

    public LoanService(BookDao books, Notifier notifier) {
        this.books = books;
        this.notifier = notifier;
    }
}</code></pre>
<p>Now <code>LoanService</code> declares what it depends on and lets somebody else supply it. A test passes an in-memory <code>BookDao</code> and a fake <code>Notifier</code> that just records messages; production passes the JDBC version and a real SMS sender. <code>LoanService</code> itself never changes. That is <strong>dependency injection</strong> (DI): dependencies are handed in from outside rather than created inside. The broader principle, that a framework rather than your own code controls how objects are created and connected, is called <strong>inversion of control</strong> (IoC).</p>
<h2>The Spring container</h2>
<p>Someone still has to create the objects in the right order and pass them in. In Spring, that is the <strong>application context</strong>, also called the IoC container, and the objects it manages are called <strong>beans</strong>. You mark your classes as beans with annotations:</p>
<pre><code class="language-java">@Repository
public class JdbcBookDao implements BookDao {
    private final DataSource dataSource;

    public JdbcBookDao(DataSource dataSource) {
        this.dataSource = dataSource;
    }
    // findById and findByAuthor as in the JDBC module
}

@Component
public class SmsNotifier implements Notifier {
    @Override
    public void send(String to, String message) {
        // call the SMS provider's API
    }
}

@Service
public class LoanService {
    private final BookDao books;
    private final Notifier notifier;

    public LoanService(BookDao books, Notifier notifier) {
        this.books = books;
        this.notifier = notifier;
    }
}</code></pre>
<p>At start-up Spring scans your packages, finds these classes and works out an order: it needs a <code>DataSource</code> to build <code>JdbcBookDao</code>, and a <code>BookDao</code> and a <code>Notifier</code> to build <code>LoanService</code>. It matches by type, so <code>LoanService</code> receives whichever bean implements <code>BookDao</code>. When a class has a single constructor, Spring uses it automatically; no <code>@Autowired</code> is needed.</p>
<p><code>@Component</code> is the general-purpose annotation. <code>@Service</code>, <code>@Repository</code> and <code>@Controller</code> are specialised forms that also document the class's role, and <code>@Repository</code> additionally marks the class for Spring's translation of persistence exceptions (such as JPA's) into its own <code>DataAccessException</code> hierarchy.</p>
<h3>Beans you declare yourself: @Configuration and @Bean</h3>
<p>You cannot put <code>@Component</code> on a class from a library. For those, write a factory method in a configuration class:</p>
<pre><code class="language-java">@Configuration
public class TimeConfig {
    @Bean
    public Clock clock() {
        return Clock.system(ZoneId.of("Asia/Kolkata"));
    }
}</code></pre>
<p>Any bean can now ask for a <code>Clock</code> in its constructor. Injecting the clock instead of calling <code>LocalDate.now()</code> directly lets a test fix "today" to a known date, which matters a lot when you test due dates and fines.</p>
<h2>Two implementations of one interface</h2>
<p>Add an <code>EmailNotifier</code> next to <code>SmsNotifier</code> and Spring finds two <code>Notifier</code> beans; start-up fails with a message that it expected a single matching bean but found 2. Tell it which one to use: mark one class <code>@Primary</code>, or put <code>@Qualifier("emailNotifier")</code> on the constructor parameter. A bean's default name is its class name with a lower-case first letter.</p>
<h2>Scope: one shared instance</h2>
<p>By default every bean is a <strong>singleton</strong>: Spring creates one instance and shares it with everyone who asks, including every web request running at the same moment. The consequence matters: <strong>never keep per-request or per-user data in a bean's fields</strong>. A field such as <code>private Member currentMember;</code> in <code>LoanService</code> would be shared, and overwritten, across all users at once. Keep beans stateless and pass request data as method parameters. Other scopes exist (<code>prototype</code> creates a new instance for each injection; web applications add <code>request</code> and <code>session</code>), but you will rarely need them.</p>
<h2>Constructor injection, not field injection</h2>
<p>Older code often writes <code>@Autowired private BookDao books;</code>. It works, but prefer constructors, as above. The fields can be <code>final</code>, the dependencies are listed in one place, the object can never exist half-built, and a plain unit test can create it with <code>new LoanService(fakeDao, fakeNotifier)</code> without starting Spring. A constructor that needs seven parameters is also a useful warning that the class is doing too much.</p>
<h2>Common mistakes</h2>
<ul>
<li>Creating a bean yourself with <code>new</code> inside another bean. Spring does not manage that object, so nothing is injected into it.</li>
<li>Placing a class outside the packages Spring scans, then seeing "No qualifying bean of type" at start-up.</li>
<li>Storing request data in the fields of a singleton bean.</li>
</ul>`,
          resources: [
            {
              title: 'Spring Framework: The IoC Container',
              url: 'https://docs.spring.io/spring-framework/reference/core/beans.html',
            },
          ],
        },
        { kind: 'practice', question: 'spring-dependency-injection', topic: 'Spring core' },
        {
          kind: 'article',
          title: 'Spring Boot: starters, auto-configuration and the main class',
          minutes: 16,
          topic: 'Spring Boot',
          html: `<p>Plain Spring gives you the container, but setting up a web application by hand used to mean pages of configuration: the web server, JSON conversion, the connection pool, transaction management, logging. <strong>Spring Boot</strong> removes that set-up work. You choose what you need, Boot configures sensible defaults, and you override only what is different. Nearly every new Spring project today is a Spring Boot project.</p>
<h2>Creating the project</h2>
<p>Use Spring Initializr at start.spring.io, or the new-project wizard in IntelliJ IDEA, which uses it behind the scenes. For the library API choose:</p>
<ul>
<li>Project Maven, language Java, the latest stable Spring Boot 3 release and Java 21.</li>
<li>Group <code>com.college</code>, artifact <code>library-api</code>.</li>
<li>Dependencies: <strong>Spring Web</strong>, <strong>Spring Data JPA</strong>, <strong>Validation</strong>, <strong>MySQL Driver</strong> (or PostgreSQL Driver) and <strong>H2 Database</strong> for quick local runs.</li>
</ul>
<h2>Starters: dependencies chosen for you</h2>
<p>Open the generated <code>pom.xml</code> (your Boot version number may be newer):</p>
<pre><code class="language-xml">&lt;parent&gt;
  &lt;groupId&gt;org.springframework.boot&lt;/groupId&gt;
  &lt;artifactId&gt;spring-boot-starter-parent&lt;/artifactId&gt;
  &lt;version&gt;3.5.0&lt;/version&gt;
&lt;/parent&gt;

&lt;dependencies&gt;
  &lt;dependency&gt;
    &lt;groupId&gt;org.springframework.boot&lt;/groupId&gt;
    &lt;artifactId&gt;spring-boot-starter-web&lt;/artifactId&gt;
  &lt;/dependency&gt;
  &lt;dependency&gt;
    &lt;groupId&gt;org.springframework.boot&lt;/groupId&gt;
    &lt;artifactId&gt;spring-boot-starter-data-jpa&lt;/artifactId&gt;
  &lt;/dependency&gt;
  &lt;dependency&gt;
    &lt;groupId&gt;org.springframework.boot&lt;/groupId&gt;
    &lt;artifactId&gt;spring-boot-starter-validation&lt;/artifactId&gt;
  &lt;/dependency&gt;
  &lt;dependency&gt;
    &lt;groupId&gt;com.mysql&lt;/groupId&gt;
    &lt;artifactId&gt;mysql-connector-j&lt;/artifactId&gt;
    &lt;scope&gt;runtime&lt;/scope&gt;
  &lt;/dependency&gt;
  &lt;dependency&gt;
    &lt;groupId&gt;com.h2database&lt;/groupId&gt;
    &lt;artifactId&gt;h2&lt;/artifactId&gt;
    &lt;scope&gt;runtime&lt;/scope&gt;
  &lt;/dependency&gt;
  &lt;dependency&gt;
    &lt;groupId&gt;org.springframework.boot&lt;/groupId&gt;
    &lt;artifactId&gt;spring-boot-starter-test&lt;/artifactId&gt;
    &lt;scope&gt;test&lt;/scope&gt;
  &lt;/dependency&gt;
&lt;/dependencies&gt;</code></pre>
<p>Two things stand out. First, most dependencies have no version: the parent manages a tested, compatible set, so you upgrade Spring Boot in one place and everything moves together. Second, the <strong>starters</strong>. A starter is a curated bundle of dependencies for one job:</p>
<ul>
<li><code>spring-boot-starter-web</code>: Spring MVC, an embedded Tomcat server and Jackson for JSON.</li>
<li><code>spring-boot-starter-data-jpa</code>: Hibernate, Spring Data JPA and the HikariCP connection pool.</li>
<li><code>spring-boot-starter-validation</code>: Hibernate Validator, for Bean Validation annotations.</li>
<li><code>spring-boot-starter-test</code>: JUnit 5, Mockito, AssertJ and Spring's test support.</li>
</ul>
<h2>The main class</h2>
<pre><code class="language-java">package com.college.library;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class LibraryApiApplication {
    public static void main(String[] args) {
        SpringApplication.run(LibraryApiApplication.class, args);
    }
}</code></pre>
<p><code>@SpringBootApplication</code> combines three annotations:</p>
<ul>
<li><code>@SpringBootConfiguration</code>: this class is a configuration class, so it may declare <code>@Bean</code> methods.</li>
<li><code>@ComponentScan</code>: scan this package <em>and its sub-packages</em> for beans. Keep the main class in the root package, <code>com.college.library</code>, so everything below it is found.</li>
<li><code>@EnableAutoConfiguration</code>: switch on auto-configuration.</li>
</ul>
<h2>Auto-configuration: defaults you can override</h2>
<p>Auto-configuration looks at what is on the classpath and what you have configured, then creates the beans you did not declare. Tomcat on the classpath? Start an embedded web server on port 8080. A JDBC driver and a database URL? Build a HikariCP <code>DataSource</code>. JPA present? Set up Hibernate and transaction management. Each piece steps back when you define that bean yourself, so a default is never forced on you. To see the decisions, start the application with the <code>--debug</code> argument: Boot prints a report of which auto-configurations applied and why.</p>
<h2>Running it</h2>
<pre><code class="language-text">./mvnw spring-boot:run                             run from the source code
./mvnw clean package                               build target/library-api-0.0.1-SNAPSHOT.jar
java -jar target/library-api-0.0.1-SNAPSHOT.jar    run the jar on any machine with Java 21</code></pre>
<p>The jar is self-contained: your code, every dependency and the embedded Tomcat. No separate server installation is needed, which is a large part of why Spring Boot suits cloud deployment.</p>
<h2>A package layout that grows well</h2>
<p>Small projects often split packages by layer: <code>controller</code>, <code>service</code>, <code>repository</code>, <code>model</code>. As a project grows, many teams prefer to group by feature (<code>book</code>, <code>member</code>, <code>loan</code>), each package holding its own controller, service and repository. Either works; be consistent, and keep everything under the main class's package.</p>
<h2>Common mistakes</h2>
<ul>
<li>Putting the main class in a sub-package such as <code>com.college.library.app</code>, so beans in <code>com.college.library.book</code> are never scanned.</li>
<li>Adding versions to Boot-managed dependencies "to be safe" and ending up with an incompatible mix.</li>
<li>Adding the JPA starter with no database configured and none on the classpath: start-up fails because Boot cannot build a <code>DataSource</code>.</li>
</ul>`,
          resources: [
            {
              title: 'Spring Boot documentation',
              url: 'https://docs.spring.io/spring-boot/index.html',
            },
            { title: 'Spring guides', url: 'https://spring.io/guides' },
          ],
        },
        { kind: 'practice', question: 'spring-boot-starter', topic: 'Spring Boot' },
        {
          kind: 'article',
          title: 'Configuration, profiles and keeping secrets out of the code',
          minutes: 16,
          topic: 'Configuration',
          html: `<p>The same jar must run on your laptop against an in-memory database, on a test server, and in production against the real database. The code does not change; the <strong>configuration</strong> does. Spring Boot reads settings from several places, groups them into <strong>profiles</strong>, and gives you a clean way to keep passwords out of Git.</p>
<h2>application.properties</h2>
<p>At start-up Boot reads <code>src/main/resources/application.properties</code>. Boot's own settings and your application's settings live side by side:</p>
<pre><code class="language-properties">spring.application.name=library-api
server.port=8080

# the library's own rules
library.loan-days=14
library.max-loans-per-member=3</code></pre>
<p>Boot documents hundreds of its own properties (<code>server.*</code>, <code>spring.datasource.*</code>, <code>spring.jpa.*</code>, <code>logging.*</code>), and IntelliJ IDEA autocompletes them. The <code>library.*</code> keys are yours. The same settings can be written as YAML in <code>application.yml</code>; choose one format per project.</p>
<h2>Reading your own settings</h2>
<p>For a single value, use <code>@Value</code> on a constructor parameter, with a default after the colon:</p>
<pre><code class="language-java">@Component
public class DueDateCalculator {
    private final int loanDays;

    public DueDateCalculator(@Value("\${library.loan-days:14}") int loanDays) {
        this.loanDays = loanDays;
    }

    public LocalDate dueDate(LocalDate issuedOn) {
        return issuedOn.plusDays(loanDays);
    }
}</code></pre>
<p>For a group of settings, a typed record is cleaner:</p>
<pre><code class="language-java">@ConfigurationProperties(prefix = "library")
public record LibraryProperties(int loanDays, int maxLoansPerMember) {}</code></pre>
<p>Add <code>@ConfigurationPropertiesScan</code> next to <code>@SpringBootApplication</code> on the main class, and Boot creates a <code>LibraryProperties</code> bean that any service can take in its constructor. Boot matches <code>loan-days</code> to <code>loanDays</code> and <code>max-loans-per-member</code> to <code>maxLoansPerMember</code>; this flexible matching is called <strong>relaxed binding</strong>. A mistake such as <code>library.loan-days=fourteen</code> now stops the application at start-up, not in the middle of a member's request.</p>
<h2>Profiles: settings per environment</h2>
<p>Add one file per environment, named <code>application-</code> followed by the profile name:</p>
<pre><code class="language-properties"># application-dev.properties
spring.datasource.url=jdbc:h2:mem:library
spring.jpa.show-sql=true</code></pre>
<pre><code class="language-properties"># application-prod.properties
spring.datasource.url=jdbc:mysql://db.internal:3306/library
spring.datasource.username=library_app
spring.datasource.password=\${LIBRARY_DB_PASSWORD}
spring.jpa.hibernate.ddl-auto=validate
logging.level.root=WARN</code></pre>
<p>Activate a profile when you start the application, with <code>--spring.profiles.active=prod</code> on the command line or the environment variable <code>SPRING_PROFILES_ACTIVE=prod</code>. The profile's file is read on top of <code>application.properties</code>, and its values win wherever both files set the same key.</p>
<h3>Placeholders keep secrets out of the repository</h3>
<p><code>\${LIBRARY_DB_PASSWORD}</code> is a placeholder: at start-up Boot replaces it with the environment variable of that name. The file can be committed, because the password is not in it; on the server, the deployment platform or a secret store sets the variable. If the variable is missing, the application refuses to start with a clear message, which is far better than starting without a password.</p>
<h3>Beans per profile</h3>
<p>Profiles can switch beans too. On your laptop you do not want to send real SMS messages, so give the <code>Notifier</code> from the previous lessons two implementations:</p>
<pre><code class="language-java">@Component
@Profile("!prod")
public class LogNotifier implements Notifier {
    private static final Logger log = LoggerFactory.getLogger(LogNotifier.class);

    @Override
    public void send(String to, String message) {
        log.info("SMS to {}: {}", to, message);
    }
}

@Component
@Profile("prod")
public class SmsNotifier implements Notifier {
    @Override
    public void send(String to, String message) {
        // call the SMS provider's API
    }
}</code></pre>
<p><code>"!prod"</code> means "any profile except prod", so development and tests get the logging version, and exactly one <code>Notifier</code> exists wherever the application runs.</p>
<h2>Where settings come from, and which wins</h2>
<p>Boot merges settings from many sources. From strongest to weakest, the ones you will use most are:</p>
<ol>
<li>command-line arguments, such as <code>--server.port=9090</code>;</li>
<li>environment variables, such as <code>SERVER_PORT=9090</code> (upper case, with underscores for the dots);</li>
<li>profile files, such as <code>application-prod.properties</code>;</li>
<li><code>application.properties</code>.</li>
</ol>
<p>So the operations team can override any setting on a server without rebuilding the jar.</p>
<h2>Common mistakes</h2>
<ul>
<li>Committing a real password "just for now". Git keeps history: once pushed, treat it as leaked and change it.</li>
<li>Copying every setting into every profile file. Keep shared settings in <code>application.properties</code> and only the differences in the profile files.</li>
<li>Misspelling a property, such as <code>spring.datasource.ur1</code>. Unknown keys are silently ignored, so rely on your IDE's autocompletion.</li>
</ul>`,
          resources: [
            {
              title: 'Spring Boot: Externalized Configuration',
              url: 'https://docs.spring.io/spring-boot/reference/features/external-config.html',
            },
            {
              title: 'Spring Boot: Profiles',
              url: 'https://docs.spring.io/spring-boot/reference/features/profiles.html',
            },
          ],
        },
        { kind: 'practice', question: 'spring-profiles', topic: 'Configuration' },
      ],
    },
    {
      title: 'Persistence',
      summary:
        'Map Java classes to tables with Jakarta Persistence and Hibernate, query them through Spring Data JPA repositories, model relationships without N + 1 queries, and keep changes consistent with @Transactional.',
      lessons: [
        {
          kind: 'article',
          title: 'Entities with Jakarta Persistence: mapping a class to a table',
          minutes: 18,
          topic: 'Entities',
          html: `<p>In the JDBC module you copied every column into a Java object by hand, and back again for every insert. <strong>Object-relational mapping</strong> (ORM) automates that: you describe once how a class maps to a table, and the ORM writes the SQL. In Java the standard for this is <strong>Jakarta Persistence</strong> (JPA), and its most widely used implementation is <strong>Hibernate</strong>.</p>
<h2>Three names, three layers</h2>
<table>
<thead><tr><th>Name</th><th>What it is</th></tr></thead>
<tbody>
<tr><td>Jakarta Persistence (JPA)</td><td>A specification: annotations such as <code>@Entity</code> and interfaces such as <code>EntityManager</code>, in the <code>jakarta.persistence</code> package</td></tr>
<tr><td>Hibernate ORM</td><td>An implementation of that specification, which actually generates and runs the SQL</td></tr>
<tr><td>Spring Data JPA</td><td>A Spring library on top of JPA that writes repository classes for you (next lesson)</td></tr>
</tbody>
</table>
<p>Spring Boot 3 uses the <code>jakarta.persistence</code> package. Older tutorials import <code>javax.persistence</code>, from the days of Java EE; those imports do not compile in a Boot 3 project. If an interviewer asks how JPA and Hibernate differ, the short answer is: JPA is the contract, Hibernate is one implementation of it.</p>
<h2>Your first entity</h2>
<pre><code class="language-java">package com.college.library.book;

import jakarta.persistence.*;

@Entity
@Table(name = "books")
public class Book {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 120)
    private String author;

    @Column(nullable = false, unique = true, length = 13)
    private String isbn;

    @Column(name = "available_copies", nullable = false)
    private int availableCopies;

    protected Book() {
        // required by JPA
    }

    public Book(String title, String author, String isbn, int availableCopies) {
        this.title = title;
        this.author = author;
        this.isbn = isbn;
        this.availableCopies = availableCopies;
    }

    public void takeCopy() {
        if (availableCopies == 0) {
            throw new NoCopyAvailableException(isbn);
        }
        availableCopies--;
    }

    public void returnCopy() {
        availableCopies++;
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getAuthor() { return author; }
    public String getIsbn() { return isbn; }
    public int getAvailableCopies() { return availableCopies; }
}</code></pre>
<p><code>NoCopyAvailableException</code> is a small <code>RuntimeException</code> of your own; the web-tier module turns it into an HTTP 409. What each annotation does:</p>
<ul>
<li><code>@Entity</code> marks the class as persistent, and <code>@Table</code> names the table. Without <code>@Table</code>, Boot would derive the name <code>book</code> from the class.</li>
<li><code>@Id</code> marks the primary key, and <code>@GeneratedValue(strategy = GenerationType.IDENTITY)</code> lets the database generate it with its auto-increment or identity column. The id stays <code>null</code> until the entity is saved.</li>
<li><code>@Column</code> sets the column name and constraints. Spring Boot already turns <code>availableCopies</code> into <code>available_copies</code>, so <code>name</code> is optional here; writing it makes the mapping obvious.</li>
</ul>
<h3>The rules an entity must follow</h3>
<ul>
<li>It needs a constructor without arguments, at least <code>protected</code>, because Hibernate creates the object before filling in its fields. Keeping that constructor protected stops your own code from creating empty, invalid books.</li>
<li>The class must not be <code>final</code>, because Hibernate creates subclasses (proxies) for lazy loading. For the same reason a <code>record</code> cannot be an entity; records are perfect for DTOs instead.</li>
<li>Behaviour such as <code>takeCopy()</code> is welcome. An entity with nothing but getters and setters pushes all its rules into other classes, where they are easier to forget.</li>
</ul>
<h2>The persistence context: managed objects</h2>
<p>JPA does not run a SQL statement every time you touch an object. Inside a transaction, the entities you load or save are <strong>managed</strong> by a <em>persistence context</em> (Hibernate calls it the session). Two of its behaviours surprise newcomers:</p>
<ul>
<li><strong>Identity:</strong> loading book 7 twice in the same transaction gives you the same Java object, after a single SELECT.</li>
<li><strong>Dirty checking:</strong> when the transaction commits, Hibernate compares each managed entity with the state it loaded and writes an <code>UPDATE</code> for whatever changed. You call <code>book.takeCopy()</code>, write no SQL and no <code>save</code>, and the new copy count still reaches the database at commit.</li>
</ul>
<p>An entity is <em>new</em> after <code>new Book(...)</code>, <em>managed</em> once it has been saved or loaded inside a persistence context, <em>detached</em> after that context closes (changes are no longer tracked), and <em>removed</em> once it is scheduled for deletion.</p>
<h2>Who creates the tables?</h2>
<p>The property <code>spring.jpa.hibernate.ddl-auto</code> decides whether Hibernate touches the schema:</p>
<table>
<thead><tr><th>Value</th><th>What it does</th><th>Use it for</th></tr></thead>
<tbody>
<tr><td><code>create-drop</code></td><td>Creates tables at start-up and drops them at shutdown</td><td>Tests and experiments (Boot's default for an embedded database such as H2)</td></tr>
<tr><td><code>update</code></td><td>Adds missing tables and columns; never removes anything</td><td>Personal prototypes only</td></tr>
<tr><td><code>validate</code></td><td>Checks that tables match the entities; changes nothing</td><td>Production, alongside a migration tool</td></tr>
<tr><td><code>none</code></td><td>Does nothing</td><td>Production (Boot's default for a real database)</td></tr>
</tbody>
</table>
<p>In real projects the schema is changed by versioned migration scripts, using a tool such as Flyway or Liquibase, so every change is reviewed like code. Letting <code>update</code> alter a production database is a reliable way to lose a weekend.</p>
<h2>Common mistakes</h2>
<ul>
<li>Importing <code>javax.persistence</code> in a Spring Boot 3 project.</li>
<li>Forgetting the no-argument constructor, which fails with "No default constructor for entity".</li>
<li>Making an entity <code>final</code>, or trying to use a record as an entity.</li>
<li>Calling <code>save</code> after every setter "to be sure", not knowing that dirty checking already saves managed entities.</li>
</ul>`,
          resources: [
            {
              title: 'Hibernate ORM documentation',
              url: 'https://hibernate.org/orm/documentation/',
            },
            {
              title: 'Accessing Data with JPA (Spring guide)',
              url: 'https://spring.io/guides/gs/accessing-data-jpa',
            },
          ],
        },
        { kind: 'practice', question: 'jpa-entity-id', topic: 'Entities' },
        {
          kind: 'article',
          title: 'Spring Data JPA repositories: CRUD, derived queries and @Query',
          minutes: 16,
          topic: 'Repositories',
          html: `<p>Remember the <code>JdbcBookDao</code> you wrote by hand: about fifty lines for two queries. With Spring Data JPA you write an <em>interface</em>, and Spring generates the implementation at start-up.</p>
<h2>A repository in three lines</h2>
<pre><code class="language-java">public interface BookRepository extends JpaRepository&lt;Book, Long&gt; {
}</code></pre>
<p>The type parameters are the entity and the type of its id. Without writing a single method you already have:</p>
<table>
<thead><tr><th>Method</th><th>What it does</th></tr></thead>
<tbody>
<tr><td><code>save(book)</code></td><td>Inserts a new entity or updates an existing one, and returns it with its generated id</td></tr>
<tr><td><code>findById(id)</code></td><td>Returns an <code>Optional&lt;Book&gt;</code>, empty if there is no such row</td></tr>
<tr><td><code>findAll()</code>, <code>findAll(pageable)</code></td><td>Every row, or one page of rows</td></tr>
<tr><td><code>existsById(id)</code>, <code>count()</code></td><td>Cheap checks</td></tr>
<tr><td><code>deleteById(id)</code>, <code>delete(book)</code></td><td>Removes a row</td></tr>
</tbody>
</table>
<p>Inject it like any other bean:</p>
<pre><code class="language-java">@Service
public class BookService {
    private final BookRepository books;

    public BookService(BookRepository books) {
        this.books = books;
    }

    public Book find(long id) {
        return books.findById(id).orElseThrow(() -&gt; new BookNotFoundException(id));
    }
}</code></pre>
<p><code>findById</code> returns an <code>Optional</code> on purpose: the type itself says the book may not exist, so you must decide what happens then. Here the answer is a <code>BookNotFoundException</code>, which the web tier turns into a 404.</p>
<h2>Derived queries: the method name is the query</h2>
<p>Declare a method that follows a naming convention, and Spring Data builds the query from its name:</p>
<pre><code class="language-java">public interface BookRepository extends JpaRepository&lt;Book, Long&gt; {

    Optional&lt;Book&gt; findByIsbn(String isbn);

    List&lt;Book&gt; findByAuthorOrderByTitleAsc(String author);

    List&lt;Book&gt; findByTitleContainingIgnoreCase(String fragment);

    List&lt;Book&gt; findByAvailableCopiesGreaterThan(int copies);

    boolean existsByIsbn(String isbn);

    long countByAuthor(String author);
}</code></pre>
<p>The parser reads <code>findBy</code>, <code>existsBy</code> or <code>countBy</code>, then entity property names joined by keywords such as <code>And</code>, <code>Or</code>, <code>Containing</code>, <code>IgnoreCase</code>, <code>GreaterThan</code>, <code>Between</code>, <code>IsNull</code> and <code>OrderBy</code>. <code>findByTitleContainingIgnoreCase("guide")</code> becomes, roughly, <code>WHERE UPPER(title) LIKE UPPER('%guide%')</code>. Misspell a property, as in <code>findByAuthr</code>, and the application refuses to start, which is much better than discovering it in production.</p>
<h2>@Query: when the name gets too long</h2>
<p>Derived names are great for simple filters and unreadable for complicated ones. For those, write the query yourself in <strong>JPQL</strong>, JPA's query language, which talks about entities and their fields rather than tables and columns:</p>
<pre><code class="language-java">@Query("""
       select b from Book b
       where b.availableCopies = 0
         and lower(b.author) = lower(:author)
       order by b.title
       """)
List&lt;Book&gt; findUnavailableByAuthor(@Param("author") String author);</code></pre>
<p>Notice <code>Book</code> and <code>availableCopies</code>: class and field names, not <code>books</code> and <code>available_copies</code>. Named parameters such as <code>:author</code> are bound safely, just like JDBC's <code>?</code>, so there is no injection risk. When you need database-specific SQL, <code>@Query(value = "...", nativeQuery = true)</code> runs plain SQL instead.</p>
<h2>Paging and sorting</h2>
<pre><code class="language-java">Page&lt;Book&gt; page = books.findAll(PageRequest.of(0, 20, Sort.by("title")));
List&lt;Book&gt; firstTwenty = page.getContent();
long allBooks = page.getTotalElements();</code></pre>
<p>Pages are numbered from 0. Spring Data adds the <code>LIMIT</code> and <code>OFFSET</code>, and runs a second <code>COUNT</code> query for the total. Any repository method can accept a <code>Pageable</code>, for example <code>Page&lt;Book&gt; findByAuthor(String author, Pageable pageable)</code>.</p>
<h2>Watch the SQL</h2>
<p>While you learn, set <code>logging.level.org.hibernate.SQL=DEBUG</code> (or <code>spring.jpa.show-sql=true</code>) in your dev profile and watch the statements Hibernate runs. It is the fastest way to understand what JPA does for you, and later to spot what it does badly.</p>
<h2>Common mistakes</h2>
<ul>
<li>Calling <code>findById(id).get()</code>, which throws a vague <code>NoSuchElementException</code> when the book is missing. Use <code>orElseThrow</code> with a meaningful exception.</li>
<li>Writing table and column names in JPQL; JPQL uses entity and field names.</li>
<li>Loading a large table with <code>findAll()</code> to show the first twenty rows. Page it.</li>
</ul>`,
          resources: [
            {
              title: 'Spring Data JPA: Query Methods',
              url: 'https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Relationships and fetching: @ManyToOne, @OneToMany and the N + 1 problem',
          minutes: 20,
          topic: 'Relationships',
          html: `<p>Books alone do not make a library. A <strong>member</strong> borrows a book, and a <strong>loan</strong> records who borrowed what and when. In SQL that relationship is a foreign key; in JPA it is a field holding another entity. This lesson maps it, then tackles the performance trap that catches almost every team: the N + 1 query problem.</p>
<h2>Mapping a many-to-one</h2>
<p>Many loans point to one book and to one member, so the <code>Loan</code> entity holds the links, exactly as the <code>loans</code> table holds the foreign keys:</p>
<pre><code class="language-java">@Entity
@Table(name = "loans")
public class Loan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "book_id")
    private Book book;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id")
    private Member member;

    @Column(name = "issued_on", nullable = false)
    private LocalDate issuedOn;

    @Column(name = "due_on", nullable = false)
    private LocalDate dueOn;

    @Column(name = "returned_on")
    private LocalDate returnedOn;

    protected Loan() {
    }

    public Loan(Book book, Member member, LocalDate issuedOn, LocalDate dueOn) {
        this.book = book;
        this.member = member;
        this.issuedOn = issuedOn;
        this.dueOn = dueOn;
    }

    public boolean isOverdue(LocalDate today) {
        return returnedOn == null &amp;&amp; today.isAfter(dueOn);
    }

    // getters omitted
}</code></pre>
<p>In Java you work with objects: <code>loan.getBook().getTitle()</code>. In the database, <code>loans</code> still holds only <code>book_id</code> and <code>member_id</code>; <code>@JoinColumn</code> names those columns.</p>
<h2>The other direction: @OneToMany</h2>
<p>If you often need a member's loans, you can map the reverse side on <code>Member</code>:</p>
<pre><code class="language-java">@OneToMany(mappedBy = "member")
private List&lt;Loan&gt; loans = new ArrayList&lt;&gt;();</code></pre>
<p><code>mappedBy = "member"</code> says that the foreign key is managed by the <code>member</code> field of <code>Loan</code>. The side with the <code>@JoinColumn</code> is the <strong>owning side</strong>, and only changes to it are written to the database: adding a loan to <code>member.getLoans()</code> without setting the loan's <code>member</code> saves nothing. Map the reverse side only when you really need it; a repository method such as <code>findByMemberId(long memberId)</code> is often simpler.</p>
<h2>Lazy and eager loading</h2>
<p>When Hibernate loads a loan, should it load the book too? That is the <strong>fetch type</strong>:</p>
<ul>
<li><strong>EAGER</strong>: load the related entity straight away, with a join or an extra query.</li>
<li><strong>LAZY</strong>: put a placeholder (a proxy) in the field and load the real data the first time you use it.</li>
</ul>
<p>The JPA defaults are EAGER for <code>@ManyToOne</code> and <code>@OneToOne</code>, and LAZY for <code>@OneToMany</code> and <code>@ManyToMany</code>. Experienced teams set <code>fetch = FetchType.LAZY</code> on every <code>@ManyToOne</code>, as above, and then load deliberately what each screen needs. Eager everywhere quietly loads half the database with every query.</p>
<h3>LazyInitializationException</h3>
<p>Lazy loading works only while the persistence context is open, which in a Spring application usually means inside the transaction. Touch an unloaded association after the transaction has ended and Hibernate cannot fetch it: you get <code>LazyInitializationException</code>. The cure is not to make everything eager. Load what you need inside the transaction, ideally by building the response DTO there, before you return.</p>
<p>By default Spring Boot hides this problem with a setting called <em>open session in view</em>, which keeps the persistence context open until the web response has been written. That also lets lazy loading fire queries from the web layer without anyone noticing. Set <code>spring.jpa.open-in-view=false</code> so problems show up while you develop; Boot even logs a warning at start-up when you leave it on.</p>
<h2>The N + 1 query problem</h2>
<p>The librarian's dashboard lists the 50 overdue loans with each book's title:</p>
<pre><code class="language-java">List&lt;Loan&gt; overdue = loans.findByReturnedOnIsNullAndDueOnBefore(today);   // 1 query
for (Loan loan : overdue) {
    System.out.println(loan.getBook().getTitle());                         // 1 query per loan
}</code></pre>
<p>One query loads the 50 loans; then each <code>getBook().getTitle()</code> triggers a separate <code>SELECT</code> for a lazy book. That is 1 + 50 = 51 queries for one screen, and the number grows with the data. On your laptop it feels fine; in production, with network latency on every query, the page crawls. Keep the SQL log on during development and you will spot the pattern immediately.</p>
<p>The fix is to load the loans and their books in one query when this screen needs them, with <code>JOIN FETCH</code> in JPQL:</p>
<pre><code class="language-java">@Query("""
       select l from Loan l
       join fetch l.book
       join fetch l.member
       where l.returnedOn is null and l.dueOn &lt; :today
       order by l.dueOn
       """)
List&lt;Loan&gt; findOverdueWithBookAndMember(@Param("today") LocalDate today);</code></pre>
<p>Alternatively, put <code>@EntityGraph(attributePaths = {"book", "member"})</code> on a derived query method. Either way, one SQL statement with joins replaces 51. Do not "fix" N + 1 by changing the mapping to EAGER: that loads books on every query that touches loans, whether the screen needs them or not.</p>
<h2>Common mistakes</h2>
<ul>
<li>Updating only the <code>mappedBy</code> side of a relationship and wondering why nothing was saved.</li>
<li>Returning entities with lazy associations straight from a controller.</li>
<li>Join-fetching two collections in one query: Hibernate either refuses or returns a multiplied result. Fetch at most one collection per query.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>The log shows one SELECT on loans followed by fifty SELECTs on books. Name the problem and two fixes.</summary><p>It is the N + 1 query problem: each lazy book is loaded on its own. Load the books together with the loans using a <code>JOIN FETCH</code> query or an <code>@EntityGraph</code>.</p></details>`,
          resources: [
            {
              title: 'Hibernate ORM documentation',
              url: 'https://hibernate.org/orm/documentation/',
            },
          ],
        },
        { kind: 'practice', question: 'jpa-n-plus-one', topic: 'Relationships' },
        {
          kind: 'article',
          title: 'Transactions in Spring with @Transactional',
          minutes: 16,
          topic: 'Transactions',
          html: `<p>Issuing a book changes two things: the book loses a copy and a new loan appears. In the JDBC module you handled that with <code>setAutoCommit(false)</code>, <code>commit()</code> and <code>rollback()</code>. In Spring you write one annotation, <code>@Transactional</code>, and Spring does the rest. Knowing exactly what it does, and when it silently does nothing, is a standard interview topic.</p>
<h2>The service method</h2>
<pre><code class="language-java">@Service
public class LoanService {
    private final BookRepository books;
    private final MemberRepository members;
    private final LoanRepository loans;
    private final LibraryProperties settings;
    private final Clock clock;

    public LoanService(BookRepository books, MemberRepository members, LoanRepository loans,
                       LibraryProperties settings, Clock clock) {
        this.books = books;
        this.members = members;
        this.loans = loans;
        this.settings = settings;
        this.clock = clock;
    }

    @Transactional
    public Loan issue(long bookId, long memberId) {
        Book book = books.findById(bookId).orElseThrow(() -&gt; new BookNotFoundException(bookId));
        Member member = members.findById(memberId).orElseThrow(() -&gt; new MemberNotFoundException(memberId));

        book.takeCopy();   // throws NoCopyAvailableException when none are left

        LocalDate today = LocalDate.now(clock);
        return loans.save(new Loan(book, member, today, today.plusDays(settings.loanDays())));
    }
}</code></pre>
<p>There is no <code>books.save(book)</code>. The book was loaded inside the transaction, so it is managed, and dirty checking writes the new copy count when the transaction commits. Either the update and the insert both reach the database, or neither does.</p>
<h2>What @Transactional really does</h2>
<p>Spring does not change your class. At start-up it wraps the bean in a <strong>proxy</strong>, an object with the same methods. When another bean calls <code>loanService.issue(...)</code>, the call goes through the proxy, which:</p>
<ol>
<li>starts a transaction (borrows a connection and switches autocommit off);</li>
<li>calls your real method;</li>
<li>commits if the method returns normally;</li>
<li>rolls back if it throws an unchecked exception (a <code>RuntimeException</code> or an <code>Error</code>), and rethrows it.</li>
</ol>
<h3>Trap 1: checked exceptions commit by default</h3>
<p>If the method throws a <em>checked</em> exception, Spring <strong>commits</strong> whatever was done before it, which surprises many developers. Either use unchecked exceptions for business failures, as <code>NoCopyAvailableException</code> does, or say what should roll back: <code>@Transactional(rollbackFor = Exception.class)</code>.</p>
<h3>Trap 2: calls inside the same class skip the proxy</h3>
<pre><code class="language-java">public void issueMany(long memberId, List&lt;Long&gt; bookIds) {
    for (long bookId : bookIds) {
        issue(bookId, memberId);   // really this.issue(...): no proxy, so no transaction
    }
}</code></pre>
<p>Calling <code>issue</code> from another method of the same object is a plain Java call on <code>this</code>. It never passes through the proxy, so the annotation has no effect. Put <code>@Transactional</code> on the method that outside callers use (here, <code>issueMany</code> itself), or move the inner method into another bean. For the same reason the annotation does nothing on <code>private</code> methods.</p>
<h3>Trap 3: catching the exception changes the outcome</h3>
<p>If your method catches an exception and then returns normally, the proxy sees a normal return and commits. Catch only what you can genuinely handle.</p>
<h2>Where to put it</h2>
<ul>
<li><strong>On service methods.</strong> A service method is one business operation, "issue a book", which is exactly the unit that should succeed or fail as a whole. Not on controllers, and usually not on your repositories: Spring Data's built-in methods are already transactional.</li>
<li><strong>Use Spring's annotation,</strong> <code>org.springframework.transaction.annotation.Transactional</code>. The <code>jakarta.transaction.Transactional</code> annotation also works, but lacks options such as <code>readOnly</code>.</li>
<li><strong>Mark reading methods</strong> <code>@Transactional(readOnly = true)</code>. Hibernate then skips dirty checking, and lazy loading keeps working inside the method.</li>
</ul>
<h2>Keep the transaction short</h2>
<p>A transaction holds a pooled connection and row locks until it ends. Do not send the SMS confirmation from inside <code>issue</code>: if the SMS provider takes five seconds, so does the transaction, and if the commit then fails, the member has been told about a loan that does not exist. Send notifications after a successful commit, for example from the caller once <code>issue</code> has returned.</p>
<h2>Common mistakes</h2>
<ul>
<li>Expecting a rollback for a checked exception.</li>
<li>Calling a <code>@Transactional</code> method from the same class and getting no transaction at all.</li>
<li>Annotating a <code>private</code> method.</li>
<li>Calling slow external services while the transaction is open.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>Suppose issue() saved the loan first and only then called book.takeCopy(), which throws NoCopyAvailableException. What is in the database afterwards?</summary><p>Nothing new. The exception is unchecked, so the proxy rolls back the whole transaction, including the loan that was saved a moment earlier.</p></details>`,
          resources: [
            {
              title: 'Spring Framework: Using @Transactional',
              url: 'https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html',
            },
          ],
        },
        { kind: 'practice', question: 'spring-transactional', topic: 'Transactions' },
      ],
    },
    {
      title: 'The web tier',
      summary:
        'Build REST endpoints with Spring MVC: resource design and HTTP methods, request and response DTOs, Bean Validation, precise status codes and one consistent error format for the whole API.',
      lessons: [
        {
          kind: 'article',
          title: 'Designing a REST API: resources, methods and status codes',
          minutes: 16,
          topic: 'REST design',
          html: `<p>Before you write a controller, design the API. A front-end developer, a mobile app or another team's service will call it, and once they depend on it, every change hurts. <strong>REST</strong> is a set of conventions for HTTP APIs that makes them predictable: if you know one well-designed REST API, you can guess how the next one works.</p>
<h2>Resources are nouns</h2>
<p>A REST API exposes <strong>resources</strong> (things) at URLs and uses HTTP <strong>methods</strong> (verbs) to act on them. The URL never names the action:</p>
<table>
<thead><tr><th>Avoid</th><th>Prefer</th></tr></thead>
<tbody>
<tr><td><code>GET /getAllBooks</code></td><td><code>GET /api/books</code></td></tr>
<tr><td><code>POST /createBook</code></td><td><code>POST /api/books</code></td></tr>
<tr><td><code>GET /deleteBook?id=7</code></td><td><code>DELETE /api/books/7</code></td></tr>
<tr><td><code>GET /memberLoans?memberId=3</code></td><td><code>GET /api/members/3/loans</code></td></tr>
</tbody>
</table>
<p>The conventions: plural nouns, lower case, hyphens between words (<code>/api/overdue-loans</code>), the id in the path for a single item, nesting to show clear ownership, and query parameters for filtering, sorting and paging, as in <code>GET /api/books?author=Narayan&amp;page=0&amp;size=20</code>.</p>
<h2>The methods</h2>
<table>
<thead><tr><th>Method</th><th>Meaning</th><th>Safe</th><th>Idempotent</th></tr></thead>
<tbody>
<tr><td>GET</td><td>Read a resource or a list</td><td>Yes</td><td>Yes</td></tr>
<tr><td>POST</td><td>Create a resource in a collection, or trigger an action</td><td>No</td><td>No</td></tr>
<tr><td>PUT</td><td>Replace a resource completely</td><td>No</td><td>Yes</td></tr>
<tr><td>PATCH</td><td>Change some fields of a resource</td><td>No</td><td>Not necessarily</td></tr>
<tr><td>DELETE</td><td>Remove a resource</td><td>No</td><td>Yes</td></tr>
</tbody>
</table>
<p><strong>Safe</strong> means the request changes nothing on the server. <strong>Idempotent</strong> means that sending the same request twice has the same effect as sending it once. Deleting book 7 twice leaves book 7 deleted; replacing it twice with the same data leaves the same data. Posting the same new book twice creates two books. This matters because networks fail: a mobile app that times out will retry, and retrying an idempotent request is harmless. For non-idempotent operations such as payments, APIs accept an <em>idempotency key</em> header so that a retried request is recognised and not processed twice.</p>
<h2>Status codes</h2>
<p>The status code is the first thing a client checks, so use the precise one:</p>
<table>
<thead><tr><th>Code</th><th>Meaning</th><th>Library example</th></tr></thead>
<tbody>
<tr><td>200 OK</td><td>Success, with a body</td><td>Reading a book</td></tr>
<tr><td>201 Created</td><td>A new resource exists; the <code>Location</code> header gives its URL</td><td>Adding a book</td></tr>
<tr><td>204 No Content</td><td>Success, nothing to return</td><td>Deleting a book</td></tr>
<tr><td>400 Bad Request</td><td>The request is malformed or fails validation</td><td>An ISBN with 12 digits</td></tr>
<tr><td>401 Unauthorized</td><td>Not signed in: missing or invalid credentials</td><td>No token sent</td></tr>
<tr><td>403 Forbidden</td><td>Signed in, but not allowed to do this</td><td>A student trying to delete a book</td></tr>
<tr><td>404 Not Found</td><td>No such resource</td><td><code>GET /api/books/9999</code></td></tr>
<tr><td>409 Conflict</td><td>The request clashes with the current state</td><td>Issuing a book with no copies left; a duplicate ISBN</td></tr>
<tr><td>422 Unprocessable Content</td><td>Well-formed but semantically invalid; some teams use it for validation errors instead of 400</td><td>A due date before the issue date</td></tr>
<tr><td>500 Internal Server Error</td><td>A bug or failure on the server</td><td>The database is down</td></tr>
</tbody>
</table>
<p>The rule of thumb: <strong>4xx means the client must change the request; 5xx means the server has a problem</strong>, and retrying later may help. Never answer an error with 200 and <code>"success": false</code> in the body. Clients, proxies and monitoring tools all rely on the status code.</p>
<h2>The library API</h2>
<table>
<thead><tr><th>Request</th><th>What it does</th><th>Answers</th></tr></thead>
<tbody>
<tr><td><code>GET /api/books?author=...</code></td><td>List or search books</td><td>200</td></tr>
<tr><td><code>GET /api/books/{id}</code></td><td>One book</td><td>200 or 404</td></tr>
<tr><td><code>POST /api/books</code></td><td>Add a book</td><td>201 with Location, 400 or 409</td></tr>
<tr><td><code>PUT /api/books/{id}</code></td><td>Replace a book's details</td><td>200, 400 or 404</td></tr>
<tr><td><code>DELETE /api/books/{id}</code></td><td>Remove a book</td><td>204 or 404</td></tr>
<tr><td><code>POST /api/loans</code></td><td>Issue a book to a member</td><td>201, 404 or 409</td></tr>
<tr><td><code>POST /api/loans/{id}/return</code></td><td>Return a borrowed book</td><td>200, 404, or 409 if already returned</td></tr>
<tr><td><code>GET /api/loans?overdue=true</code></td><td>Overdue loans</td><td>200</td></tr>
</tbody>
</table>
<p>Returning a book is an action rather than a plain create or update. Modelling it as <code>POST /api/loans/{id}/return</code> is a common, pragmatic choice; another is <code>PATCH /api/loans/{id}</code> with a <code>returnedOn</code> date. Pick one style and use it everywhere.</p>
<h2>Common mistakes</h2>
<ul>
<li>Verbs in URLs, such as <code>/api/books/delete/7</code>.</li>
<li>Using GET for anything that changes data. Browsers, crawlers and caches feel free to repeat GET requests.</li>
<li>Returning 500 for a client's mistake, such as a missing field, which sends the client team hunting for a server bug.</li>
</ul>`,
          resources: [
            {
              title: 'Building a RESTful Web Service (Spring guide)',
              url: 'https://spring.io/guides/gs/rest-service',
            },
          ],
        },
        { kind: 'practice', question: 'rest-resource-naming', topic: 'REST design' },
        {
          kind: 'article',
          title: 'Building endpoints with @RestController',
          minutes: 20,
          topic: 'Controllers',
          html: `<p>With the API designed, the code is short. Spring MVC, which <code>spring-boot-starter-web</code> brings in, maps HTTP requests to methods of a <strong>controller</strong>, converts JSON to Java objects and back with Jackson, and lets you set the status code and headers.</p>
<h2>DTOs: what goes over the wire</h2>
<p>Do not send JPA entities out as JSON. An entity has your database's shape, lazy associations that can fail during serialisation, and fields you may not want to expose. Define small records for requests and responses instead, called <strong>DTOs</strong> (data transfer objects):</p>
<pre><code class="language-java">public record CreateBookRequest(String title, String author, String isbn, int copies) {}

public record BookResponse(long id, String title, String author, String isbn, int availableCopies) {

    public static BookResponse from(Book book) {
        return new BookResponse(book.getId(), book.getTitle(), book.getAuthor(),
                book.getIsbn(), book.getAvailableCopies());
    }
}</code></pre>
<p>DTOs also decouple your API from your tables: you can rename a column or split an entity without breaking the mobile app that calls you. The <code>BookService</code> from the Persistence module gains methods that return DTOs, built inside a read-only transaction:</p>
<pre><code class="language-java">@Transactional(readOnly = true)
public BookResponse get(long id) {
    return books.findById(id)
            .map(BookResponse::from)
            .orElseThrow(() -&gt; new BookNotFoundException(id));
}</code></pre>
<h2>The controller</h2>
<pre><code class="language-java">@RestController
@RequestMapping("/api/books")
public class BookController {
    private final BookService books;

    public BookController(BookService books) {
        this.books = books;
    }

    @GetMapping
    public List&lt;BookResponse&gt; list(@RequestParam(required = false) String author) {
        return books.search(author);
    }

    @GetMapping("/{id}")
    public BookResponse get(@PathVariable long id) {
        return books.get(id);
    }

    @PostMapping
    public ResponseEntity&lt;BookResponse&gt; create(@RequestBody CreateBookRequest request) {
        BookResponse created = books.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        books.delete(id);
    }
}</code></pre>
<ul>
<li><code>@RestController</code> is <code>@Controller</code> plus <code>@ResponseBody</code>: return values are written to the response body as JSON instead of being treated as the names of HTML views.</li>
<li><code>@RequestMapping("/api/books")</code> on the class sets the common path; <code>@GetMapping</code>, <code>@PostMapping</code>, <code>@PutMapping</code>, <code>@PatchMapping</code> and <code>@DeleteMapping</code> map individual methods.</li>
<li><code>@PathVariable</code> takes a value from the path, so <code>/api/books/7</code> gives <code>id = 7</code>. A path such as <code>/api/books/abc</code> cannot become a <code>long</code>, so Spring answers 400 without calling your method.</li>
<li><code>@RequestParam</code> reads a query parameter such as <code>?author=Narayan</code>. Parameters are required by default; <code>required = false</code> makes this one optional, and it is <code>null</code> when absent.</li>
<li><code>@RequestBody</code> converts the JSON body into the record, matching JSON keys to component names.</li>
</ul>
<h2>Status codes and headers</h2>
<p>A method that returns an object answers <code>200 OK</code>. For anything else you have two tools. <code>@ResponseStatus</code> fixes the status for a method, as on <code>delete</code>. <code>ResponseEntity</code> gives full control of status, headers and body, as on <code>create</code>: <code>ResponseEntity.created(location)</code> sets <code>201 Created</code> and the <code>Location</code> header, which <code>ServletUriComponentsBuilder</code> builds from the current request's URL plus the new id.</p>
<h2>Trying it out</h2>
<p>Use Postman, the HTTP client built into IntelliJ IDEA, or curl:</p>
<pre><code class="language-text">curl -i -X POST http://localhost:8080/api/books -H "Content-Type: application/json" -d '{"title":"Malgudi Days","author":"R. K. Narayan","isbn":"9789300000011","copies":3}'</code></pre>
<pre><code class="language-text">HTTP/1.1 201
Location: http://localhost:8080/api/books/1
Content-Type: application/json

{"id":1,"title":"Malgudi Days","author":"R. K. Narayan","isbn":"9789300000011","availableCopies":3}</code></pre>
<h2>An action endpoint: issuing a book</h2>
<pre><code class="language-java">public record IssueRequest(long bookId, long memberId) {}

public record LoanResponse(long id, String bookTitle, String memberName, LocalDate dueOn) {
    public static LoanResponse from(Loan loan) {
        return new LoanResponse(loan.getId(), loan.getBook().getTitle(),
                loan.getMember().getName(), loan.getDueOn());
    }
}

@RestController
@RequestMapping("/api/loans")
public class LoanController {
    private final LoanService loans;

    public LoanController(LoanService loans) {
        this.loans = loans;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LoanResponse issue(@RequestBody IssueRequest request) {
        return LoanResponse.from(loans.issue(request.bookId(), request.memberId()));
    }
}</code></pre>
<p>Mapping after the service returns is safe here only because <code>issue</code> loaded the book and the member itself, so they are real objects rather than lazy proxies. When in doubt, build the DTO inside the transaction, as <code>BookService.get</code> does.</p>
<h2>Common mistakes</h2>
<ul>
<li>Returning entities from controllers: lazy-loading errors, endless JSON loops between <code>Member</code> and <code>Loan</code>, and internal fields leaking out.</li>
<li>Putting business rules in the controller. A controller translates HTTP into a service call and back; rules about copies, limits and due dates live in the service, where they can be tested without HTTP.</li>
<li>Forgetting the <code>Content-Type: application/json</code> header and getting <code>415 Unsupported Media Type</code>.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>Which status and header should a successful POST /api/books return, and which line of the controller produces them?</summary><p><code>201 Created</code>, with a <code>Location</code> header pointing at the new book, such as <code>/api/books/1</code>. <code>ResponseEntity.created(location)</code> sets both.</p></details>`,
          resources: [
            {
              title: 'Spring Framework: Annotated Controllers',
              url: 'https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller.html',
            },
            {
              title: 'Building a RESTful Web Service (Spring guide)',
              url: 'https://spring.io/guides/gs/rest-service',
            },
          ],
        },
        { kind: 'practice', question: 'rest-status-created', topic: 'Controllers' },
        {
          kind: 'article',
          title: 'Validating requests with Bean Validation',
          minutes: 16,
          topic: 'Validation',
          html: `<p>Never trust input. A request may come from your own web page, from a mobile app with an old bug, or from someone experimenting with curl. <strong>Jakarta Bean Validation</strong> lets you declare rules on your request DTOs, and Spring checks them before your controller method runs.</p>
<h2>The dependency</h2>
<p>Validation needs <code>spring-boot-starter-validation</code>, which brings Hibernate Validator. It is not part of the web starter, so if your annotations seem to be ignored, check the dependency first.</p>
<h2>Declaring the rules</h2>
<pre><code class="language-java">import jakarta.validation.constraints.*;

public record CreateBookRequest(
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 120) String author,
        @NotBlank @Pattern(regexp = "[0-9]{13}", message = "must be 13 digits") String isbn,
        @Min(1) @Max(50) int copies) {
}</code></pre>
<table>
<thead><tr><th>Annotation</th><th>Checks</th></tr></thead>
<tbody>
<tr><td><code>@NotNull</code></td><td>The value is present (an empty string still passes)</td></tr>
<tr><td><code>@NotBlank</code></td><td>A string is present and contains at least one non-space character</td></tr>
<tr><td><code>@NotEmpty</code></td><td>A string or collection is present and not empty</td></tr>
<tr><td><code>@Size(min, max)</code></td><td>The length of a string or the size of a collection</td></tr>
<tr><td><code>@Min</code>, <code>@Max</code>, <code>@Positive</code></td><td>Numeric ranges</td></tr>
<tr><td><code>@Email</code></td><td>Looks like an email address</td></tr>
<tr><td><code>@Pattern(regexp)</code></td><td>Matches a regular expression</td></tr>
<tr><td><code>@Past</code>, <code>@Future</code>, <code>@FutureOrPresent</code></td><td>Dates relative to today</td></tr>
</tbody>
</table>
<h2>Switching validation on with @Valid</h2>
<p>The annotations on the record do nothing until you ask Spring to check them. Put <code>@Valid</code> on the controller parameter:</p>
<pre><code class="language-java">@PostMapping
public ResponseEntity&lt;BookResponse&gt; create(@Valid @RequestBody CreateBookRequest request) {
    BookResponse created = books.create(request);   // reached only when every rule passes
    URI location = ServletUriComponentsBuilder.fromCurrentRequest()
            .path("/{id}")
            .buildAndExpand(created.id())
            .toUri();
    return ResponseEntity.created(location).body(created);
}</code></pre>
<p>If any rule fails, Spring throws <code>MethodArgumentNotValidException</code> and, by default, answers <code>400 Bad Request</code> without calling your method. The default error body is not very helpful to a front-end developer, though; the next lesson replaces it with one that names each invalid field.</p>
<h3>A primitive int cannot be missing</h3>
<p>If the JSON leaves out <code>copies</code>, Jackson leaves the <code>int</code> at 0, and <code>@Min(1)</code> catches it. If 0 were a valid value, you could not tell "missing" from "zero"; in that case declare the component as <code>Integer</code> with <code>@NotNull</code>.</p>
<h2>Validating query parameters</h2>
<p>Constraints can also sit directly on controller method parameters:</p>
<pre><code class="language-java">@GetMapping
public List&lt;BookResponse&gt; list(@RequestParam(required = false) @Size(min = 2) String author) {
    return books.search(author);
}</code></pre>
<p>Since Spring Framework 6.1 (Spring Boot 3.2), Spring MVC checks such parameter constraints itself and answers 400 when they fail. Older versions needed <code>@Validated</code> on the controller class, and reported failures as <code>ConstraintViolationException</code>.</p>
<h2>Rules that need the database</h2>
<p>Annotations check one request in isolation. "This ISBN already exists" or "this member already has three books" depend on stored data, so those checks belong in the service, which throws a business exception such as <code>DuplicateIsbnException</code> that becomes <code>409 Conflict</code>. Keep the unique constraint in the database as well: two simultaneous requests can both pass the service's check, and only the database can stop the second one.</p>
<h2>Validation is documentation too</h2>
<p>Read <code>CreateBookRequest</code> again: anyone can see what a valid book looks like without opening the service. Write a <code>message</code> when the default text would confuse users. The default for the ISBN rule, <code>must match "[0-9]{13}"</code>, is accurate but unfriendly, which is why the rule above says "must be 13 digits".</p>
<h2>Common mistakes</h2>
<ul>
<li>Forgetting <code>@Valid</code>, so the annotations are silently ignored.</li>
<li>Forgetting the validation starter, with the same result.</li>
<li>Using <code>@NotNull</code> on a string that must contain text; an empty string passes. Use <code>@NotBlank</code>.</li>
<li>Validating only in the browser. Checks in JavaScript are a convenience for the user; the server must check again.</li>
</ul>`,
          resources: [
            {
              title: 'Spring Framework: Java Bean Validation',
              url: 'https://docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html',
            },
            {
              title: 'Jakarta Bean Validation',
              url: 'https://jakarta.ee/specifications/bean-validation/',
            },
          ],
        },
        {
          kind: 'article',
          title: 'One error format for the whole API with @RestControllerAdvice',
          minutes: 18,
          topic: 'Error handling',
          html: `<p>When something goes wrong, a client needs three things: what kind of error it was (the status code), a message it can show or log, and, for validation errors, which fields to fix. If every controller invents its own error shape, every client must handle every shape. Spring lets you define error handling once, for the whole application.</p>
<h2>Exceptions that mean something</h2>
<p>Start with exceptions that describe business failures. Make them unchecked, so they also roll back <code>@Transactional</code> service methods:</p>
<pre><code class="language-java">public class BookNotFoundException extends RuntimeException {
    public BookNotFoundException(long id) {
        super("No book with id " + id);
    }
}

public class NoCopyAvailableException extends RuntimeException {
    public NoCopyAvailableException(String isbn) {
        super("No copy of " + isbn + " is available right now");
    }
}</code></pre>
<p>The service throws them and knows nothing about HTTP. Translating them into responses is the web tier's job.</p>
<h2>ProblemDetail: a standard error body</h2>
<p>Spring Framework 6 supports <strong>problem details</strong>, a standard JSON error format defined by RFC 9457, which replaced RFC 7807. Spring's class for it is <code>org.springframework.http.ProblemDetail</code>, and a response looks like this:</p>
<pre><code class="language-json">{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "No book with id 9999",
  "instance": "/api/books/9999"
}</code></pre>
<p>Because it is a standard, client libraries and API tools already understand it, and your team does not need to debate the shape of error bodies.</p>
<h2>One handler class for all controllers</h2>
<pre><code class="language-java">@RestControllerAdvice
public class ApiErrorHandler {

    @ExceptionHandler(BookNotFoundException.class)
    public ProblemDetail notFound(BookNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(NoCopyAvailableException.class)
    public ProblemDetail noCopy(NoCopyAvailableException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail invalid(MethodArgumentNotValidException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST, "Some fields are not valid");
        Map&lt;String, String&gt; fields = new LinkedHashMap&lt;&gt;();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fields.put(error.getField(), error.getDefaultMessage());
        }
        problem.setProperty("fields", fields);
        return problem;
    }
}</code></pre>
<p><code>@RestControllerAdvice</code> applies these handlers to every controller. When a controller method, or the service it calls, throws <code>BookNotFoundException</code>, Spring finds the matching <code>@ExceptionHandler</code>, and the <code>ProblemDetail</code> it returns becomes the response, with the status taken from the problem and the content type <code>application/problem+json</code>. A request with an invalid ISBN and zero copies now gets:</p>
<pre><code class="language-json">{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Some fields are not valid",
  "instance": "/api/books",
  "fields": {
    "isbn": "must be 13 digits",
    "copies": "must be greater than or equal to 1"
  }
}</code></pre>
<p>The <code>fields</code> map tells the front end exactly which inputs to highlight, so the form can show "must be 13 digits" right under the ISBN box.</p>
<h2>Errors you did not expect</h2>
<p>A bug such as a <code>NullPointerException</code>, or a database outage, falls through to Spring Boot's default error handling, which logs the stack trace and answers <code>500</code> with a short JSON body. By default it does <em>not</em> put the stack trace or the exception message in the response. Keep it that way: a stack trace tells an attacker your libraries, versions and class names.</p>
<p>It is tempting to add a handler for <code>Exception.class</code> that catches everything. Be careful: it also catches Spring MVC's own exceptions, so a request with malformed JSON, which deserves a 400, would suddenly get a 500. If you want problem-detail bodies for Spring's built-in errors as well, make your handler class extend <code>ResponseEntityExceptionHandler</code>, which already maps all of them to the right status. In that case override its <code>handleMethodArgumentNotValid</code> method instead of declaring your own handler for <code>MethodArgumentNotValidException</code>; declaring both makes start-up fail with an "ambiguous handler" error.</p>
<h2>Common mistakes</h2>
<ul>
<li>Catching exceptions in every controller method and building error responses by hand, each slightly different.</li>
<li>Answering business failures such as "no copies left" with <code>500</code>; that is a <code>409</code>.</li>
<li>Passing raw exception messages from the database or the JDK to clients. Write your own messages for anything a client sees.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>A client registers a new member with the email "asha@". What status and body should it receive?</summary><p><code>400 Bad Request</code> (some teams use 422), with a body that names the field and the problem, such as <code>"fields": { "email": "must be a well-formed email address" }</code>. Never 500, and never 200 with an error flag.</p></details>`,
          resources: [
            {
              title: 'Spring Framework: Error Responses',
              url: 'https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html',
            },
          ],
        },
        { kind: 'practice', question: 'rest-400-vs-422', topic: 'Error handling' },
      ],
    },
    {
      title: 'Testing and shipping',
      summary:
        'Prove the API works with fast unit tests, web-layer tests with MockMvc and full integration tests, then package it as one runnable jar with health checks and production settings.',
      lessons: [
        {
          kind: 'article',
          title: 'Unit tests for services with JUnit 5 and Mockito',
          minutes: 18,
          topic: 'Unit tests',
          html: `<p>The library API has rules worth protecting: a book with no copies cannot be issued, a loan is due fourteen days after it is issued, a member may not hold more than three books. <strong>Unit tests</strong> check such rules in milliseconds, without a database or a web server, and they run on every build, so a change next month cannot quietly break them.</p>
<h2>The testing pyramid</h2>
<ul>
<li><strong>Many unit tests:</strong> one class at a time, with its collaborators replaced by test doubles. Fast and precise.</li>
<li><strong>Some slice tests:</strong> one layer with Spring, such as the web layer with MockMvc or the repositories with a real database.</li>
<li><strong>A few end-to-end tests:</strong> the whole application, through HTTP.</li>
</ul>
<p>Lower levels are faster and point straight at the failure; higher levels prove the parts work together. You need all three, roughly in that proportion.</p>
<h2>JUnit 5 in one example</h2>
<p><code>spring-boot-starter-test</code> already includes JUnit 5, Mockito and AssertJ. Start with a class that needs no mocks at all, the <code>Book</code> entity:</p>
<pre><code class="language-java">class BookTest {

    @Test
    void takingACopyReducesTheAvailableCount() {
        Book book = new Book("Malgudi Days", "R. K. Narayan", "9789300000011", 2);

        book.takeCopy();

        assertThat(book.getAvailableCopies()).isEqualTo(1);
    }

    @Test
    void cannotTakeACopyWhenNoneAreLeft() {
        Book book = new Book("Malgudi Days", "R. K. Narayan", "9789300000011", 0);

        assertThatThrownBy(book::takeCopy)
                .isInstanceOf(NoCopyAvailableException.class);
    }
}</code></pre>
<p>Each test follows the <strong>arrange, act, assert</strong> shape, separated by blank lines: build the objects, do the one thing being tested, check the result. The names describe behaviour in plain words, so a failing test tells you which rule broke. (In these examples the static imports of <code>Assertions</code>, <code>Mockito</code> and <code>ArgumentMatchers</code> are left out to save space.)</p>
<h2>Mockito: replacing collaborators</h2>
<p><code>LoanService.issue</code> uses three repositories, the library settings and a clock. In a unit test the repositories become <strong>mocks</strong>: objects that return whatever you tell them to and record how they were called.</p>
<pre><code class="language-java">@ExtendWith(MockitoExtension.class)
class LoanServiceTest {

    @Mock BookRepository books;
    @Mock MemberRepository members;
    @Mock LoanRepository loans;

    Clock clock = Clock.fixed(Instant.parse("2026-10-09T04:30:00Z"), ZoneId.of("Asia/Kolkata"));
    LoanService service;

    @BeforeEach
    void setUp() {
        service = new LoanService(books, members, loans, new LibraryProperties(14, 3), clock);
    }

    @Test
    void issuingABookSetsTheDueDateFourteenDaysAhead() {
        Book book = new Book("The Guide", "R. K. Narayan", "9789300000042", 1);
        when(books.findById(7L)).thenReturn(Optional.of(book));
        when(members.findById(3L)).thenReturn(Optional.of(new Member("Divya Sundar", "divya@example.com")));
        when(loans.save(any(Loan.class))).thenAnswer(call -&gt; call.getArgument(0));

        Loan loan = service.issue(7L, 3L);

        assertThat(loan.getDueOn()).isEqualTo(LocalDate.of(2026, 10, 23));
        assertThat(book.getAvailableCopies()).isZero();
    }

    @Test
    void refusesWhenNoCopyIsLeftAndSavesNothing() {
        Book book = new Book("The Guide", "R. K. Narayan", "9789300000042", 0);
        when(books.findById(7L)).thenReturn(Optional.of(book));
        when(members.findById(3L)).thenReturn(Optional.of(new Member("Divya Sundar", "divya@example.com")));

        assertThatThrownBy(() -&gt; service.issue(7L, 3L))
                .isInstanceOf(NoCopyAvailableException.class);
        verify(loans, never()).save(any());
    }
}</code></pre>
<p>The fixed clock says it is 10 a.m. on 9 October 2026 in India, so the due date is exactly 23 October. That is why the clock was injected back in the Structure module: with <code>LocalDate.now()</code> inside the service, the expected due date would change every day. Read the second test closely as well. It checks the rule (an exception) <em>and</em> the side effect that must not happen (no loan saved); <code>verify(..., never())</code> is how you test that something did not happen.</p>
<h2>What to test, and what not to</h2>
<ul>
<li>Test behaviour and rules, including the boundaries: exactly zero copies, exactly the loan limit, the due date itself (not overdue) and the day after (overdue).</li>
<li>Do not test getters, setters or Spring Data's own methods; they are not your logic.</li>
<li>Do not mock what you own and can create cheaply, such as <code>Book</code>. Use the real object.</li>
<li>Do not over-verify. Checking every call a method makes ties the test to the implementation, so harmless refactoring breaks it.</li>
</ul>
<h2>Common mistakes</h2>
<ul>
<li>One giant test that checks ten things: when it fails, you do not know which rule broke.</li>
<li>Tests that depend on today's date, on the order they run in, or on data another test left behind.</li>
<li>Tests without assertions. They pass as long as nothing throws, which proves very little.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>Why is the clock passed into LoanService instead of the service calling LocalDate.now() itself?</summary><p>So that a test can fix "today". With a fixed clock the expected due date is a constant, and the test gives the same answer on every day it runs.</p></details>`,
        },
        {
          kind: 'article',
          title: 'Web-layer tests with @WebMvcTest and MockMvc',
          minutes: 16,
          topic: 'Web tests',
          html: `<p>Unit tests prove the rules. They do not prove that <code>POST /api/books</code> is mapped, that an invalid ISBN gets a 400, or that your error handler produces the body the front end expects. A <strong>web slice test</strong> starts only Spring's web layer (controllers, JSON conversion, validation and your <code>@RestControllerAdvice</code>) and sends simulated HTTP requests through it with <strong>MockMvc</strong>. There is no real server and no database, so it runs in a second or two.</p>
<h2>Setting up the slice</h2>
<pre><code class="language-java">@WebMvcTest(BookController.class)
class BookControllerTest {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    BookService books;

    // tests below
}</code></pre>
<p><code>@WebMvcTest(BookController.class)</code> builds a Spring context with just that controller and the web infrastructure, including your error handler. Services and repositories are not created, so the controller's <code>BookService</code> must come from somewhere: <code>@MockitoBean</code> puts a Mockito mock into the context in its place. (<code>@MockitoBean</code> arrived with Spring Boot 3.4; older projects use <code>@MockBean</code>, which does the same job and is now deprecated.)</p>
<h2>A successful request</h2>
<pre><code class="language-java">@Test
void returnsABookAsJson() throws Exception {
    when(books.get(7L)).thenReturn(
            new BookResponse(7L, "Malgudi Days", "R. K. Narayan", "9789300000011", 3));

    mvc.perform(get("/api/books/7"))
       .andExpect(status().isOk())
       .andExpect(jsonPath("$.title").value("Malgudi Days"))
       .andExpect(jsonPath("$.availableCopies").value(3));
}</code></pre>
<p><code>perform</code> sends the request through the full Spring MVC machinery, and the <code>andExpect</code> calls check the status and the JSON. <code>jsonPath("$.title")</code> reads the <code>title</code> field of the response, where <code>$</code> is the root of the document. (<code>get</code>, <code>post</code>, <code>status</code>, <code>header</code> and <code>jsonPath</code> are static imports from <code>MockMvcRequestBuilders</code> and <code>MockMvcResultMatchers</code>.)</p>
<h2>The error contract</h2>
<pre><code class="language-java">@Test
void answers404ForAMissingBook() throws Exception {
    when(books.get(9999L)).thenThrow(new BookNotFoundException(9999L));

    mvc.perform(get("/api/books/9999"))
       .andExpect(status().isNotFound())
       .andExpect(jsonPath("$.detail").value("No book with id 9999"));
}

@Test
void rejectsAnInvalidIsbnAndNamesTheField() throws Exception {
    String body = """
            {"title": "Malgudi Days", "author": "R. K. Narayan", "isbn": "12345", "copies": 3}
            """;

    mvc.perform(post("/api/books")
               .contentType(MediaType.APPLICATION_JSON)
               .content(body))
       .andExpect(status().isBadRequest())
       .andExpect(jsonPath("$.fields.isbn").value("must be 13 digits"));

    verifyNoInteractions(books);
}</code></pre>
<p>The last line matters: an invalid request must never reach the service. Together these tests pin down exactly what the front-end team relies on. If someone changes the error format by accident, the build turns red before any user notices.</p>
<h2>The 201 and its Location header</h2>
<pre><code class="language-java">@Test
void createsABookAndPointsToIt() throws Exception {
    when(books.create(any())).thenReturn(
            new BookResponse(1L, "Malgudi Days", "R. K. Narayan", "9789300000011", 3));

    mvc.perform(post("/api/books")
               .contentType(MediaType.APPLICATION_JSON)
               .content("""
                       {"title": "Malgudi Days", "author": "R. K. Narayan", "isbn": "9789300000011", "copies": 3}
                       """))
       .andExpect(status().isCreated())
       .andExpect(header().string("Location", "http://localhost/api/books/1"));
}</code></pre>
<p>MockMvc's simulated requests use <code>http://localhost</code> without a port, which is why the expected header has none.</p>
<h2>Common mistakes</h2>
<ul>
<li>Forgetting <code>contentType(MediaType.APPLICATION_JSON)</code>, so the test gets 415 and you debug the wrong thing.</li>
<li>Using <code>@SpringBootTest</code> for every controller test. It starts the whole application and is much slower than a slice.</li>
<li>Asserting only the status code. A 400 with the wrong body still breaks the front end.</li>
</ul>`,
          resources: [
            {
              title: 'Testing the Web Layer (Spring guide)',
              url: 'https://spring.io/guides/gs/testing-web',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Integration tests: @DataJpaTest and @SpringBootTest',
          minutes: 18,
          topic: 'Integration tests',
          html: `<p>Mocks are only as good as your assumptions about the real thing. Does the JPQL in <code>findOverdueWithBookAndMember</code> actually run? Do the entity mappings match the tables? Does a request really travel from HTTP through the service to the database and back? <strong>Integration tests</strong> answer these questions by running real pieces together.</p>
<h2>Repository tests with @DataJpaTest</h2>
<p><code>@DataJpaTest</code> starts only the persistence slice: entities, repositories, Hibernate and a database. By default it uses an embedded in-memory database (H2, when it is on the test classpath) and wraps each test in a transaction that is rolled back at the end, so tests never see each other's data.</p>
<pre><code class="language-java">@DataJpaTest
class LoanRepositoryTest {

    @Autowired TestEntityManager em;
    @Autowired LoanRepository loans;

    @Test
    void findsOnlyUnreturnedLoansPastTheirDueDate() {
        Book book = em.persist(new Book("Wings of Fire", "A. P. J. Abdul Kalam", "9789300000059", 2));
        Member member = em.persist(new Member("Imran Sheikh", "imran@example.com"));
        LocalDate today = LocalDate.of(2026, 10, 9);
        em.persist(new Loan(book, member, today.minusDays(20), today.minusDays(6)));   // overdue
        em.persist(new Loan(book, member, today.minusDays(5), today.plusDays(9)));     // not yet due
        em.flush();
        em.clear();

        List&lt;Loan&gt; overdue = loans.findOverdueWithBookAndMember(today);

        assertThat(overdue).hasSize(1);
        assertThat(overdue.get(0).getBook().getTitle()).isEqualTo("Wings of Fire");
    }
}</code></pre>
<p><code>TestEntityManager</code> inserts the test data. <code>flush()</code> sends it to the database, and <code>clear()</code> empties the persistence context, so the query really reads from the database rather than returning objects already in memory. The test proves the JPQL, the mappings and the join fetch all work together.</p>
<h3>H2 or the real database?</h3>
<p>H2 is fast and needs no installation, but it is not MySQL or PostgreSQL. A query using a MySQL-only function can pass on H2 and fail in production, or the other way round. Many teams therefore run integration tests against the real database engine in a throwaway Docker container using <strong>Testcontainers</strong>; Spring Boot's <code>@ServiceConnection</code> annotation connects such a container to your test configuration automatically. Start with H2 while you learn, and move to Testcontainers when your queries become database-specific.</p>
<h2>The whole application with @SpringBootTest</h2>
<p><code>@SpringBootTest</code> starts the complete application context. With a random port it also starts the real embedded server, and <code>TestRestTemplate</code> sends real HTTP requests to it:</p>
<pre><code class="language-java">@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class LibraryApiIntegrationTest {

    @Autowired TestRestTemplate http;

    @Test
    void addsABookAndReadsItBack() {
        var request = new CreateBookRequest("The Guide", "R. K. Narayan", "9789300000042", 2);

        ResponseEntity&lt;BookResponse&gt; created =
                http.postForEntity("/api/books", request, BookResponse.class);

        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        URI location = created.getHeaders().getLocation();
        BookResponse read = http.getForObject(location, BookResponse.class);
        assertThat(read.title()).isEqualTo("The Guide");
        assertThat(read.availableCopies()).isEqualTo(2);
    }
}</code></pre>
<p>This one test exercises everything: JSON conversion, validation, the controller, the service, the transaction, Hibernate, the database and the <code>Location</code> header. It is slower than the other kinds, so write a few of these for the journeys that matter most (issue a book, return it, list the overdue loans) rather than one per rule. With no database URL in the default configuration and H2 on the classpath, Boot runs it against an in-memory database.</p>
<p>Unlike <code>@DataJpaTest</code>, a test that calls the server over HTTP is <em>not</em> rolled back: the request runs in the server's own thread and transaction. Use unique data in each test, such as a fresh ISBN, or clean up afterwards, so that tests do not depend on each other.</p>
<h2>Which test answers which question?</h2>
<table>
<thead><tr><th>Question</th><th>Test</th></tr></thead>
<tbody>
<tr><td>Is the due date fourteen days ahead? Is the loan limit enforced?</td><td>Unit test with mocks</td></tr>
<tr><td>Does a missing book give 404 with the right body?</td><td><code>@WebMvcTest</code></td></tr>
<tr><td>Does this JPQL query return the right rows?</td><td><code>@DataJpaTest</code></td></tr>
<tr><td>Does issuing a book work from HTTP request to database row?</td><td><code>@SpringBootTest</code></td></tr>
</tbody>
</table>
<p>Name test classes so that Maven runs them: by default its test runner picks up classes ending in <code>Test</code> or <code>Tests</code>, which is why the class above is called <code>LibraryApiIntegrationTest</code> rather than <code>LibraryApiIT</code>.</p>
<h2>Common mistakes</h2>
<ul>
<li>Tests that pass alone and fail together, because they share data.</li>
<li>Only end-to-end tests: a slow build, and a failure that could be anywhere.</li>
<li>Trusting H2 for queries that use database-specific SQL.</li>
</ul>`,
          resources: [
            {
              title: 'Spring Boot: Testing',
              url: 'https://docs.spring.io/spring-boot/reference/testing/index.html',
            },
          ],
        },
        {
          kind: 'article',
          title: 'Packaging and running the API: the jar, Actuator and production settings',
          minutes: 16,
          topic: 'Shipping',
          html: `<p>Your API works on your laptop and its tests are green. Shipping means turning it into something that runs the same way on a server, can be monitored, and is configured for production without changing the code. Spring Boot makes most of this straightforward; this lesson is the checklist.</p>
<h2>Build one jar</h2>
<pre><code class="language-text">./mvnw clean package
java -jar target/library-api-0.0.1-SNAPSHOT.jar --spring.profiles.active=prod</code></pre>
<p>The Spring Boot Maven plugin, configured by the parent POM, packages your code and every dependency, including the embedded Tomcat, into one executable jar. The server only needs Java 21. Because <code>package</code> runs the tests first, a failing test means no jar, which is exactly the safety net you want.</p>
<h2>Configuration from the environment</h2>
<p>The jar that runs in production is the same jar your tests checked. Only the environment differs:</p>
<pre><code class="language-text">SPRING_PROFILES_ACTIVE=prod
LIBRARY_DB_PASSWORD=(supplied by the server's secret store)
SERVER_PORT=8080</code></pre>
<p>Spring Boot maps environment variables onto properties by name: <code>SERVER_PORT</code> sets <code>server.port</code>, and <code>SPRING_DATASOURCE_URL</code> would set <code>spring.datasource.url</code>. Environment variables override your properties files, so the operations team can change a setting without a rebuild. Secrets reach the application this way, never through Git.</p>
<h2>Health checks with Actuator</h2>
<p>Add <code>spring-boot-starter-actuator</code> and the application gains operational endpoints. The important one is health:</p>
<pre><code class="language-text">GET /actuator/health

{"status":"UP"}</code></pre>
<p>Load balancers and platforms such as Kubernetes or a cloud provider's container service call this endpoint every few seconds. If it stops answering <code>UP</code>, they stop sending traffic to that instance and can restart it. Because Boot includes a database health check automatically, the status turns <code>DOWN</code> when the database is unreachable. Only <code>health</code> is exposed over HTTP by default. Expose more with <code>management.endpoints.web.exposure.include</code> only once they are secured, because endpoints such as <code>env</code> and <code>heapdump</code> reveal sensitive details.</p>
<h2>Production settings checklist</h2>
<ul>
<li><code>spring.jpa.hibernate.ddl-auto=validate</code> (or <code>none</code>), with schema changes made by migration scripts using Flyway or Liquibase.</li>
<li><code>spring.jpa.open-in-view=false</code>.</li>
<li>Logging at <code>INFO</code> or <code>WARN</code>, without SQL statements or personal data such as phone numbers in the logs.</li>
<li>No stack traces in error responses. That is Spring Boot's default; keep <code>server.error.include-stacktrace</code> at <code>never</code>.</li>
<li>A database account with only the permissions the application needs: it can read and write the library tables, not drop them.</li>
<li>Graceful shutdown, so requests in progress finish during a redeploy. It is on by default from Spring Boot 3.4; on older versions set <code>server.shutdown=graceful</code>.</li>
</ul>
<h2>Containers, briefly</h2>
<p>Many teams ship the jar inside a Docker image so that it runs identically everywhere. Spring Boot can build one without a Dockerfile: <code>./mvnw spring-boot:build-image</code> produces an image using Cloud Native Buildpacks, provided Docker is running. Whether you deploy the plain jar or an image, the principles stay the same: one artifact, configuration from the environment, a health endpoint.</p>
<h2>A CI pipeline</h2>
<p>Finally, let a CI service such as GitHub Actions run <code>./mvnw verify</code> on every pull request. Nobody merges code that breaks the build or the tests, and the jar you deploy is always one that passed. For your portfolio project, a green build badge on the README is a small detail that interviewers notice.</p>
<h2>Common mistakes</h2>
<ul>
<li>Building the jar on a developer's laptop and copying it to the server by hand. Build it in CI from a known commit.</li>
<li>Committing <code>application-prod.properties</code> with the real password in it. Once pushed, assume it has leaked and change the password, because Git history keeps the old file.</li>
<li>Exposing every Actuator endpoint to the internet.</li>
</ul>
<h2>Check yourself</h2>
<details><summary>The platform restarts your instance whenever the database goes down for maintenance. Why, and is that what you want?</summary><p>The health endpoint includes the database check, so it reports DOWN and the platform treats the instance as broken. Restarting will not bring the database back. Spring Boot's separate liveness and readiness health groups let you split the two questions: the database check belongs in readiness ("stop sending me traffic"), not in liveness ("restart me").</p></details>`,
          resources: [
            {
              title: 'Spring Boot: Actuator Endpoints',
              url: 'https://docs.spring.io/spring-boot/reference/actuator/endpoints.html',
            },
            {
              title: 'Spring Boot documentation',
              url: 'https://docs.spring.io/spring-boot/index.html',
            },
          ],
        },
      ],
    },
  ],
  assignments: ['Spring Boot: Library REST API'],
  tests: [
    {
      title: 'Advanced Java and Spring Boot — on-demand practice test',
      kind: 'practice',
      description:
        'A self-check on Spring essentials and persistence: dependency injection, starters, bean scope, profiles, entity mapping, repository queries, lazy loading, the N + 1 problem and transactions. Take it after the Persistence module, as often as you like.',
      durationMinutes: 20,
      sections: [
        {
          title: 'Spring and Spring Boot',
          questions: [
            'spring-dependency-injection',
            'spring-constructor-injection',
            'spring-bean-scope',
            'spring-boot-starter',
            'spring-profiles',
          ],
        },
        {
          title: 'Persistence',
          questions: [
            'jpa-entity-id',
            'jpa-repository-method',
            'jpa-lazy-loading',
            'jpa-n-plus-one',
            'spring-transactional',
          ],
        },
      ],
    },
    {
      title: 'Advanced Java and Spring Boot — final test',
      kind: 'final',
      description:
        'The end-of-course test: Java fundamentals the backend relies on, Spring and persistence, REST design, and one written design question marked by your trainer against a rubric. Plan your time so that at least 20 minutes are left for the written answer.',
      durationMinutes: 60,
      sections: [
        {
          title: 'Java foundations',
          questions: ['java-checked-exceptions', 'java-finally', 'java-optional', 'java-record'],
        },
        {
          title: 'Spring and persistence',
          questions: [
            'spring-dependency-injection',
            'spring-constructor-injection',
            'spring-bean-scope',
            'spring-transactional',
            'jpa-entity-id',
            'jpa-repository-method',
            'jpa-lazy-loading',
            'jpa-n-plus-one',
          ],
        },
        {
          title: 'REST APIs',
          questions: [
            'rest-status-created',
            'rest-idempotent-methods',
            'rest-400-vs-422',
            'rest-resource-naming',
          ],
        },
        {
          title: 'Written design question',
          questions: ['rest-design-written'],
        },
      ],
    },
  ],
};
