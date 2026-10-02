import type { Metadata } from 'next';
import { ProjectsList } from '@/modules/assignments/projects-list';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Projects' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="The projects your trainers have set: the brief, what to hand in, and their feedback."
      />
      <ProjectsList />
    </>
  );
}
