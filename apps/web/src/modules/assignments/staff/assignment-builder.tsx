'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ASSIGNMENT_KIND_LABELS, type AssignmentDetail, type TaxonomyTerm } from '@lms/shared';
import { ErrorState, LoadingRows } from '@/components/page-states';
import { StatStrip } from '@/components/stat-strip';
import { StatusBadge } from '@/components/status-badge';
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/http';
import { formatDate, formatMinutes, humanise } from '@/lib/format';
import { useCan } from '@/shell/me-context';
import { PageHeader } from '@/shell/page-header';
import { DetailsForm } from './details-form';
import { ProgressPanel } from './progress-panel';
import { PublishPanel } from './publish-panel';
import { ResourcesEditor } from './resources-editor';
import { ReviewQueue, type StaffPortal } from './review-queue';
import { StructureEditor } from './structure-editor';

/**
 * Everything an author does to one assignment, tab by tab: its structure, its details and rules,
 * its resources, who has it, how they are doing, and the answers waiting for a person.
 */
export function AssignmentBuilder({
  assignmentId,
  portal,
}: {
  assignmentId: string;
  portal: StaffPortal;
}) {
  const canGrade = useCan('assignments:grade');
  const [tab, setTab] = useState('structure');
  // Bumped after a save so the editors start again from what the server kept.
  const [structureVersion, setStructureVersion] = useState(0);
  const [detailsVersion, setDetailsVersion] = useState(0);
  const query = useQuery({
    queryKey: ['assignment', assignmentId],
    queryFn: () => api<AssignmentDetail>(`/assignments/${assignmentId}`),
  });
  const subjects = useQuery({
    queryKey: ['taxonomy', 'subject'],
    queryFn: () => api<TaxonomyTerm[]>('/taxonomies/subject/terms'),
  });

  if (query.isPending) return <LoadingRows rows={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const assignment = query.data;
  const listHref = `/${portal}/assignments`;
  const technology =
    subjects.data?.find((term) => term.key === assignment.subject)?.label ??
    (assignment.subject ? humanise(assignment.subject) : null);

  return (
    <>
      <PageHeader
        back={{ href: listHref, label: 'All assignments' }}
        eyebrow={`Assignment · ${ASSIGNMENT_KIND_LABELS[assignment.kind]}`}
        title={assignment.title}
        description={assignment.description || undefined}
        meta={
          <>
            <StatusBadge status={assignment.status} />
            {technology ? <span>{technology}</span> : null}
            {assignment.courseTitle ? <span>{assignment.courseTitle}</span> : null}
            {assignment.estimatedMinutes > 0 ? (
              <span>About {formatMinutes(assignment.estimatedMinutes)}</span>
            ) : null}
            {assignment.createdByName ? <span>By {assignment.createdByName}</span> : null}
            <span className="tabular-nums">Updated {formatDate(assignment.updatedAt)}</span>
          </>
        }
      />
      <StatStrip
        className="mb-6"
        items={[
          { label: 'Modules', value: assignment.moduleCount },
          { label: 'Questions', value: assignment.questionCount },
          {
            label: 'Marks',
            value: assignment.totalMarks,
            hint: `Pass at ${assignment.passPercent}%`,
          },
          {
            label: 'Audiences',
            value: assignment.publicationCount,
            hint: 'Batches and named learners',
          },
        ]}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Assignment">
          <TabsTrigger value="structure">
            Structure <TabsCount>{assignment.questionCount}</TabsCount>
          </TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="resources">
            Resources <TabsCount>{assignment.resources.length}</TabsCount>
          </TabsTrigger>
          <TabsTrigger value="publish">Publishing</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          {canGrade ? <TabsTrigger value="reviews">Reviews</TabsTrigger> : null}
        </TabsList>
        {/* The three editors stay mounted, so a half-made change survives a look at another tab. */}
        <TabsContent value="structure" forceMount className="data-[state=inactive]:hidden">
          <StructureEditor
            key={structureVersion}
            assignmentId={assignmentId}
            detail={assignment}
            onSaved={() => setStructureVersion((n) => n + 1)}
          />
        </TabsContent>
        <TabsContent value="details" forceMount className="data-[state=inactive]:hidden">
          <DetailsForm
            key={`details-${detailsVersion}`}
            detail={assignment}
            listHref={listHref}
            onSaved={() => setDetailsVersion((n) => n + 1)}
          />
        </TabsContent>
        <TabsContent value="resources" forceMount className="data-[state=inactive]:hidden">
          <ResourcesEditor detail={assignment} />
        </TabsContent>
        <TabsContent value="publish">
          <PublishPanel assignmentId={assignmentId} hasQuestions={assignment.questionCount > 0} />
        </TabsContent>
        <TabsContent value="progress">
          <ProgressPanel assignmentId={assignmentId} />
        </TabsContent>
        {canGrade ? (
          <TabsContent value="reviews">
            <ReviewQueue portal={portal} assignmentId={assignmentId} />
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  );
}
