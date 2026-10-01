'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * A list's filters kept in the address, so a filtered view can be bookmarked, shared, and survives
 * a reload or the back button. Empty values are left out of the URL.
 */
export function useUrlState<K extends string>(keys: readonly K[]) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const values = Object.fromEntries(keys.map((key) => [key, params.get(key) ?? ''])) as Record<
    K,
    string
  >;

  const set = useCallback(
    (changes: Partial<Record<K, string | number | null>>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes) as [K, string | number | null][]) {
        if (value === null || value === '' || value === undefined) next.delete(key);
        else next.set(key, String(value));
      }
      // Any change other than the page goes back to the first page.
      if (!('page' in changes)) next.delete('page');
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return [values, set] as const;
}
