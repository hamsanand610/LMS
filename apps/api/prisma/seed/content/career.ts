/**
 * Placement readiness: aptitude, communication and the interview itself.
 */
import type { BankQuestion } from './types.js';

export const CAREER: BankQuestion[] = [
  {
    slug: 'career-introduce-yourself',
    type: 'descriptive',
    title: 'Introduce yourself in under two minutes',
    body: 'Write what you would say when an interviewer asks you to introduce yourself. Cover who you are, one thing you have built and your part in it, and what you want to do next.',
    technology: 'career',
    topic: 'interview',
    level: 'foundation',
    marks: 5,
    rubric:
      'Full marks (5): a clear opening; one concrete project with the candidate’s own contribution; a technology or result stated specifically; a forward-looking close; fits in two minutes (about 250 words). No marks for a list of technologies alone.',
  },
  {
    slug: 'career-project-star',
    type: 'descriptive',
    title: 'Describe a problem you solved, step by step',
    body: 'Using the situation, task, action and result structure, describe a bug or problem you solved in one of your projects.',
    technology: 'career',
    topic: 'interview',
    level: 'interview',
    marks: 5,
    rubric:
      'Situation and task (1): brief context. Action (2): what the candidate did, in first person, with the reasoning. Result (1): a measurable or observable outcome. Reflection (1): what they would do differently.',
  },
  {
    slug: 'career-email-first-sentence',
    type: 'mcq_single',
    title: 'Writing an email that gets a reply',
    body: 'You need your trainer to approve a deadline extension. What makes the email most likely to get a quick answer?',
    technology: 'career',
    topic: 'communication',
    level: 'beginner',
    marks: 1,
    options: [
      ['A long background before the request', false],
      ['The request and the new date in the first sentence, then the reason briefly', true],
      ['Copying everyone in the batch', false],
      ['Marking it urgent', false],
    ],
    explanation:
      'Lead with the ask so the reader knows what decision you need; keep the reason short.',
  },
  {
    slug: 'career-questions-to-ask',
    type: 'mcq_single',
    title: 'A good question to ask the interviewer',
    body: 'At the end of a technical interview you are asked whether you have any questions. Which is the strongest?',
    technology: 'career',
    topic: 'interview',
    level: 'easy',
    marks: 1,
    options: [
      ['"How much leave do I get?"', false, 'Save this for the HR round or the offer stage.'],
      ['"What would a new graduate on your team work on in the first three months?"', true],
      ['"No questions."', false],
      ['"Did I pass?"', false],
    ],
    explanation:
      'A question about the work shows interest and tells you whether the role suits you.',
  },
  {
    slug: 'aptitude-percentage',
    type: 'mcq_single',
    title: 'Fee after a discount and tax',
    body: 'A course costs ₹20 000. There is a 10% discount, and then 18% GST on the discounted price. What is the final amount?',
    technology: 'aptitude',
    topic: 'numbers',
    level: 'easy',
    marks: 2,
    options: [
      ['₹21 600', false, 'That applies 8% net, which is not how successive percentages work.'],
      ['₹21 240', true, '20 000 × 0.9 = 18 000; 18 000 × 1.18 = 21 240.'],
      ['₹23 600', false],
      ['₹18 000', false],
    ],
    explanation:
      'Apply percentages in order: the discount gives ₹18 000, and 18% GST on that adds ₹3 240.',
  },
  {
    slug: 'aptitude-time-work',
    type: 'mcq_single',
    title: 'Two trainers marking papers',
    body: 'One trainer marks a batch’s papers in 6 hours, another in 3 hours. Working together, how long do they take?',
    technology: 'aptitude',
    topic: 'numbers',
    level: 'medium',
    marks: 2,
    options: [
      ['4.5 hours', false],
      ['2 hours', true, 'Together they do 1/6 + 1/3 = 1/2 of the work per hour.'],
      ['3 hours', false],
      ['1.5 hours', false],
    ],
    explanation:
      'Add the rates, not the times: 1/6 + 1/3 = 1/2 per hour, so the whole job takes 2 hours.',
  },
  {
    slug: 'aptitude-series',
    type: 'mcq_single',
    title: 'What comes next?',
    body: '2, 6, 12, 20, 30, ?',
    technology: 'aptitude',
    topic: 'reasoning',
    level: 'easy',
    marks: 1,
    options: [
      ['40', false],
      ['42', true, 'The differences are 4, 6, 8, 10, then 12.'],
      ['36', false],
      ['44', false],
    ],
    explanation: 'Each term is n × (n + 1): 1×2, 2×3, 3×4, 4×5, 5×6, so the next is 6×7 = 42.',
  },
  {
    slug: 'career-resume-upload',
    type: 'file_upload',
    title: 'Upload your resume for review',
    body: 'Upload your one-page resume as a PDF. Your placement mentor will review it against the checklist and send you comments.',
    technology: 'career',
    topic: 'resume',
    level: 'foundation',
    marks: 10,
    rubric:
      'Layout (3): one page, readable fonts, consistent spacing. Content (4): projects with the candidate’s own role and the technology used; skills that match the projects; no false claims. Details (3): working email and phone, a link to a portfolio or repository, no spelling mistakes.',
    spec: {
      fileKinds: ['pdf'],
      maxFiles: 1,
      linkRequired: false,
      linkLabel: '',
      checklist: ['It fits on one page', 'Each project says what you built yourself'],
    },
  },
];
