/**
 * The working developer's tools: Git and collaboration, testing, getting code deployed, and using
 * AI assistants responsibly.
 */
import type { BankQuestion } from './types.js';

export const TOOLS: BankQuestion[] = [
  // ───────────── Git ─────────────
  {
    slug: 'git-staging-area',
    type: 'mcq_single',
    title: 'What does git add do?',
    body: 'You edited three files but want to commit only two. What does `git add` on those two do?',
    technology: 'git',
    topic: 'version-control',
    level: 'beginner',
    marks: 1,
    options: [
      ['Uploads them to GitHub', false, 'That is git push.'],
      ['Puts their current changes in the staging area for the next commit', true],
      ['Creates a commit', false],
      ['Creates a new branch', false],
    ],
    explanation:
      'The staging area (index) holds exactly what the next commit will contain, so you can commit part of your work.',
  },
  {
    slug: 'git-branch-purpose',
    type: 'mcq_single',
    title: 'Why work on a branch?',
    body: 'Why does a team ask you to build each feature on its own branch?',
    technology: 'git',
    topic: 'branching',
    level: 'foundation',
    marks: 1,
    options: [
      ['Branches make the code run faster', false],
      ['Work in progress stays apart from main until it is reviewed and merged', true],
      ['Git cannot commit to main', false],
      ['Branches back up your laptop', false],
    ],
    explanation:
      'A branch isolates a line of work; a pull request then lets others review it before it reaches main.',
  },
  {
    slug: 'git-merge-conflict',
    type: 'mcq_single',
    title: 'Resolving a merge conflict',
    body: 'Git stops a merge with a conflict in `Fees.java`. What do you do?',
    technology: 'git',
    topic: 'branching',
    level: 'easy',
    marks: 2,
    options: [
      ['Delete the file and commit', false],
      [
        'Edit the file to the correct combined version, remove the markers, git add it and finish the merge',
        true,
      ],
      ['Run git push --force', false, 'Force-pushing rewrites shared history.'],
      ['Clone the repository again', false],
    ],
    explanation:
      'Conflict markers show both sides. Decide what the code should be, remove the markers, stage the file and commit; then build and test before pushing.',
  },
  {
    slug: 'git-revert-vs-reset',
    type: 'mcq_single',
    title: 'Undoing a commit that is already pushed',
    body: 'A commit on the shared main branch broke the build. Others have already pulled it. How do you undo it?',
    technology: 'git',
    topic: 'version-control',
    level: 'interview',
    marks: 2,
    options: [
      ['git reset --hard and force-push', false, 'That rewrites history others already have.'],
      ['git revert the commit, which adds a new commit that undoes it', true],
      ['Delete the repository', false],
      ['Edit the files back by hand without committing', false],
    ],
    explanation:
      '`git revert` records the undo as a new commit, so shared history stays intact for everyone.',
  },
  {
    slug: 'git-commit-message',
    type: 'true_false',
    title: '"fixed stuff" is a good commit message.',
    body: 'Decide whether this message helps a teammate reading the history later.',
    technology: 'git',
    topic: 'version-control',
    level: 'beginner',
    marks: 1,
    answer: false,
    explanation:
      'A good message says what changed and why, for example "Refuse withdrawals larger than the balance". History is read far more often than it is written.',
  },
  {
    slug: 'git-practical-pull-request',
    type: 'practical',
    title: 'Practical: your first pull request',
    body: 'Fork the class practice repository, create a branch named after you, add your profile file following the template, and open a pull request. Respond to at least one review comment with a follow-up commit. Give the pull request’s address.',
    technology: 'git',
    topic: 'branching',
    level: 'easy',
    marks: 10,
    rubric:
      'Branch and commits (4): work on a named branch, small commits with clear messages. Pull request (3): a title and description saying what and why. Review (3): a follow-up commit that answers the reviewer, not a new pull request.',
    spec: {
      fileKinds: [],
      maxFiles: 0,
      linkRequired: true,
      linkLabel: 'Pull request address',
      checklist: [
        'The branch is not main',
        'At least one follow-up commit answers a review comment',
      ],
    },
  },

  // ───────────── testing ─────────────
  {
    slug: 'testing-unit-vs-integration',
    type: 'mcq_single',
    title: 'Unit test or integration test?',
    body: 'A test starts the Spring context, calls `POST /api/students` and checks the row in a test database. What kind of test is it?',
    technology: 'testing',
    topic: 'integration-testing',
    level: 'easy',
    marks: 1,
    options: [
      [
        'A unit test',
        false,
        'A unit test isolates one class, without the framework or a database.',
      ],
      ['An integration test', true],
      ['A load test', false],
      ['A manual test', false],
    ],
    explanation:
      'It exercises several parts together (web layer, service, repository, database), which is what integration tests are for.',
  },
  {
    slug: 'testing-assert',
    type: 'mcq_single',
    title: 'Testing a boundary',
    body: 'A method gives grade A for marks of 90 and above. Which set of inputs tests the boundary best?',
    technology: 'testing',
    topic: 'unit-testing',
    level: 'medium',
    marks: 2,
    options: [
      ['50 and 100', false],
      ['89, 90 and 91', true],
      ['0 only', false],
      ['Any three random numbers', false],
    ],
    explanation:
      'Bugs cluster at boundaries (`>` written instead of `>=`). Test just below, on, and just above.',
  },
  {
    slug: 'testing-mock-purpose',
    type: 'mcq_single',
    title: 'Why use a mock?',
    body: 'You unit-test `FeeService`, which calls a payment gateway over the network. Why replace the gateway with a mock?',
    technology: 'testing',
    topic: 'unit-testing',
    level: 'medium',
    marks: 2,
    options: [
      ['Mocks make production faster', false],
      ['The test stays fast and repeatable, and you can make the gateway fail on purpose', true],
      ['The real gateway cannot be called from Java', false],
      ['Mocks remove the need for assertions', false],
    ],
    explanation:
      'A mock stands in for a slow or unreliable dependency, and lets the test script edge cases such as a declined payment.',
  },
  {
    slug: 'testing-login-cases',
    type: 'descriptive',
    title: 'Write test cases for a sign-in form',
    body: 'List the test cases you would run on a sign-in form with an email, a password and a "Keep me signed in" option. Include the expected result of each, and at least two cases about security.',
    technology: 'testing',
    topic: 'test-design',
    level: 'medium',
    marks: 10,
    rubric:
      'Coverage (4): valid sign-in, wrong password, unknown email, empty fields, email format. Security (3): the same message for unknown email and wrong password; repeated failures are slowed or locked; the password is never shown or logged. Clarity (3): each case has steps and an expected result.',
  },

  // ───────────── deployment ─────────────
  {
    slug: 'deploy-env-vars',
    type: 'mcq_single',
    title: 'Where do production secrets go?',
    body: 'Your service needs a database password in production. Where should it come from?',
    technology: 'deployment',
    topic: 'configuration',
    level: 'easy',
    marks: 1,
    options: [
      ['application.properties in the repository', false],
      ['An environment variable or secret store set on the server', true],
      ['A comment in the code', false],
      ['The README', false],
    ],
    explanation:
      'Secrets are configuration, not code: keep them out of the repository and inject them at run time.',
  },
  {
    slug: 'deploy-docker-image',
    type: 'mcq_single',
    title: 'What is a container image?',
    body: 'What does a Docker image of your Spring Boot service contain?',
    technology: 'deployment',
    topic: 'containers',
    level: 'medium',
    marks: 2,
    options: [
      ['Only the source code', false],
      [
        'The built application plus the runtime and files it needs, ready to start the same way anywhere',
        true,
      ],
      ['A full virtual machine with its own kernel', false, 'Containers share the host’s kernel.'],
      ['The production database', false],
    ],
    explanation:
      'An image packages the app with its runtime and dependencies, so it behaves the same on a laptop, in CI and in production.',
  },
  {
    slug: 'deploy-ci-pipeline',
    type: 'mcq_single',
    title: 'What should a CI pipeline do on every pull request?',
    body: 'Choose the most useful thing a continuous-integration pipeline does before a pull request is merged.',
    technology: 'deployment',
    topic: 'ci-cd',
    level: 'easy',
    marks: 1,
    options: [
      ['Deploy straight to production', false],
      ['Build the code and run the tests, and block the merge if they fail', true],
      ['Email the whole team', false],
      ['Nothing; CI runs once a month', false],
    ],
    explanation:
      'CI keeps main releasable: every change is built and tested automatically before it lands.',
  },
  {
    slug: 'deploy-health-check',
    type: 'true_false',
    title:
      'A health-check endpoint lets the platform restart an instance that has stopped working.',
    body: 'Decide whether this is a reason to expose `/health` in a deployed service.',
    technology: 'deployment',
    topic: 'ci-cd',
    level: 'medium',
    marks: 1,
    answer: true,
    explanation:
      'Load balancers and orchestrators poll health checks to stop sending traffic to, and restart, instances that fail them.',
  },
  {
    slug: 'deploy-practical-portfolio',
    type: 'practical',
    title: 'Practical: publish your portfolio',
    body: 'Deploy your portfolio page to a free static host so anyone can open it. It must load over HTTPS, work on a phone, and link to at least two of your projects. Give its address.',
    technology: 'deployment',
    topic: 'hosting',
    level: 'easy',
    marks: 10,
    rubric:
      'Live (4): loads over HTTPS with no errors in the console. Responsive (3): usable at 360px. Content (3): at least two projects with links and a one-line description each.',
    spec: {
      fileKinds: [],
      maxFiles: 0,
      linkRequired: true,
      linkLabel: 'Portfolio address',
      checklist: ['It opens over https://', 'It works on a phone without zooming'],
    },
  },

  // ───────────── AI-assisted development ─────────────
  {
    slug: 'ai-verify-generated-code',
    type: 'mcq_single',
    title: 'Using code an AI assistant wrote',
    body: 'An AI assistant writes a method that compiles. What should you do before committing it?',
    technology: 'ai-assisted-development',
    topic: 'ai-tools',
    level: 'easy',
    marks: 1,
    options: [
      ['Commit it; it compiles', false],
      ['Read it until you understand it, test it, and check edge cases and security', true],
      ['Ask the assistant whether it is correct and trust the answer', false],
      ['Rename the variables so it looks like yours', false],
    ],
    explanation:
      'You are responsible for code you commit, whoever wrote the first draft. Understand it, test it, and check it for security problems.',
  },
  {
    slug: 'ai-secrets-in-prompts',
    type: 'true_false',
    title:
      'It is fine to paste a production database password into an AI chat to debug a connection.',
    body: 'Decide whether sharing a live credential with an external AI service is acceptable.',
    technology: 'ai-assisted-development',
    topic: 'ai-tools',
    level: 'beginner',
    marks: 1,
    answer: false,
    explanation:
      'Never share secrets or personal data with an external service. Describe the error, redact values, and rotate any credential that leaks.',
  },
  {
    slug: 'ai-good-prompt',
    type: 'mcq_single',
    title: 'Asking for help effectively',
    body: 'Which request is most likely to get a useful answer from an AI assistant?',
    technology: 'ai-assisted-development',
    topic: 'prompting',
    level: 'foundation',
    marks: 1,
    options: [
      ['"fix my code"', false],
      [
        '"This Java method should return the second largest distinct number; for [5, 5, 3] it returns 5. Here is the method and the failing test."',
        true,
      ],
      ['"write a whole app"', false],
      ['"why is Java bad"', false],
    ],
    explanation:
      'Say what the code should do, what it does instead, and give the smallest code and test that show it — the same things a human reviewer needs.',
  },
  {
    slug: 'ai-review-written',
    type: 'descriptive',
    title: 'Review a method an AI assistant wrote',
    body: 'An assistant produced this method to check a password on sign-in:\n\n```\nboolean check(String entered, String stored) {\n    System.out.println("Checking " + entered);\n    return entered.equals(stored);\n}\n```\n\nList the problems you see and say how you would fix each.',
    technology: 'ai-assisted-development',
    topic: 'code-review',
    level: 'hard',
    marks: 10,
    rubric:
      'Security (6): prints the password to the log (remove it; never log secrets); compares plain text, so passwords must be stored as salted hashes (bcrypt or Argon2) and checked with the hash function; a plain equals comparison can leak timing (use a constant-time check, which the hash library does). Robustness (2): null input throws; handle it. Process (2): notes that generated code needs review and a test for wrong and right passwords.',
  },
];
