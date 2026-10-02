import { Injectable, Logger } from '@nestjs/common';
import {
  QUESTION_DIFFICULTIES,
  QUESTION_IMPORT_COLUMNS,
  type QuestionDifficulty,
  type QuestionImportResult,
  type QuestionImportRowError,
  type QuestionType,
  type SheetEncoding,
  slugify,
  uniqueSlug,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { ValidationError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { SheetsService } from '../../core/sheets/sheets.service.js';
import { TenantService } from '../../core/tenant/tenant.service.js';
import { parseDelimited, rowToObject } from '../students/csv.js';

/** Objective types only: a coding question needs test cases, which a flat sheet cannot carry. */
const IMPORTABLE_TYPES: Record<string, QuestionType> = {
  mcq: 'mcq_single',
  mcq_single: 'mcq_single',
  'mcq-single': 'mcq_single',
  mcq_multi: 'mcq_multi',
  'mcq-multi': 'mcq_multi',
  true_false: 'true_false',
  'true-false': 'true_false',
  truefalse: 'true_false',
  descriptive: 'descriptive',
};

const OPTION_COLUMNS = ['option_1', 'option_2', 'option_3', 'option_4'] as const;

/**
 * Bulk load for the question bank. Every row is checked before anything is written, and a row
 * that cannot be used is reported with its line number and the reason, rather than skipped in
 * silence (plan AC-06.1).
 */
@Injectable()
export class QuestionImportService {
  private readonly logger = new Logger(QuestionImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly sheets: SheetsService,
  ) {}

  /** The sheet an author downloads before filling it in. */
  template(): string {
    const header = QUESTION_IMPORT_COLUMNS.join(',');
    const examples = [
      [
        'Which keyword declares a constant in JavaScript?',
        'Choose the keyword that creates a binding you cannot reassign.',
        'mcq_single',
        'javascript',
        '',
        'easy',
        '1',
        '0',
        '"const" creates a binding that cannot be reassigned.',
        'var',
        'let',
        'const',
        'static',
        '3',
      ],
      [
        'A Java interface can declare a static method.',
        'Decide whether the statement is true.',
        'true_false',
        'core-java',
        '',
        'medium',
        '1',
        '0',
        'Since Java 8 an interface may declare static and default methods.',
        'True',
        'False',
        '',
        '',
        '1',
      ],
      [
        'Explain the difference between a primary key and a unique constraint.',
        'Answer in your own words, with an example of each.',
        'descriptive',
        'sql',
        '',
        'medium',
        '5',
        '0',
        '',
        '',
        '',
        '',
        '',
        '',
      ],
    ];
    const quote = (cell: string) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
    return [header, ...examples.map((row) => row.map(quote).join(','))].join('\n');
  }

  /**
   * Reads the sheet and, unless this is a dry run, writes what it can. Returns what happened to
   * every row, so the page can show the errors beside their line numbers.
   */
  async import(
    content: string,
    options: { dryRun: boolean; publish: boolean; encoding?: SheetEncoding },
    user: AuthUser,
  ): Promise<QuestionImportResult> {
    // A workbook becomes CSV first, so the row numbers in the error report mean the same thing
    // whichever format was uploaded.
    const text = await this.sheets.toDelimitedText(content, options.encoding ?? 'text');
    const sheet = parseDelimited(text);
    if (sheet.headers.length === 0) {
      throw new ValidationError([{ path: 'content', message: 'The sheet is empty' }]);
    }
    const missing = ['title', 'body', 'type'].filter((column) => !sheet.headers.includes(column));
    if (missing.length > 0) {
      throw new ValidationError(
        missing.map((column) => ({
          path: 'content',
          message: `The sheet has no "${column}" column`,
        })),
      );
    }

    const org = await this.tenant.getOrganization();
    const errors: QuestionImportRowError[] = [];
    const prepared: PreparedRow[] = [];
    const seenTitles = new Set<string>();
    let skipped = 0;

    for (const [index, row] of sheet.rows.entries()) {
      const line = index + 2; // the header is line 1
      const values = rowToObject(sheet.headers, row.cells);
      const result = this.prepare(values, line);
      if ('error' in result) {
        errors.push(result.error);
        continue;
      }
      const key = result.row.title.toLowerCase();
      if (seenTitles.has(key)) {
        skipped += 1;
        errors.push({ row: line, column: 'title', message: 'The same title appears twice' });
        continue;
      }
      seenTitles.add(key);
      prepared.push(result.row);
    }

    // A title already in the bank is a skip, not a failure: re-importing a sheet is normal.
    const existing = await this.prisma.question.findMany({
      where: {
        organizationId: org.id,
        deletedAt: null,
        title: { in: prepared.map((row) => row.title) },
      },
      select: { title: true },
    });
    const already = new Set(existing.map((row) => row.title.toLowerCase()));
    const toWrite = prepared.filter((row) => {
      if (already.has(row.title.toLowerCase())) {
        skipped += 1;
        return false;
      }
      return true;
    });

    if (!options.dryRun && toWrite.length > 0) {
      // As in QuestionsService.create: `/labs/playground` belongs to the playground.
      const taken = new Set([
        'playground',
        ...(await this.prisma.question.findMany({ select: { slug: true } })).map((q) => q.slug),
      ]);
      for (const row of toWrite) {
        const slug = uniqueSlug(slugify(row.title), taken);
        taken.add(slug);
        await this.prisma.question.create({
          data: {
            organizationId: org.id,
            slug,
            title: row.title,
            body: row.body,
            type: row.type,
            subject: row.subject,
            topic: row.topic,
            difficulty: row.difficulty,
            marks: row.marks,
            negativeMarks: row.negativeMarks,
            explanation: row.explanation,
            status: options.publish ? 'published' : 'draft',
            authorId: user.id,
            options: {
              create: row.options.map((option, position) => ({
                body: option.body,
                isCorrect: option.isCorrect,
                position,
              })),
            },
          },
        });
      }
      await this.audit.record({
        action: 'question.imported',
        resourceType: 'question',
        summary: `${toWrite.length} question(s) imported, ${errors.length} row(s) rejected`,
        after: { imported: toWrite.length, failed: errors.length, skipped },
      });
    }

    return {
      total: sheet.rows.length,
      imported: options.dryRun ? 0 : toWrite.length,
      skipped,
      failed: errors.filter((e) => e.message !== 'The same title appears twice').length,
      errors,
    };
  }

  private prepare(
    values: Record<string, string>,
    line: number,
  ): { row: PreparedRow } | { error: QuestionImportRowError } {
    const title = (values['title'] ?? '').trim();
    const body = (values['body'] ?? '').trim();
    const rawType = (values['type'] ?? '').trim().toLowerCase();

    if (!title) return { error: { row: line, column: 'title', message: 'The title is missing' } };
    if (title.length > 200) {
      return { error: { row: line, column: 'title', message: 'The title is over 200 characters' } };
    }
    if (!body) return { error: { row: line, column: 'body', message: 'The question is missing' } };
    const type = IMPORTABLE_TYPES[rawType];
    if (!type) {
      return {
        error: {
          row: line,
          column: 'type',
          message: `"${values['type']}" is not an importable type (${Object.keys(IMPORTABLE_TYPES).join(', ')})`,
        },
      };
    }

    const difficultyRaw = (values['difficulty'] ?? 'easy').trim().toLowerCase();
    if (!QUESTION_DIFFICULTIES.includes(difficultyRaw as QuestionDifficulty)) {
      return {
        error: {
          row: line,
          column: 'difficulty',
          message: `"${values['difficulty']}" is not easy, medium or hard`,
        },
      };
    }
    const marks = Number(values['marks'] || '1');
    if (!Number.isInteger(marks) || marks < 1 || marks > 100) {
      return {
        error: { row: line, column: 'marks', message: 'Marks must be a whole number, 1 to 100' },
      };
    }
    const negativeMarks = Number(values['negative_marks'] || '0');
    if (Number.isNaN(negativeMarks) || negativeMarks < 0) {
      return {
        error: {
          row: line,
          column: 'negative_marks',
          message: 'Negative marks cannot be below zero',
        },
      };
    }

    const options: { body: string; isCorrect: boolean }[] = [];
    if (type === 'true_false') {
      const correct = (values['correct'] ?? '').trim().toLowerCase();
      const trueIsCorrect = ['1', 'true', 'yes', 't'].includes(correct);
      const falseIsCorrect = ['2', 'false', 'no', 'f'].includes(correct);
      if (!trueIsCorrect && !falseIsCorrect) {
        return {
          error: {
            row: line,
            column: 'correct',
            message: 'Say whether the statement is true or false',
          },
        };
      }
      options.push({ body: 'True', isCorrect: trueIsCorrect });
      options.push({ body: 'False', isCorrect: falseIsCorrect });
    } else if (type === 'mcq_single' || type === 'mcq_multi') {
      const given = OPTION_COLUMNS.map((column) => (values[column] ?? '').trim()).filter(Boolean);
      if (given.length < 2) {
        return {
          error: {
            row: line,
            column: 'option_1',
            message: 'A multiple-choice row needs at least two options',
          },
        };
      }
      const correctIndexes = (values['correct'] ?? '')
        .split(/[;,|]/)
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isInteger(n) && n >= 1);
      if (correctIndexes.length === 0) {
        return {
          error: {
            row: line,
            column: 'correct',
            message: 'Give the number of the correct option (1, 2, 3 or 4)',
          },
        };
      }
      if (correctIndexes.some((n) => n > given.length)) {
        return {
          error: {
            row: line,
            column: 'correct',
            message: `There is no option ${Math.max(...correctIndexes)}`,
          },
        };
      }
      if (type === 'mcq_single' && correctIndexes.length > 1) {
        return {
          error: { row: line, column: 'correct', message: 'Only one option can be correct here' },
        };
      }
      given.forEach((option, index) => {
        options.push({ body: option, isCorrect: correctIndexes.includes(index + 1) });
      });
    }

    return {
      row: {
        title,
        body,
        type,
        subject: (values['subject'] ?? '').trim(),
        topic: (values['topic'] ?? '').trim(),
        difficulty: difficultyRaw as QuestionDifficulty,
        marks,
        negativeMarks,
        explanation: (values['explanation'] ?? '').trim(),
        options,
      },
    };
  }
}

interface PreparedRow {
  title: string;
  body: string;
  type: QuestionType;
  subject: string;
  topic: string;
  difficulty: QuestionDifficulty;
  marks: number;
  negativeMarks: number;
  explanation: string;
  options: { body: string; isCorrect: boolean }[];
}
