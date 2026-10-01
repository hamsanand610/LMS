'use client';

import { createContext, useContext, useState } from 'react';

interface NavDrawerState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const NavDrawerContext = createContext<NavDrawerState | null>(null);

/**
 * One open/closed state for the phone navigation drawer, shared by everything that opens it: the
 * menu button in the staff header and the "More" tab in the learner's tab bar (plan §15.2).
 */
export function NavDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <NavDrawerContext.Provider value={{ open, setOpen }}>{children}</NavDrawerContext.Provider>
  );
}

export function useNavDrawer(): NavDrawerState {
  const state = useContext(NavDrawerContext);
  if (!state) throw new Error('useNavDrawer must be used within the portal shell');
  return state;
}
