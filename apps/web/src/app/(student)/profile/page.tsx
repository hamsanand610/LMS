import type { Metadata } from 'next';
import { ProfileView } from '@/modules/profile/profile-view';

export const metadata: Metadata = { title: 'Profile' };

export default function ProfilePage() {
  return <ProfileView />;
}
