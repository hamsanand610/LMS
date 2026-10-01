/**
 * Server-side Java: Spring and Spring Boot, persistence with Hibernate and JPA, and designing REST
 * APIs — the part of the programme that turns Java programmers into backend developers.
 */
import type { BankQuestion } from './types.js';

export const BACKEND: BankQuestion[] = [
  // ───────────── Spring and Spring Boot ─────────────
  {
    slug: 'spring-dependency-injection',
    type: 'mcq_single',
    title: 'What does dependency injection give you?',
    body: '`FeeService` needs a `PaymentGateway`. Instead of `new RazorpayGateway()` inside the service, Spring passes one into its constructor. What is the main benefit?',
    technology: 'spring-boot',
    topic: 'spring-core',
    level: 'easy',
    marks: 2,
    options: [
      ['The code runs faster', false],
      ['FeeService can be tested and reused with a different gateway without changing it', true],
      ['It removes the need for interfaces', false],
      ['Spring can skip compiling the class', false],
    ],
    explanation:
      'The service depends on an abstraction and receives the implementation, so a test can pass a fake gateway and production can switch providers by configuration.',
  },
  {
    slug: 'spring-constructor-injection',
    type: 'mcq_single',
    title: 'Which kind of injection is preferred?',
    body: 'Why do Spring teams prefer constructor injection over `@Autowired` on fields?',
    technology: 'spring-boot',
    topic: 'spring-core',
    level: 'medium',
    marks: 2,
    options: [
      ['Fields cannot be injected', false],
      [
        'Dependencies can be final, are visible in the constructor, and tests can pass them in',
        true,
      ],
      ['It is required by Spring Boot 3', false],
      ['Constructor injection creates fewer beans', false],
    ],
    explanation:
      'Constructor injection makes dependencies explicit and immutable and lets you build the object in a plain unit test without a Spring context.',
  },
  {
    slug: 'spring-boot-starter',
    type: 'mcq_single',
    title: 'What does spring-boot-starter-web bring in?',
    body: 'You add `spring-boot-starter-web` to a new project. What do you get?',
    technology: 'spring-boot',
    topic: 'spring-boot',
    level: 'foundation',
    marks: 1,
    options: [
      ['A database', false],
      ['Spring MVC, an embedded web server and JSON support, configured automatically', true],
      ['A front-end framework', false],
      ['Only annotations', false],
    ],
    explanation:
      'Starters are curated dependency sets; auto-configuration then wires an embedded Tomcat, Spring MVC and Jackson with sensible defaults.',
  },
  {
    slug: 'spring-bean-scope',
    type: 'true_false',
    title: 'A Spring bean is a singleton unless you say otherwise.',
    body: 'Decide whether Spring creates one shared instance of a `@Service` by default.',
    technology: 'spring-boot',
    topic: 'spring-core',
    level: 'easy',
    marks: 1,
    answer: true,
    explanation:
      'The default scope is singleton: one instance per application context. That is why services must not keep per-request state in fields.',
  },
  {
    slug: 'spring-profiles',
    type: 'mcq_single',
    title: 'Different settings for development and production',
    body: 'The database address differs between your laptop and the production server. What is the Spring Boot way to handle it?',
    technology: 'spring-boot',
    topic: 'spring-boot',
    level: 'medium',
    marks: 2,
    options: [
      ['Change the code before each deployment', false],
      [
        'Profiles with application-dev.yml and application-prod.yml, and secrets from environment variables',
        true,
      ],
      ['Hard-code both and pick one with an if statement', false],
      [
        'Keep the production password in application.yml',
        false,
        'Secrets never belong in the repository.',
      ],
    ],
    explanation:
      'Profiles select configuration per environment; secrets come from environment variables or a secret store, never from committed files.',
  },
  {
    slug: 'spring-transactional',
    type: 'mcq_single',
    title: 'What does @Transactional do on a service method?',
    body: '`enrol()` inserts an enrolment and then charges the fee. The charge fails with an exception. What happens to the enrolment row if the method is `@Transactional`?',
    technology: 'spring-boot',
    topic: 'jpa',
    level: 'interview',
    marks: 3,
    options: [
      ['It stays, because it was saved first', false],
      ['It is rolled back with the rest of the transaction', true],
      ['It is saved twice', false],
      ['Spring retries the method', false],
    ],
    explanation:
      'The method runs in one transaction; a runtime exception rolls it back, so no enrolment exists without a charge. (Checked exceptions do not roll back unless configured.)',
  },

  // ───────────── Hibernate and JPA ─────────────
  {
    slug: 'jpa-entity-id',
    type: 'mcq_single',
    title: 'Mapping a class to a table',
    body: 'Which annotations make `Student` a JPA entity with a generated primary key?',
    technology: 'hibernate',
    topic: 'jpa',
    level: 'foundation',
    marks: 1,
    options: [
      ['@Entity on the class, @Id and @GeneratedValue on the key field', true],
      ['@Table only', false],
      ['@Component and @Id', false],
      ['@Repository on the class', false],
    ],
    explanation:
      '`@Entity` marks the class as persistent; `@Id` marks the key and `@GeneratedValue` lets the database or provider generate it.',
  },
  {
    slug: 'jpa-n-plus-one',
    type: 'mcq_single',
    title: 'The N + 1 query problem',
    body: 'Listing 50 batches, the page also shows each batch’s trainer. The log shows 51 SELECT statements. What is happening, and what fixes it?',
    technology: 'hibernate',
    topic: 'jpa',
    level: 'interview',
    marks: 3,
    options: [
      ['The database is slow; add an index', false],
      [
        'Each lazy trainer loads separately; fetch them together with a join fetch or an entity graph',
        true,
      ],
      ['JPA always runs one query per row', false],
      [
        'Switch every relation to EAGER',
        false,
        'Eager loading everywhere trades this problem for loading far too much.',
      ],
    ],
    explanation:
      'One query loads the batches, then one per batch loads its trainer. `JOIN FETCH` (or `@EntityGraph`) loads them in one query when this screen needs them.',
  },
  {
    slug: 'jpa-lazy-loading',
    type: 'true_false',
    title: 'A lazy association can be read after the session has closed.',
    body: 'Decide whether touching a lazy `@OneToMany` collection outside the transaction works by default.',
    technology: 'hibernate',
    topic: 'jpa',
    level: 'medium',
    marks: 1,
    answer: false,
    explanation:
      'Outside the persistence context Hibernate cannot load it and throws `LazyInitializationException`; load what you need inside the transaction or map to a DTO.',
  },
  {
    slug: 'jpa-repository-method',
    type: 'mcq_single',
    title: 'A query from a method name',
    body: 'In a Spring Data repository, what does `List<Student> findByCityOrderByNameAsc(String city);` do?',
    technology: 'hibernate',
    topic: 'jpa',
    level: 'easy',
    marks: 1,
    options: [
      ['Nothing until you write the SQL', false],
      ['Spring Data derives the query: students in that city, sorted by name', true],
      ['It finds one student', false],
      ['It fails because method names cannot hold queries', false],
    ],
    explanation:
      'Spring Data parses the method name into a query. For anything complex, `@Query` states it explicitly.',
  },

  // ───────────── REST ─────────────
  {
    slug: 'rest-status-created',
    type: 'mcq_single',
    title: 'The status code for a created resource',
    body: '`POST /api/students` creates a student. Which status code should the response carry?',
    technology: 'rest-apis',
    topic: 'rest',
    level: 'easy',
    marks: 1,
    options: [
      ['200 OK', false, 'Acceptable, but less precise.'],
      ['201 Created, with a Location header', true],
      ['204 No Content', false],
      ['302 Found', false],
    ],
    explanation:
      '201 says something new exists; the Location header gives its address (for example `/api/students/42`).',
  },
  {
    slug: 'rest-idempotent-methods',
    type: 'mcq_multi',
    title: 'Which methods are idempotent?',
    body: 'Select the HTTP methods where sending the same request twice leaves the server in the same state as sending it once.',
    technology: 'rest-apis',
    topic: 'rest',
    level: 'interview',
    marks: 2,
    options: [
      ['GET', true],
      ['PUT', true],
      ['DELETE', true],
      ['POST', false, 'Two identical POSTs normally create two resources.'],
    ],
    explanation:
      'GET, PUT and DELETE are idempotent by definition; POST is not, which is why payment APIs add an idempotency key.',
  },
  {
    slug: 'rest-400-vs-422',
    type: 'mcq_single',
    title: 'Reporting a validation error',
    body: 'A client sends a new student with an email address that is not valid. What should the API return?',
    technology: 'rest-apis',
    topic: 'rest',
    level: 'medium',
    marks: 2,
    options: [
      ['500 with the stack trace', false, 'Never expose internals, and it is not a server fault.'],
      ['A 4xx status with a body naming the field and the problem', true],
      ['200 with "error": true', false],
      ['404', false],
    ],
    explanation:
      'Client mistakes are 4xx (400 or 422), with a machine-readable body such as `{ "field": "email", "message": "…" }` so the form can show it.',
  },
  {
    slug: 'rest-resource-naming',
    type: 'mcq_single',
    title: 'Naming endpoints',
    body: 'Which endpoint design follows REST conventions for a batch’s students?',
    technology: 'rest-apis',
    topic: 'rest',
    level: 'foundation',
    marks: 1,
    options: [
      ['GET /getStudentsOfBatch?id=7', false],
      ['GET /batches/7/students', true],
      ['POST /batches/7/getStudents', false],
      ['GET /batch_students_list/7', false],
    ],
    explanation:
      'URLs name resources (plural nouns, nested for ownership); the HTTP method says what to do.',
  },
  {
    slug: 'rest-design-written',
    type: 'descriptive',
    title: 'Design the endpoints for fee payments',
    body: 'Design a small REST API for recording fee instalments for a student. List the endpoints (method and path), the request and response for creating a payment, the status codes, and how you would stop a double charge when the client retries.',
    technology: 'rest-apis',
    topic: 'rest',
    level: 'hard',
    marks: 10,
    rubric:
      'Endpoints (3): resource-oriented paths, correct methods, listing and reading a payment. Contract (2): request and response bodies with types; amounts as integer paise, not floats. Status codes (2): 201 on create, 4xx for validation, 404, 409 for conflicts. Retries (3): an idempotency key or natural key so a retried POST returns the first result instead of charging twice.',
  },
  {
    slug: 'spring-boot-project-library-api',
    type: 'project',
    title: 'Project: a REST API for the library',
    body: 'Build a Spring Boot 3 service for a college library: books, members and loans. Provide CRUD for books and members, endpoints to issue and return a book, and a query for overdue loans. Use Spring Data JPA with an H2 or MySQL database, validate input, return proper status codes, and write at least five tests.',
    technology: 'spring-boot',
    topic: 'rest',
    level: 'hard',
    marks: 30,
    rubric:
      'API design (8): resource paths, methods, status codes, error bodies. Persistence (6): entities and relations mapped correctly, no N + 1 on the overdue list. Validation and errors (5): Bean Validation on requests, a global exception handler. Tests (6): at least five meaningful tests (service and web layer). Delivery (5): README with run steps, sample requests, and no secrets committed.',
    spec: {
      fileKinds: ['zip'],
      maxFiles: 1,
      linkRequired: true,
      linkLabel: 'Repository address',
      checklist: [
        '`mvn test` or `gradle test` passes',
        'Issuing a book that is already on loan returns 409',
        'The README lists every endpoint with an example request',
        'No passwords or keys are committed',
      ],
    },
  },
];
