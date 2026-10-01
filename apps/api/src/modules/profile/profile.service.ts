import { Injectable } from '@nestjs/common';
import {
  PROFILE_SECTION_FIELDS,
  type ProfileSection,
  type ProfileUpdateInput,
  type ProfileView,
  profileLinksSchema,
  studentCertificationSchema,
  studentEducationSchema,
  studentExperienceSchema,
  studentPersonalSchema,
  studentProjectSchema,
  type StudentCertification,
  type StudentProject,
} from '@lms/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import type { AuthUser } from '../../core/auth/auth-user.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../core/http/errors.js';
import { asJson } from '../../core/prisma/json.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { ScopeService } from '../../core/scope/scope.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';
import { Inject } from '@nestjs/common';
import { completenessParts } from '../students/index.js';

/**
 * Sections a client overlay may name as not offered. Projects and certificates became learner
 * sections in Task 2 (ADR-0014), so nothing is pending by default.
 */
const PENDING_SECTIONS: { key: string; label: string; reason: string }[] = [];

/**
 * The learner's own record (plan DP-S17–S18). It is the same data staff see on a student, edited
 * one section at a time by the person it belongs to — so the completeness score, the personal
 * fields and the verification status cannot drift between the two views.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scope: ScopeService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  /** The caller's own student record, or a clear error when they are not a learner. */
  async requireOwnStudentId(user: AuthUser): Promise<string> {
    const person = await this.scope.personFor(user.id);
    if (!person.studentId) {
      throw new ForbiddenError('Only a student has a profile of their own.');
    }
    return person.studentId;
  }

  async get(user: AuthUser): Promise<ProfileView> {
    const studentId = await this.requireOwnStudentId(user);
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { name: true, email: true, mobile: true, avatarFileId: true } },
        members: { where: { isActive: true }, include: { batch: true } },
      },
    });
    if (!student) throw new NotFoundError('Profile');

    const parts = completenessParts({
      mobile: student.user.mobile,
      personal: student.personal,
      education: student.education,
      summary: student.summary,
      skills: student.skills,
    });

    return {
      studentId: student.id,
      studentCode: student.studentCode,
      name: student.user.name,
      email: student.user.email,
      mobile: student.user.mobile,
      avatarUrl: await this.avatarUrl(student.user.avatarFileId),
      status: student.status,
      verificationStatus: student.verificationStatus,
      completeness: parts.reduce((total, part) => total + (part.done ? part.weight : 0), 0),
      completenessParts: parts,
      summary: student.summary,
      personal: (student.personal ?? {}) as Record<string, unknown>,
      education: (student.education ?? []) as unknown[],
      experience: (student.experience ?? []) as unknown[],
      projects: (student.projects ?? []) as unknown as StudentProject[],
      certifications: (student.certifications ?? []) as unknown as StudentCertification[],
      skills: student.skills,
      links: (student.links ?? {}) as Record<string, string>,
      batches: student.members.map((member) => ({
        id: member.batch.id,
        code: member.batch.code,
        name: member.batch.name,
      })),
      pending: PENDING_SECTIONS,
    };
  }

  /**
   * Saves one section. The section is in the path, so a body carrying anything else is refused
   * rather than quietly writing over a field the page was not showing.
   */
  async updateSection(
    section: ProfileSection,
    input: ProfileUpdateInput,
    user: AuthUser,
  ): Promise<ProfileView> {
    const allowed = PROFILE_SECTION_FIELDS[section];
    const sent = Object.keys(input).filter(
      (key) => input[key as keyof ProfileUpdateInput] !== undefined,
    );
    const strays = sent.filter((key) => !allowed.includes(key as keyof ProfileUpdateInput));
    if (strays.length > 0) {
      throw new ValidationError(
        strays.map((key) => ({
          path: key,
          message: `"${key}" does not belong to the ${section} section`,
        })),
      );
    }
    if (sent.length === 0) {
      throw new ValidationError([{ path: 'body', message: 'Nothing to save' }]);
    }

    const studentId = await this.requireOwnStudentId(user);
    const before = await this.prisma.studentProfile.findUniqueOrThrow({
      where: { id: studentId },
      include: { user: { select: { mobile: true } } },
    });

    const data: Record<string, unknown> = {};
    if (input.personal !== undefined) {
      // Merge rather than replace: the page edits the fields it shows, not the whole object.
      const merged = { ...((before.personal ?? {}) as object), ...input.personal };
      data['personal'] = asJson(studentPersonalSchema.parse(merged));
    }
    if (input.education !== undefined) {
      data['education'] = asJson(input.education.map((row) => studentEducationSchema.parse(row)));
    }
    if (input.experience !== undefined) {
      data['experience'] = asJson(
        input.experience.map((row) => studentExperienceSchema.parse(row)),
      );
    }
    if (input.projects !== undefined) {
      data['projects'] = asJson(input.projects.map((row) => studentProjectSchema.parse(row)));
    }
    if (input.certifications !== undefined) {
      data['certifications'] = asJson(
        input.certifications.map((row) => studentCertificationSchema.parse(row)),
      );
    }
    if (input.skills !== undefined) data['skills'] = input.skills;
    if (input.summary !== undefined) data['summary'] = input.summary;
    if (input.links !== undefined) {
      const merged = { ...((before.links ?? {}) as object), ...input.links };
      data['links'] = asJson(profileLinksSchema.partial().parse(merged));
    }

    if (input.mobile !== undefined) {
      const mobile = input.mobile || null;
      if (mobile) {
        const taken = await this.prisma.user.findFirst({
          where: { mobile, id: { not: before.userId } },
          select: { id: true },
        });
        if (taken) {
          throw new ValidationError([
            { path: 'mobile', message: 'That mobile number is already on another account' },
          ]);
        }
      }
      await this.prisma.user.update({ where: { id: before.userId }, data: { mobile } });
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.studentProfile.update({ where: { id: studentId }, data });
    }

    // Recompute from what is now stored, so the score always matches the record.
    const after = await this.prisma.studentProfile.findUniqueOrThrow({
      where: { id: studentId },
      include: { user: { select: { mobile: true } } },
    });
    const completeness = completenessParts({
      mobile: after.user.mobile,
      personal: after.personal,
      education: after.education,
      summary: after.summary,
      skills: after.skills,
    }).reduce((total, part) => total + (part.done ? part.weight : 0), 0);
    await this.prisma.studentProfile.update({ where: { id: studentId }, data: { completeness } });

    await this.audit.record({
      action: 'profile.updated',
      resourceType: 'student',
      resourceId: studentId,
      summary: `${section} section updated`,
      after: { section, completeness },
    });

    return this.get(user);
  }

  /**
   * Sets or clears the learner's photo. Only a finished upload of the caller's own, from the
   * `avatar` context, is accepted — a file id from anywhere else is refused.
   */
  async setPhoto(fileId: string | null, user: AuthUser): Promise<ProfileView> {
    await this.requireOwnStudentId(user);
    if (fileId) {
      const file = await this.prisma.file.findUnique({ where: { id: fileId } });
      if (
        !file ||
        file.ownerType !== 'avatar' ||
        file.uploadedById !== user.id ||
        file.status !== 'ready'
      ) {
        throw new ValidationError([{ path: 'fileId', message: 'Upload the photo first' }]);
      }
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { avatarFileId: fileId } });
    await this.audit.record({
      action: 'profile.photo_changed',
      resourceType: 'user',
      resourceId: user.id,
      summary: fileId ? 'Photo set' : 'Photo removed',
    });
    return this.get(user);
  }

  private async avatarUrl(fileId: string | null): Promise<string | null> {
    if (!fileId) return null;
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.status !== 'ready') return null;
    return file.visibility === 'public'
      ? this.storage.publicUrl(file.key)
      : this.storage.presignDownload('private', file.key, 3600);
  }
}
