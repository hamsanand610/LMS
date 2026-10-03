import { EmptyState } from '@/components/page-states';

/**
 * What the SI Academy AI page shows until the workspace is built (Phase 7E). It appears only when
 * the workspace is switched on for the person, which nobody's institute has done yet.
 */
export function AiWorkspacePending() {
  return (
    <EmptyState
      title="The SI Academy AI workspace is being prepared"
      description="Conversations with SI Academy AI will appear here once your institute switches them on."
    />
  );
}
