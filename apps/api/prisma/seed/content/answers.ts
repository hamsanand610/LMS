/**
 * What seeded learners wrote for the questions a person marks, and what their reviewers said.
 * A strong answer and a weaker one per question, so the review queue and the feedback read the way
 * a real batch's would.
 */

export interface WrittenSample {
  strong: string;
  weak: string;
  /** Marks and comment a reviewer gives the strong answer. */
  strongReview: { marksShare: number; comment: string };
  weakReview: { marksShare: number; comment: string; resubmit?: boolean };
}

export const WRITTEN_ANSWERS: Record<string, WrittenSample> = {
  'java-explain-polymorphism': {
    strong: `Polymorphism lets the billing code call one method and get the right behaviour for each kind of learner without checking which kind it has.

interface FeePlan {
    long feeFor(int months);
}

class ClassroomPlan implements FeePlan {
    public long feeFor(int months) { return months * 6000L; }
}

class OnlinePlan implements FeePlan {
    public long feeFor(int months) { return months * 4000L; }
}

class WeekendPlan implements FeePlan {
    public long feeFor(int months) { return 8 * 2500L * months / 4; }
}

The billing loop only knows FeePlan:

for (Learner l : learners) total += l.plan().feeFor(l.months());

Which feeFor runs is decided at run time from the actual object (dynamic dispatch). Adding a new plan means adding a class, not editing the billing loop.`,
    weak: `Polymorphism means many forms. In Java a method can have many forms, for example overloading where the same method name has different parameters. So the fee system can have fee(int) and fee(double).`,
    strongReview: {
      marksShare: 1,
      comment:
        'Clear and complete: a common type, three implementations and billing code that never checks the type. Good point about adding a plan without touching the loop.',
    },
    weakReview: {
      marksShare: 0.2,
      comment:
        'This describes overloading, which is decided at compile time. The question is about overriding through a common type. Rewrite it with an interface, two plans and the billing loop, then submit again.',
      resubmit: true,
    },
  },
  'career-introduce-yourself': {
    strong: `I am a computer science graduate, and for the last six months I have been on SI Academy's Java Full-Stack programme.

The project I am proudest of is a library desk application in Java. I designed the classes for books, members and loans and wrote the rule that stops a book being issued twice, including the tests for it. Getting the overdue report right taught me to test boundaries, like a loan due exactly today.

I enjoy backend work most, especially designing clean APIs, and I am looking for a role where I can grow into a Spring Boot developer on a team that reviews code carefully.`,
    weak: `Hi. I know Java, Python, HTML, CSS, JavaScript, SQL, Spring Boot and Git. I am a hard worker and a quick learner. I want a job in a good company.`,
    strongReview: {
      marksShare: 1,
      comment:
        'Specific and well paced: one project, your own part in it, and a clear next step. This will land well in an interview.',
    },
    weakReview: {
      marksShare: 0.4,
      comment:
        'A list of technologies does not tell the interviewer what you can do. Pick one project, say what you built yourself and what you learned, and end with the kind of role you want.',
    },
  },
  'career-project-star': {
    strong: `Situation: in our batch's attendance app, the report sometimes showed a learner as absent on days they had attended.
Task: I was asked to find out why before the monthly report went to the placement team.
Action: I reproduced it with one learner's data and saw the missing days were all sessions that started after 18:30. The app stored times in UTC and compared them with the local date, so evening sessions landed on the next day. I changed the comparison to convert to Asia/Kolkata first and added tests for a session at 23:30.
Result: the report matched the registers for the whole month, and the tests now catch it.
Next time I would check time zones as soon as a bug depends on the time of day.`,
    weak: `There was a bug in my project. I searched on the internet and fixed it. Then the project worked properly.`,
    strongReview: {
      marksShare: 1,
      comment:
        'A model answer: the cause is explained, the fix is specific, and the tests show you thought about it recurring.',
    },
    weakReview: {
      marksShare: 0.2,
      comment:
        'We need the details: what was wrong, how you found the cause, what you changed and how you knew it was fixed. Use the four parts of the structure.',
    },
  },
  'rest-design-written': {
    strong: `Endpoints
- GET /students/{id}/payments — list a student's instalments (200)
- POST /students/{id}/payments — record an instalment (201, Location: /payments/{paymentId})
- GET /payments/{paymentId} — one payment (200, 404)

Create request: { "amountPaise": 450000, "method": "upi", "reference": "UPI-8831" }
Response: { "id": "…", "studentId": "…", "amountPaise": 450000, "status": "recorded", "recordedAt": "…" }

Amounts are whole paise, never floating point. Validation errors return 422 with the field; an unknown student returns 404.

Retries: the client sends an Idempotency-Key header. The server stores the key with the result; a repeat of the same key returns the first response instead of recording a second payment. A reused key with a different body returns 409.`,
    weak: `POST /addPayment with amount and student id. It returns success true. If there is an error it returns success false.`,
    strongReview: {
      marksShare: 0.9,
      comment:
        'Very good design. For full marks, say how long idempotency keys are kept and what the list endpoint does with many instalments (paging).',
    },
    weakReview: {
      marksShare: 0.2,
      comment:
        'Name resources, not actions, and use status codes rather than a success flag. Most importantly, explain how a retried request avoids charging twice.',
    },
  },
};

/** Notes learners write when they hand in practical and project work. */
export const HAND_IN_NOTES: Record<string, string> = {
  'git-practical-pull-request':
    'Opened the pull request from my branch and pushed a follow-up commit renaming the file after the review comment.',
  'spring-boot-project-library-api':
    'All five operations work. Tests cover issuing, returning and the overdue query. The README lists every endpoint with a curl example.',
  'deploy-practical-portfolio': 'Published on a static host; checked it on my phone.',
  'css-practical-responsive-cards':
    'Mobile-first grid with breakpoints at 640px and 1024px; focus outline on the buttons.',
  'js-project-task-board':
    'Tasks persist in localStorage; overdue tasks are marked in red with an icon and the word "Overdue".',
  'java-project-library-cli':
    'Console app with Book, Member and Loan classes; bad input raises an exception with a message.',
};

/** What reviewers say about hand-ins they accept. */
export const HAND_IN_APPROVALS: Record<string, string> = {
  'git-practical-pull-request':
    'Good branch name and clear commits. You answered the review in the same pull request, which is exactly right.',
  'spring-boot-project-library-api':
    'Solid API. Add paging to the loans list before you put it on your resume.',
};
