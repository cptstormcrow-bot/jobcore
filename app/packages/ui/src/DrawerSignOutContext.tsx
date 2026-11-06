import React, { createContext, useContext } from 'react';

/*
 * The host's sign-out action. AppChrome ends every hamburger menu with a
 * divider and Sign out from this, so a screen never has to list it itself.
 */
type SignOutAction = () => void | Promise<void>;
const DrawerSignOutContext = createContext<SignOutAction | null>(null);

export function DrawerSignOutProvider({ onSignOut, children }: { onSignOut: SignOutAction; children?: React.ReactNode }) {
  return <DrawerSignOutContext.Provider value={onSignOut}>{children}</DrawerSignOutContext.Provider>;
}

/** The sign-out action; awaitable so a caller can navigate once the session is really gone. */
export function useDrawerSignOut(): SignOutAction | null {
  return useContext(DrawerSignOutContext);
}
