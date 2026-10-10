import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getBoolPref, setBoolPref } from '../lib/local-prefs';
import type { RegistryEntry } from './screen-resolve';

export const SHOW_SCREEN_NUMBERS_KEY = 'app.settings.show-screen-numbers';

export type ScreenNumberContextValue = {
  registry: RegistryEntry[];
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  subView: string | null;
  setSubView: React.Dispatch<React.SetStateAction<string | null>>;
};

const ScreenNumberContext = createContext<ScreenNumberContextValue | null>(null);

export function ScreenNumberProvider({
  registry,
  children,
}: {
  registry: RegistryEntry[];
  children?: React.ReactNode;
}) {
  const [enabled, setEnabledState] = useState(false);
  const [subView, setSubView] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(getBoolPref(SHOW_SCREEN_NUMBERS_KEY, false))
      .then((v) => {
        if (!cancelled) setEnabledState(v === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    Promise.resolve(setBoolPref(SHOW_SCREEN_NUMBERS_KEY, next)).catch(() => {});
  }, []);

  const value = useMemo<ScreenNumberContextValue>(
    () => ({ registry, enabled, setEnabled, subView, setSubView }),
    [registry, enabled, setEnabled, subView],
  );

  return <ScreenNumberContext.Provider value={value}>{children}</ScreenNumberContext.Provider>;
}

const NOOP_VALUE = {
  enabled: false,
  setEnabled: (_next: boolean): void => {},
  registry: [] as RegistryEntry[],
  subView: null as string | null,
};

export function useScreenNumber(opts?: { subView?: string }) {
  const ctx = useContext(ScreenNumberContext);
  const setSubView = ctx?.setSubView;
  const mine = opts?.subView;

  useEffect(() => {
    if (!setSubView || mine === undefined) return;
    setSubView(mine);
    return () => {
      setSubView((cur) => (cur === mine ? null : cur));
    };
  }, [setSubView, mine]);

  if (!ctx) return NOOP_VALUE;
  return {
    enabled: ctx.enabled,
    setEnabled: ctx.setEnabled,
    registry: ctx.registry,
    subView: ctx.subView,
  };
}
