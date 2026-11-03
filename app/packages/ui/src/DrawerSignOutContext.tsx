import React, { createContext, useContext } from 'react';

/*
 * The host's sign-out action. AppChrome ends every hamburger menu with a
 * divider and Sign out from this, so a screen never has to list it itself.
 */
const DrawerSignOutContext = createContext<(() => void) | null>(null);

export function DrawerSignOutProvider({ onSignOut, children }: { onSignOut: () => void; children?: React.ReactNode }) {
  return <DrawerSignOutContext.Provider value={onSignOut}>{children}</DrawerSignOutContext.Provider>;
}

export function useDrawerSignOut(): (() => void) | null {
  return useContext(DrawerSignOutContext);
}
