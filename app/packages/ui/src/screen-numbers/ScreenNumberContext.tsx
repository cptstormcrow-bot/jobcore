import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getBoolPref, setBoolPref } from '../lib/local-prefs';
import { currentSubView, removeOwner, upsertOwner, type SubViewOwner } from './subview-stack';
import type { RegistryEntry } from './screen-resolve';

export const SHOW_SCREEN_NUMBERS_KEY = 'app.settings.show-screen-numbers';

export type ScreenNumberContextValue = {
  registry: RegistryEntry[];
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  subView: string | null;
  registerSubView: (id: string, subView: string | null) => void;
  unregisterSubView: (id: string) => void;
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
  const [stack, setStack] = useState<SubViewOwner[]>([]);
  const subView = useMemo(() => currentSubView(stack), [stack]);
  const registerSubView = useCallback((id: string, sv: string | null) => {
    setStack((s) => upsertOwner(s, id, sv));
  }, []);
  const unregisterSubView = useCallback((id: string) => {
    setStack((s) => removeOwner(s, id));
  }, []);

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
    () => ({ registry, enabled, setEnabled, subView, registerSubView, unregisterSubView }),
    [registry, enabled, setEnabled, subView, registerSubView, unregisterSubView],
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
  const registerSubView = ctx?.registerSubView;
  const unregisterSubView = ctx?.unregisterSubView;
  const mine = opts?.subView;
  const id = React.useId();
  const latestSubViewRef = useRef<string | undefined>(mine);
  latestSubViewRef.current = mine;

  // Mount: join the owner stack (even with no subView, to mask lower owners).
  useEffect(() => {
    if (!registerSubView || !unregisterSubView) return;
    registerSubView(id, latestSubViewRef.current ?? null);
    return () => {
      unregisterSubView(id);
    };
  }, [registerSubView, unregisterSubView, id]);

  // Update in place; keeps the stack position.
  useEffect(() => {
    if (!registerSubView) return;
    registerSubView(id, mine ?? null);
  }, [mine, registerSubView, id]);

  if (!ctx) return NOOP_VALUE;
  return {
    enabled: ctx.enabled,
    setEnabled: ctx.setEnabled,
    registry: ctx.registry,
    subView: ctx.subView,
  };
}

// Read-only variant: same value as useScreenNumber() but never joins the owner
// stack, so display-only consumers (the badge) cannot mask a real owner's subView.
export function useScreenNumberReadOnly() {
  const ctx = useContext(ScreenNumberContext);
  if (!ctx) return NOOP_VALUE;
  return {
    enabled: ctx.enabled,
    setEnabled: ctx.setEnabled,
    registry: ctx.registry,
    subView: ctx.subView,
  };
}
