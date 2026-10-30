import React, { createContext, useContext } from 'react';
import type { MenuActionItem } from './AppChrome';

/*
 * App-wide entries for every screen's ⋮ options menu. AppChrome appends these
 * after Help, so a screen never has to list them itself.
 */
const GlobalOptionsContext = createContext<MenuActionItem[]>([]);

export function GlobalOptionsProvider({ items, children }: { items: MenuActionItem[]; children?: React.ReactNode }) {
  return <GlobalOptionsContext.Provider value={items}>{children}</GlobalOptionsContext.Provider>;
}

export function useGlobalOptionsItems(): MenuActionItem[] {
  return useContext(GlobalOptionsContext);
}
