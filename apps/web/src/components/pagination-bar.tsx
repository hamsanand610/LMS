'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Footer for a paginated list: what is shown, and the two controls that move through it. */
export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  noun = 'items',
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  noun?: string;
}) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav
      aria-label="Pages"
      className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted-foreground tabular-nums"
    >
      <span>{total === 0 ? `No ${noun}` : `${first}–${last} of ${total} ${noun}`}</span>
      <div className="flex items-center gap-2">
        {pages > 1 ? (
          <span className="hidden sm:inline">
            Page {page} of {pages}
          </span>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden="true" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={last >= total}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
