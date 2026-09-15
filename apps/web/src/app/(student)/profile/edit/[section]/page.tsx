import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PROFILE_SECTIONS, type ProfileSection } from '@lms/shared';
import { ProfileEditor } from '@/modules/profile/profile-editor';

export const metadata: Metadata = { title: 'Edit your profile' };

export default async function ProfileEditPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!(PROFILE_SECTIONS as readonly string[]).includes(section)) notFound();
  return <ProfileEditor section={section as ProfileSection} />;
}
