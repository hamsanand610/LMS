'use client';

import { usePathname } from 'next/navigation';

/**
 * The list a detail page belongs to: its own address with the last segment removed. The same
 * component serves `/admin/batches/:id` and `/trainer/batches/:id`, and each way back has to stay
 * in the portal it came from.
 */
export function useParentPath(): string {
  const pathname = usePathname();
  return pathname.replace(/\/[^/]+\/?$/, '') || '/';
}
