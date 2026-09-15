import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingRows } from '@/components/page-states';
import { SearchResults } from '@/modules/search/search-results';
import { PageHeader } from '@/shell/page-header';

export const metadata: Metadata = { title: 'Search' };

export default function SearchPage() {
  return (
    <>
      <PageHeader title="Search" description="Everything you are allowed to see, in one place." />
      <Suspense fallback={<LoadingRows rows={5} />}>
        <SearchResults />
      </Suspense>
    </>
  );
}
