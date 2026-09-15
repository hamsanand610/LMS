import type { Metadata } from 'next';
import { TrainerProfile } from '@/modules/trainers/trainer-profile';

export const metadata: Metadata = { title: 'Your profile' };

export default function TrainerProfilePage() {
  return <TrainerProfile />;
}
