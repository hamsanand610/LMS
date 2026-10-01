import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { OwnDocumentRecord, ProfileView, ResumeRecord } from '@lms/shared';
import { MAX_RESUMES } from '@lms/shared';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { TenantService } from '../src/core/tenant/tenant.service.js';
import { createTestApp } from './setup/app.js';
import { Session, expectStatus, problemCode } from './setup/http.js';
import { TEST_ACCOUNTS } from './setup/seed-users.js';

/**
 * The learner's own record (plan DP-S17–S20, AC-12.1 to AC-12.3): what they may change, what the
 * completeness figure is made of, the rules a resume has to keep, and the fact that none of it
 * reaches anybody else's record.
 */
describe('the learner’s own profile', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let student: Session;
  let admin: Session;
  let trainer: Session;
  const password = inject('password');

  let organizationId = '';
  let studentId = '';
  let studentUserId = '';
  const fileIds: string[] = [];

  /**
   * A file row in the state the learner's own upload leaves behind (finished, theirs, in the
   * context it was uploaded for), so the profile can be handed one.
   */
  async function uploadedPdf(name: string, context = 'resume'): Promise<string> {
    const file = await prisma.file.create({
      data: {
        organizationId,
        ownerType: context,
        uploadedById: studentUserId,
        driver: 's3',
        bucket: 'lms-private',
        key: `test/${name}-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`,
        originalName: name,
        mime: 'application/pdf',
        size: 1024,
        visibility: 'private',
        status: 'ready',
      },
    });
    fileIds.push(file.id);
    return file.id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    organizationId = (await app.get(TenantService).getOrganization()).id;
    student = new Session(app);
    admin = new Session(app);
    trainer = new Session(app);
    expectStatus(await student.login(TEST_ACCOUNTS.student.email, password), 200);
    expectStatus(await admin.login(TEST_ACCOUNTS.superAdmin.email, password), 200);
    expectStatus(await trainer.login(TEST_ACCOUNTS.trainer.email, password), 200);
    const profile = await prisma.studentProfile.findFirstOrThrow({
      where: { user: { email: TEST_ACCOUNTS.student.email } },
    });
    studentId = profile.id;
    studentUserId = profile.userId;
  });

  afterAll(async () => {
    await prisma.resume.deleteMany({ where: { studentId } });
    await prisma.document.deleteMany({ where: { studentId } });
    if (fileIds.length > 0) await prisma.file.deleteMany({ where: { id: { in: fileIds } } });
    await app.close();
  });

  it('shows the learner their own record and what the score is made of', async () => {
    const profile = expectStatus(await student.get('/me/profile'), 200).body as ProfileView;
    expect(profile.studentId).toBe(studentId);
    expect(profile.email).toBe(TEST_ACCOUNTS.student.email);
    expect(profile.completenessParts.length).toBeGreaterThan(0);
    // Every part carries a weight and says whether it is done, so the page can name what is missing.
    expect(profile.completenessParts.every((part) => typeof part.done === 'boolean')).toBe(true);
    // Projects and certificates are sections of their own now (ADR-0014), not pending modules.
    expect(profile.pending).toEqual([]);
    expect(Array.isArray(profile.projects)).toBe(true);
    expect(Array.isArray(profile.certifications)).toBe(true);
  });

  it('saves one section and recomputes the score from what is stored (AC-12.3)', async () => {
    const before = (expectStatus(await student.get('/me/profile'), 200).body as ProfileView)
      .completeness;

    const after = expectStatus(
      await student.patch('/me/profile/skills', { skills: ['Java', 'SQL', 'HTML'] }),
      200,
    ).body as ProfileView;

    expect(after.skills).toEqual(['Java', 'SQL', 'HTML']);
    expect(after.completeness).toBeGreaterThan(before);
    expect(after.completenessParts.find((part) => part.key === 'skills')?.done).toBe(true);

    // The staff view reads the same number.
    const staff = expectStatus(await admin.get(`/students/${studentId}`), 200).body as {
      completeness: number;
      skills: string[];
    };
    expect(staff.completeness).toBe(after.completeness);
    expect(staff.skills).toEqual(['Java', 'SQL', 'HTML']);
  });

  it('saves the learner’s projects and certificates as their own sections', async () => {
    const saved = expectStatus(
      await student.patch('/me/profile/projects', {
        projects: [
          {
            title: 'Library desk',
            description: 'Loans and fines in MySQL.',
            link: '',
            technologies: ['Java', 'JDBC'],
          },
        ],
      }),
      200,
    ).body as ProfileView;
    expect(saved.projects.map((p) => p.title)).toEqual(['Library desk']);

    const certs = expectStatus(
      await student.patch('/me/profile/certifications', {
        certifications: [{ title: 'SQL basics', issuer: 'An online course', year: 2025, link: '' }],
      }),
      200,
    ).body as ProfileView;
    expect(certs.certifications).toHaveLength(1);
    // Projects are untouched by a save to another section.
    expect(certs.projects).toHaveLength(1);
  });

  it('only accepts a finished photo upload of the learner’s own', async () => {
    const pdf = await uploadedPdf('not-a-photo.pdf');
    const refused = await student.put('/me/profile/photo', { fileId: pdf });
    expectStatus(refused, 400);
    expectStatus(await student.put('/me/profile/photo', { fileId: null }), 200);
  });

  it('refuses a body that strays outside the section in the path', async () => {
    const response = await student.patch('/me/profile/skills', {
      skills: ['Java'],
      summary: 'This belongs to the personal section.',
    });
    expectStatus(response, 400);
    expect(problemCode(response)).toBe('validation_failed');
  });

  it('merges the personal section rather than replacing it', async () => {
    expectStatus(
      await student.patch('/me/profile/personal', { personal: { city: 'Chennai' } }),
      200,
    );
    const after = expectStatus(
      await student.patch('/me/profile/personal', { personal: { state: 'Tamil Nadu' } }),
      200,
    ).body as ProfileView;
    expect(after.personal['city']).toBe('Chennai');
    expect(after.personal['state']).toBe('Tamil Nadu');
  });

  it('keeps one default resume, whatever happens to the others (AC-12.1)', async () => {
    const first = expectStatus(
      await student.post('/me/resumes', { fileId: await uploadedPdf('first.pdf'), title: 'First' }),
      201,
    ).body as ResumeRecord[];
    expect(first).toHaveLength(1);
    expect(first[0]?.isDefault).toBe(true);

    const second = expectStatus(
      await student.post('/me/resumes', {
        fileId: await uploadedPdf('second.pdf'),
        title: 'Second',
      }),
      201,
    ).body as ResumeRecord[];
    expect(second.filter((resume) => resume.isDefault)).toHaveLength(1);

    const secondId = second.find((resume) => resume.title === 'Second')?.id ?? '';
    const promoted = expectStatus(await student.post(`/me/resumes/${secondId}/default`), 201)
      .body as ResumeRecord[];
    expect(promoted.find((resume) => resume.id === secondId)?.isDefault).toBe(true);
    expect(promoted.filter((resume) => resume.isDefault)).toHaveLength(1);

    // Removing the default promotes the next, so a learner is never left without one.
    const left = expectStatus(await student.delete(`/me/resumes/${secondId}`), 200)
      .body as ResumeRecord[];
    expect(left).toHaveLength(1);
    expect(left[0]?.isDefault).toBe(true);
  });

  it('refuses a resume that is not a PDF, and refuses more than the limit (AC-12.1)', async () => {
    const image = await prisma.file.create({
      data: {
        organizationId,
        ownerType: 'resume',
        uploadedById: studentUserId,
        driver: 's3',
        bucket: 'lms-private',
        key: `test/not-a-resume-${Date.now()}.png`,
        originalName: 'photo.png',
        mime: 'image/png',
        size: 512,
        visibility: 'private',
        status: 'ready',
      },
    });
    fileIds.push(image.id);

    const wrongType = await student.post('/me/resumes', { fileId: image.id, title: 'Photo' });
    expectStatus(wrongType, 422);
    expect(problemCode(wrongType)).toBe('resume_not_pdf');

    // Fill up to the limit, then try one more.
    let held = (expectStatus(await student.get('/me/resumes'), 200).body as ResumeRecord[]).length;
    while (held < MAX_RESUMES) {
      expectStatus(
        await student.post('/me/resumes', {
          fileId: await uploadedPdf(`filler-${held}.pdf`),
          title: `Filler ${held}`,
        }),
        201,
      );
      held += 1;
    }
    const tooMany = await student.post('/me/resumes', {
      fileId: await uploadedPdf('one-too-many.pdf'),
      title: 'One too many',
    });
    expectStatus(tooMany, 422);
    expect(problemCode(tooMany)).toBe('too_many_resumes');
  });

  it('attaches only the learner’s own upload, made for that purpose', async () => {
    const theirs = await prisma.file.create({
      data: {
        organizationId,
        ownerType: 'resume',
        uploadedById: (
          await prisma.user.findUniqueOrThrow({ where: { email: TEST_ACCOUNTS.admin.email } })
        ).id,
        driver: 's3',
        bucket: 'lms-private',
        key: `test/someone-else-${Date.now()}.pdf`,
        originalName: 'someone-else.pdf',
        mime: 'application/pdf',
        size: 1024,
        visibility: 'private',
        status: 'ready',
      },
    });
    fileIds.push(theirs.id);
    const borrowed = await student.post('/me/resumes', { fileId: theirs.id, title: 'Not mine' });
    expectStatus(borrowed, 422);
    expect(problemCode(borrowed)).toBe('file_not_ready');

    // A résumé upload is not an identity document, whoever made it.
    const wrongPurpose = await student.post('/me/documents', {
      type: 'id_proof',
      fileId: await uploadedPdf('cv-as-id.pdf'),
      title: 'Identity',
    });
    expectStatus(wrongPurpose, 422);
    expect(problemCode(wrongPurpose)).toBe('file_not_ready');
  });

  it('shows a learner why a document of theirs was rejected (AC-12.2)', async () => {
    const fileId = await uploadedPdf('id-proof.pdf', 'profile-document');
    const added = expectStatus(
      await student.post('/me/documents', { type: 'id_proof', fileId, title: 'Identity' }),
      201,
    ).body as OwnDocumentRecord[];
    expect(added[0]?.status).toBe('pending');

    const documentId = added[0]?.id ?? '';
    expectStatus(
      await admin.post(`/students/${studentId}/documents/${documentId}/verify`, {
        decision: 'rejected',
        reason: 'The photograph is unreadable.',
      }),
      201,
    );

    const mine = expectStatus(await student.get('/me/documents'), 200).body as OwnDocumentRecord[];
    const decided = mine.find((document) => document.id === documentId);
    expect(decided?.status).toBe('rejected');
    expect(decided?.reason).toBe('The photograph is unreadable.');
  });

  it('is nobody else’s: a trainer and an administrator have no profile of their own', async () => {
    expectStatus(await trainer.get('/me/profile'), 403);
    expectStatus(await admin.get('/me/profile'), 403);
    expectStatus(await trainer.get('/me/resumes'), 403);
  });
});
