import type { Metadata } from 'next';
import { getMe } from '@/lib/api/server';
import { firstName, greetingFor, longDate } from '@/lib/greeting';
import { StudentDashboard } from '@/modules/dashboard/student-dashboard';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function StudentDashboardPage() {
  const me = await getMe();
  const now = new Date();
  // The greeting is the hero's heading (Task 3): the page opens on who and when, then where you
  // left off.
  return (
    <StudentDashboard
      greeting={`${greetingFor(now)}, ${firstName(me?.user.name)}`}
      date={longDate(now)}
      welcome={
        me?.branding.dashboard.welcomeText ||
        'Your classes today, where you left off, and what has been announced.'
      }
    />
  );
}
