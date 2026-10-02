import React, { createContext, useContext } from 'react';
import type { AppVersionInfo } from './formatVersionLabel';

export type { AppVersionInfo } from './formatVersionLabel';
export { formatVersionLabel } from './formatVersionLabel';

export const AppVersionContext = createContext<AppVersionInfo | null>(null);

export function AppVersionProvider({
  value,
  children,
}: {
  value: AppVersionInfo | null;
  children?: React.ReactNode;
}) {
  return <AppVersionContext.Provider value={value}>{children}</AppVersionContext.Provider>;
}

export function useAppVersion(): AppVersionInfo | null {
  return useContext(AppVersionContext);
}
