/**
 * SI Academy's curriculum, in the order a learner of the Java full-stack programme meets it
 * (the client's locked plan, Step 2). Each course is original writing for this institute.
 */
import { COURSE as advancedJava } from './advanced-java.js';
import { COURSE as aptitude } from './aptitude-and-soft-skills.js';
import { COURSE as coreJava } from './core-java.js';
import { COURSE as dsa } from './data-structures-and-algorithms.js';
import { COURSE as developerTools } from './developer-tools.js';
import { COURSE as react } from './frontend-with-react.js';
import { COURSE as foundations } from './programming-foundations.js';
import { COURSE as python } from './python-programming.js';
import { COURSE as sql } from './sql-and-databases.js';
import type { CurriculumCourse } from './types.js';
import { COURSE as web } from './web-development.js';

export const CURRICULUM: readonly CurriculumCourse[] = [
  foundations,
  coreJava,
  dsa,
  sql,
  web,
  react,
  advancedJava,
  python,
  developerTools,
  aptitude,
];
