'use client';

import { createContext, useContext } from 'react';
import type { MeResponse } from '@lms/shared';

const MeContext = createContext<MeResponse | null>(null);

export function MeProvider({ me, children }: { me: MeResponse; children: React.ReactNode }) {
  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

/** The signed-in shell data, available to client components under a portal layout. */
export function useMe(): MeResponse {
  const me = useContext(MeContext);
  if (!me) throw new Error('useMe must be used within a portal layout');
  return me;
}

/** Client-side convenience for hiding controls; the API remains the authority. */
export function useCan(permissionKey: string): boolean {
  const me = useMe();
  return me.permissions.some((p) => p.key === permissionKey);
}
