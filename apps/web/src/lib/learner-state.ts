import type { QueryClient } from '@tanstack/react-query';

/**
 * After a learner completes something — a lesson, a lab, an assignment answer, a test — every page
 * that reflects it is refreshed together: the lesson and course, the course list, the dashboard,
 * the progress page and the streak. One place, so no page is left showing the old state.
 */
export async function refreshLearnerState(
  queryClient: QueryClient,
  touched: { courseId?: string; lessonId?: string } = {},
): Promise<void> {
  const keys: unknown[][] = [
    ['my-courses'],
    ['student-dashboard'],
    ['progress'],
    ['consistency'],
    ['certificates'],
    ['labs'],
  ];
  if (touched.lessonId) keys.push(['lesson', touched.lessonId]);
  if (touched.courseId) keys.push(['course', touched.courseId]);
  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
